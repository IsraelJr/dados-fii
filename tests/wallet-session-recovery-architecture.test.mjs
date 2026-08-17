import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("carteira valida a sessão no servidor e não usa presença de token como verdade", () => {
  const source = read("src/app/components/WalletEmailVerifiedSync.tsx");
  assert.doesNotMatch(source, /const hasSession = Boolean\(token\)/);
  assert.match(source, /WalletSessionState/);
  assert.match(source, /validatesSession/);
  assert.match(source, /\/api\/wallet\/snapshots/);
  assert.match(source, /Sua sessão da carteira expirou\. Solicite um novo código/);
});

test("invalidação central remove somente a sessão e é instalada globalmente", () => {
  const policy = read("src/lib/users/WalletSessionRecoveryClient.ts");
  const layout = read("src/app/layout.tsx");
  assert.match(policy, /response\.status !== 401/);
  assert.match(policy, /storage\.removeItem\(WALLET_SESSION_KEY\)/);
  assert.doesNotMatch(policy, /removeItem\([^\n]*(?:wallet-v1|snapshots|history|WALLET_EMAIL_KEY)/);
  assert.match(layout, /<WalletSessionRecoveryBoundary \/>/);
});

test("recuperação só habilita PIN após confirmação do envio", () => {
  const source = read("src/app/components/WalletEmailVerifiedSync.tsx");
  assert.match(source, /setSessionState\("code_sent"\)/);
  assert.match(source, /disabled=\{sessionState !== "code_sent"\}/);
  assert.match(source, /disabled=\{!controls\.canConfirmCode\}/);
  assert.match(source, /requestCodeInFlightRef/);
  assert.match(source, /verifyCodeInFlightRef/);
});

test("invalidação mantém histórico local visível e impede flush sem credencial", () => {
  const page = read("src/app/carteira/page.tsx");
  const history = read("src/app/components/PortfolioHistoryPanel.tsx");
  assert.match(page, /if \(!email \|\| !token\) \{\s*setManualHistory\(readManualHistoryCache\(\)\)/s);
  assert.match(history, /if \(!currentCredentials\.email \|\| !currentCredentials\.token\) \{\s*setSyncState\("local"\)/s);
  assert.match(history, /Confirme novamente o e-mail para sincronizar o histórico/);
});
