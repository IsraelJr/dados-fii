import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function text(path) {
  return readFileSync(path, "utf8");
}

test("painel de histórico usa API server-side e não Firestore", () => {
  const source = text("src/app/components/PortfolioHistoryPanel.tsx");
  assert.match(source, /\/api\/portfolio\/history/);
  assert.match(source, /x-wallet-email/);
  assert.match(source, /x-wallet-session/);
  assert.doesNotMatch(source, /firebaseAdmin|adminDb|\.collection\(/);
});

test("painel permite criar, editar e excluir somente registros manuais", () => {
  const source = text("src/app/components/PortfolioHistoryPanel.tsx");
  assert.match(source, /api\("POST"/);
  assert.match(source, /api\("PATCH"/);
  assert.match(source, /api\("DELETE"/);
  assert.match(source, /entry\.source !== "manual"/);
  assert.match(source, /Snapshot automático/);
  assert.match(source, /Registro legado/);
});

test("histórico manual está integrado à página da carteira", () => {
  const preferences = text("src/app/components/PortfolioNotificationPreferences.tsx");
  assert.match(preferences, /PortfolioHistoryPanel/);
  assert.match(preferences, /<PortfolioHistoryPanel \/>/);
});

test("interface não contém e-mail pessoal nem desbloqueio por anúncio", () => {
  const source = [
    text("src/app/components/PortfolioHistoryPanel.tsx"),
    text("src/app/components/PortfolioNotificationPreferences.tsx"),
  ].join("\n");
  assert.doesNotMatch(source, /israel\.junior2111@gmail\.com/i);
  assert.doesNotMatch(source, /adsense|assistir.*anúncio|propaganda/i);
});
