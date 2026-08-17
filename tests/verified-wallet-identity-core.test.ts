import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveEmailSessionWithDependencies,
  VerifiedWalletIdentityCoreError,
  type VerifiedWalletIdentityDependencies,
} from "../src/server/auth/VerifiedWalletIdentityCore";

const NOW = Date.parse("2026-08-10T15:00:00.000Z");

function request(options: Readonly<{ email?: string; token?: string }> = {}) {
  const headers = new Headers();
  if (options.email !== undefined) headers.set("x-wallet-email", options.email);
  if (options.token !== undefined) headers.set("x-wallet-session", options.token);
  return new Request("https://preview.example.test/api/portfolio/incremental-analysis", {
    method: "POST",
    headers,
  });
}

function dependencies(
  session: Readonly<{ email?: unknown; expiresAt?: unknown }> | null,
  ownerId: string | null = "canonical-owner-id",
): VerifiedWalletIdentityDependencies {
  return {
    async readSession(documentId) {
      assert.match(documentId, /^[a-f0-9]{64}$/);
      return session;
    },
    async findOwnerId() {
      return ownerId;
    },
    now: () => NOW,
  };
}

async function rejects(
  operation: Promise<unknown>,
  status: 401 | 404,
  code: "WALLET_SESSION_REQUIRED" | "USER_NOT_FOUND",
) {
  await assert.rejects(operation, (error: unknown) => (
    error instanceof VerifiedWalletIdentityCoreError
    && error.status === status
    && error.code === code
  ));
}

test("sessão válida resolve somente o owner canônico server-side", async () => {
  const identity = await resolveEmailSessionWithDependencies(
    request({ email: "qa@example.test", token: "synthetic-session" }),
    dependencies({ email: "QA@example.test", expiresAt: "2026-08-10T16:00:00.000Z" }),
  );
  assert.deepEqual(identity, { ownerId: "canonical-owner-id", authMode: "email-session" });
});

test("ausência, token inexistente e sessão expirada falham fechado", async () => {
  assert.equal(await resolveEmailSessionWithDependencies(request(), dependencies(null)), null);
  await rejects(
    resolveEmailSessionWithDependencies(
      request({ email: "qa@example.test", token: "synthetic-session" }),
      dependencies(null),
    ),
    401,
    "WALLET_SESSION_REQUIRED",
  );
  await rejects(
    resolveEmailSessionWithDependencies(
      request({ email: "qa@example.test", token: "synthetic-session" }),
      dependencies({ email: "qa@example.test", expiresAt: "2026-08-10T14:59:59.000Z" }),
    ),
    401,
    "WALLET_SESSION_REQUIRED",
  );
  await rejects(
    resolveEmailSessionWithDependencies(
      request({ email: "qa@example.test", token: "synthetic-session" }),
      dependencies({ email: "qa@example.test", expiresAt: "2026-08-10T15:00:00.000Z" }),
    ),
    401,
    "WALLET_SESSION_REQUIRED",
  );
  assert.deepEqual(await resolveEmailSessionWithDependencies(
    request({ email: "qa@example.test", token: "synthetic-session" }),
    dependencies({ email: "qa@example.test", expiresAt: "2026-08-10T15:00:00.001Z" }),
  ), { ownerId: "canonical-owner-id", authMode: "email-session" });
});

test("e-mail divergente, cabeçalho incompleto e usuário ausente são rejeitados", async () => {
  await rejects(
    resolveEmailSessionWithDependencies(
      request({ email: "qa@example.test", token: "synthetic-session" }),
      dependencies({ email: "other@example.test", expiresAt: "2026-08-10T16:00:00.000Z" }),
    ),
    401,
    "WALLET_SESSION_REQUIRED",
  );
  await rejects(
    resolveEmailSessionWithDependencies(request({ email: "qa@example.test" }), dependencies(null)),
    401,
    "WALLET_SESSION_REQUIRED",
  );
  await rejects(
    resolveEmailSessionWithDependencies(
      request({ email: "qa@example.test", token: "synthetic-session" }),
      dependencies({ email: "qa@example.test", expiresAt: "2026-08-10T16:00:00.000Z" }, null),
    ),
    404,
    "USER_NOT_FOUND",
  );
});
