import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const route = source("src/app/api/admin/system/risk-lab/stress-runs/route.ts");
const service = source("src/lib/risk-lab/DividendStressRunService.ts");
const store = source("src/lib/risk-lab/DividendStressRunStore.ts");
const noticesRoute = source("src/app/api/admin/system/risk-lab/notices/route.ts");
const panel = source("src/app/admin/risk-lab/FnetNoticeImportPanel.tsx");
const combined = `${route}\n${service}\n${store}`;

test("execução manual exige feature flag e confirmação explícita", () => {
  assert.match(route, /ENABLE_RISK_LAB_STRESS_RUN/);
  assert.match(route, /body\?\.confirmed !== true/);
  assert.match(route, /action !== "execute"/);
  assert.match(route, /risk-lab-stress-run-execute/);
});

test("serviço bloqueia série insuficiente antes de chamar detector", () => {
  const readinessIndex = service.indexOf("readyForStressDetection");
  const detectorIndex = service.indexOf("this.detector.detect");
  assert.ok(readinessIndex >= 0);
  assert.ok(detectorIndex > readinessIndex);
  assert.match(service, /Série insuficiente/);
});

test("execução é identificada pelo snapshot e ruleset", () => {
  assert.match(service, /createHash\("sha256"\)/);
  assert.match(service, /DIVIDEND_STRESS_RULESET_VERSION/);
  assert.match(service, /inputHash\.slice\(0, 24\)/);
  assert.match(service, /getById\(id\)/);
  assert.match(store, /transaction\.create\(reference, run\)/);
});

test("resultado permanece preliminar e sem efeitos externos", () => {
  assert.match(service, /classificationFinal: false/);
  assert.match(service, /material_credit_events_not_reviewed/);
  assert.match(service, /alertsCreated: false/);
  assert.match(service, /notificationsSent: false/);
  assert.match(service, /premiumUpdated: false/);
});

test("coleta e aprovação não executam o detector automaticamente", () => {
  const collectionFlow = `${noticesRoute}\n${panel}`;
  assert.doesNotMatch(collectionFlow, /stress-runs/);
  assert.doesNotMatch(collectionFlow, /DividendStressRunService/);
  assert.doesNotMatch(collectionFlow, /dividendStressWindowEngine/);
  assert.doesNotMatch(collectionFlow, /\.detect\(/);
});

test("rota de execução permanece isolada de Premium e notificações", () => {
  for (const forbidden of [
    "AIInsightsEngine",
    "PremiumReport",
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
