import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const route = source("src/app/api/admin/system/risk-lab/notices/route.ts");
const panel = source("src/app/admin/risk-lab/FnetNoticeImportPanel.tsx");
const readiness = source("src/lib/risk-lab/DividendSeriesReadiness.ts");
const combined = `${route}\n${panel}\n${readiness}`;

test("rota apenas calcula cobertura das observações aprovadas", () => {
  assert.match(route, /calculateDividendSeriesReadiness/);
  assert.match(route, /verifiedDividendNoticeStore\.listByTicker\("MCCI11"\)/);
  assert.match(route, /verifiedDividendNoticeStore\.listByTicker\("RBRY11"\)/);
  assert.match(route, /series/);
});

test("cobertura exige nove meses consecutivos e mantém detector não executado", () => {
  assert.match(readiness, /REQUIRED_CONTIGUOUS_COUNT = 9/);
  assert.match(readiness, /readyForStressDetection: longest\.length >= REQUIRED_CONTIGUOUS_COUNT/);
  assert.match(readiness, /detectorExecuted: false/);
});

test("rota e painel não importam nem executam o detector de estresse", () => {
  assert.doesNotMatch(combined, /DividendStressWindowEngine/);
  assert.doesNotMatch(combined, /dividendStressWindowEngine/);
  assert.doesNotMatch(combined, /\.detect\(/);
  assert.doesNotMatch(route, /action\s*===\s*["']detect["']/);
});

test("painel diferencia série suficiente de backtest executado", () => {
  assert.match(panel, /Série suficiente/);
  assert.match(panel, /Coleta incompleta/);
  assert.match(panel, /Detector/);
  assert.match(panel, /Não executado/);
  assert.match(panel, /Nenhum resultado analítico foi calculado/);
});

test("fluxo permanece isolado de Premium e notificações", () => {
  for (const forbidden of [
    "AIInsightsEngine",
    "PremiumReport",
    "sendEmail",
    "nodemailer",
    "OneSignal",
    "Twilio",
    "Telegram",
  ]) {
    assert.equal(combined.includes(forbidden), false, `Integração proibida encontrada: ${forbidden}`);
  }
});
