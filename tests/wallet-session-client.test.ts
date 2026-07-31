import assert from "node:assert/strict";
import test from "node:test";
import {
  clearWalletSession,
  ensureWalletSession,
  markWalletLogout,
  WALLET_EMAIL_KEY,
  WALLET_SESSION_EXPIRES_AT_KEY,
  WALLET_SESSION_KEY,
  WALLET_SESSION_LOGOUT_KEY,
  walletSessionIsUsable,
} from "../src/lib/users/WalletSessionClient.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("sessão local só é reutilizada quando identidade, token e validade coincidem", () => {
  const now = Date.UTC(2026, 6, 31, 12);
  const storage = memoryStorage({
    [WALLET_EMAIL_KEY]: "qa@example.test",
    [WALLET_SESSION_KEY]: "wallet-token",
    [WALLET_SESSION_EXPIRES_AT_KEY]: new Date(now + 120_000).toISOString(),
  });

  assert.equal(walletSessionIsUsable(storage, "qa@example.test", now), true);
  assert.equal(walletSessionIsUsable(storage, "other@example.test", now), false);
  assert.equal(walletSessionIsUsable(storage, "qa@example.test", now + 60_000), false);
});

test("sessão ausente ou expirada troca novo ID token e persiste expiração", async () => {
  const storage = memoryStorage();
  const calls: Array<{ forceRefresh?: boolean; authorization?: string }> = [];
  const user = {
    uid: "qa-uid",
    email: "QA@EXAMPLE.TEST",
    getIdToken: async (forceRefresh?: boolean) => {
      calls.push({ forceRefresh });
      return "firebase-id-token";
    },
  };
  const expiresAt = new Date(Date.UTC(2026, 6, 31, 23)).toISOString();
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ authorization: new Headers(init?.headers).get("Authorization") || "" });
    return response({ ok: true, token: "renewed-wallet-token", expiresAt });
  }) as typeof fetch;
  let notifications = 0;

  assert.equal(await ensureWalletSession(user, {
    storage,
    fetcher,
    notify: () => { notifications += 1; },
    nowMs: Date.UTC(2026, 6, 31, 12),
  }), true);
  assert.equal(storage.getItem(WALLET_EMAIL_KEY), "qa@example.test");
  assert.equal(storage.getItem(WALLET_SESSION_KEY), "renewed-wallet-token");
  assert.equal(storage.getItem(WALLET_SESSION_EXPIRES_AT_KEY), expiresAt);
  assert.deepEqual(calls, [
    { forceRefresh: true },
    { authorization: "Bearer firebase-id-token" },
  ]);
  assert.equal(notifications, 1);
});

test("401 força renovação, mas reutiliza a sessão que outra aba já renovou", async () => {
  const now = Date.UTC(2026, 6, 31, 12);
  const storage = memoryStorage({
    [WALLET_EMAIL_KEY]: "qa@example.test",
    [WALLET_SESSION_KEY]: "new-token-from-other-tab",
    [WALLET_SESSION_EXPIRES_AT_KEY]: new Date(now + 120_000).toISOString(),
  });
  let exchanges = 0;
  const user = {
    uid: "qa-multi-tab",
    email: "qa@example.test",
    getIdToken: async () => {
      exchanges += 1;
      return "unused";
    },
  };

  assert.equal(await ensureWalletSession(user, {
    storage,
    force: true,
    rejectedToken: "rejected-old-token",
    nowMs: now,
  }), true);
  assert.equal(exchanges, 0);
});

test("falha de renovação não persiste token parcial e limpeza remove toda a sessão", async () => {
  const storage = memoryStorage({
    [WALLET_EMAIL_KEY]: "qa@example.test",
    [WALLET_SESSION_KEY]: "expired-token",
    [WALLET_SESSION_EXPIRES_AT_KEY]: "2026-01-01T00:00:00.000Z",
  });
  const user = {
    uid: "qa-failure",
    email: "qa@example.test",
    getIdToken: async () => "firebase-id-token",
  };
  const fetcher = (async () => response({ ok: false }, 401)) as typeof fetch;

  await assert.rejects(
    ensureWalletSession(user, { storage, fetcher, force: true }),
    /Falha ao renovar/,
  );
  clearWalletSession(storage);
  assert.equal(storage.getItem(WALLET_EMAIL_KEY), null);
  assert.equal(storage.getItem(WALLET_SESSION_KEY), null);
  assert.equal(storage.getItem(WALLET_SESSION_EXPIRES_AT_KEY), null);
});

test("logout sinaliza outras abas e remove toda a sessão local", () => {
  const storage = memoryStorage({
    [WALLET_EMAIL_KEY]: "qa@example.test",
    [WALLET_SESSION_KEY]: "wallet-token",
    [WALLET_SESSION_EXPIRES_AT_KEY]: "2026-08-01T00:00:00.000Z",
  });

  markWalletLogout(storage);

  assert.equal(storage.getItem(WALLET_EMAIL_KEY), null);
  assert.equal(storage.getItem(WALLET_SESSION_KEY), null);
  assert.equal(storage.getItem(WALLET_SESSION_EXPIRES_AT_KEY), null);
  assert.match(String(storage.getItem(WALLET_SESSION_LOGOUT_KEY)), /^20\d{2}-/);
});
