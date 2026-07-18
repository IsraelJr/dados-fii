import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const panel = source("src/app/admin/risk-lab/DividendStressRunPanel.tsx");
const page = source("src/app/admin/risk-lab/stress-runs/page.tsx");
const combined = `${panel}\n${page}`;

test("carregamento inicial consulta apenas o status", () => {
  const effect = panel.match(/useEffect\(\(\) => \{([\s\S]*?)\}, \[\]\)/)?.[1] || "";
  assert.match(effect, /void load\(\)/);
  assert.doesNotMatch(effect, /execute\(/);
  assert.match(panel, /requestJson<StatusResponse>\("\/api\/admin\/system\/risk-lab\/stress-runs"\)/);
});

test("execução exige ação, ticker e confirmação explícita", () => {
  assert.match(panel, /method: "POST"/);
  assert.match(panel, /action: "execute", ticker, confirmed: true/);
  assert.match(panel, /disabled=\{!enabled \|\| !ready \|\| !confirmed \|\| busy\}/);
  assert.match(panel, /type="checkbox"/);
});

test("painel declara ausência de efeitos externos e caráter preliminar", () => {
  assert.match(panel, /Não cria alertas nem notificações/);
  assert.match(panel, /Não altera o Relatório Premium/);
  assert.match(panel, /Classificação sempre preliminar/);
  assert.match(panel, /eventos materiais de crédito ainda não revisados/);
});

test("página é isolada e oferece retorno ao Risk Lab", () => {
  assert.match(page, /DividendStressRunPanel/);
  assert.match(page, /href="\/admin\/risk-lab"/);
  assert.match(page, /Nenhuma ação é disparada automaticamente/);
});

test("interface não acessa Firestore, Premium ou notificadores diretamente", () => {
  for (const forbidden of [
    "firebaseAdmin",
    "adminDb",
    "RiskLabDividendStressRuns",
    "PremiumReport",
    "AIInsightsEngine",
    "sendEmail",
    "nodemailer",
    "OneSignal",
    "Twilio",
    "Telegram",
    "notificationService",
    "portfolioNotification",
  ]) {
    assert.equal(combined.includes(forbidden), false, `Integração proibida encontrada: ${forbidden}`);
  }
});

test("interface usa os status reais do motor", () => {
  assert.match(panel, /recovery_blocked_by_material_credit_event/);
  assert.doesNotMatch(panel, /blocked_by_material_default/);
  assert.doesNotMatch(panel, /insufficient_data/);
});
