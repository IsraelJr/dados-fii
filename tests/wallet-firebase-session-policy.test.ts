import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeWalletSessionEmail,
  WALLET_FIREBASE_SESSION_DURATION_MS,
  walletSessionDocumentId,
  walletSessionExpiration,
  walletSessionIsExpired,
  walletSessionMatches,
} from "../src/server/auth/WalletSessionPolicy";

test("sessão Firebase da carteira expira exatamente após doze horas", () => {
  const now = Date.UTC(2026, 0, 31, 12);
  const expiresAt = walletSessionExpiration(now);

  assert.equal(expiresAt.getTime() - now, WALLET_FIREBASE_SESSION_DURATION_MS);
  assert.equal(walletSessionIsExpired(expiresAt, expiresAt.getTime() - 1), false);
  assert.equal(walletSessionIsExpired(expiresAt, expiresAt.getTime()), true);
  assert.equal(walletSessionIsExpired("invalid", now), true);
});

test("identidade e token compõem sessões isoladas", () => {
  const firstEmail = "qa-one@example.test";
  const secondEmail = "qa-two@example.test";
  const firstToken = "wallet-session-one";
  const secondToken = "wallet-session-two";

  assert.notEqual(
    walletSessionDocumentId(firstEmail, firstToken),
    walletSessionDocumentId(secondEmail, firstToken),
  );
  assert.notEqual(
    walletSessionDocumentId(firstEmail, firstToken),
    walletSessionDocumentId(firstEmail, secondToken),
  );
});

test("sessão rejeita identidade divergente, revogada ou expirada", () => {
  const now = Date.UTC(2026, 1, 1);
  const active = { email: "qa@example.test", expiresAt: new Date(now + 1) };

  assert.equal(normalizeWalletSessionEmail(" QA@EXAMPLE.TEST "), "qa@example.test");
  assert.equal(walletSessionMatches(active, "qa@example.test", now), true);
  assert.equal(walletSessionMatches(active, "other@example.test", now), false);
  assert.equal(walletSessionMatches({ ...active, expiresAt: new Date(now) }, "qa@example.test", now), false);
  assert.equal(walletSessionMatches({ email: "qa@example.test" }, "qa@example.test", now), false);
});
