import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("integração 3.7 é protegida, desligada por padrão e auditada no servidor", () => {
  const flags = read("src/lib/featureFlags.ts");
  const service = read("src/lib/regulatoryDataService.ts");
  const route = read("src/app/api/fii/[ticker]/report/premium/route.ts");
  const repository = read("src/lib/regulatory/RegulatoryRepository.ts");
  assert.match(flags, /ENABLE_RISK_LAB_PREMIUM_READONLY/);
  assert.match(service, /featureEnabled\("ENABLE_RISK_LAB_PREMIUM_READONLY", false\)/);
  assert.match(route, /requirePremium/);
  assert.match(route, /auditActor/);
  assert.match(route, /accessPlan/);
  assert.match(repository, /"premium-read"/);
  assert.match(service, /recordAuditEvent\("premium-read"/);
});

test("read model não importa notificações nem permite efeitos externos", () => {
  const model = read("src/lib/risk-lab/RiskLabPremiumReadModel.ts");
  assert.doesNotMatch(model, /AlertDispatcher|AutomaticMonitor|nodemailer|twilio|telegram|sendEmail|fetch\(/i);
  assert.match(model, /notificationsAllowed: false/);
  assert.match(model, /externalEffectsAllowed: false/);
  assert.doesNotMatch(model, /if\s*\([^)]*(DEVA11|VSLH11|KNCR11|KNSC11|MCCI11|RBRY11)/);
});

test("registro versionado contém somente a coorte homologada e preserva MCCI11", () => {
  const registry = JSON.parse(read("src/lib/risk-lab/risk-lab-premium-readonly-v1.json"));
  assert.equal(registry.registryVersion, "premium-readonly-v1");
  assert.equal(registry.rulesetVersion, "0.2.0");
  assert.equal(registry.policy.readOnly, true);
  assert.equal(registry.policy.notificationsAllowed, false);
  assert.equal(registry.policy.externalEffectsAllowed, false);
  assert.deepEqual(registry.cases.map((item) => item.ticker).sort(), ["DEVA11", "KNCR11", "KNSC11", "MCCI11", "RBRY11", "VSLH11"]);
  const mcci = registry.cases.find((item) => item.ticker === "MCCI11");
  assert.equal(mcci.outcome, "inconclusive_unscored");
  assert.equal(mcci.riskAlert, null);
});

test("Premium v3 passa Risk Lab e Modo Gestor à IA como dados imutáveis", () => {
  const ai = read("src/lib/ai/AIInsightsEngine.ts");
  const panel = read("src/app/components/PremiumReportPanel.tsx");
  assert.match(ai, /premium-fund-analysis-v3|PREMIUM_INSIGHTS_PROMPT_VERSION/);
  assert.match(ai, /riskLab: report\.riskLab/);
  assert.match(ai, /managerMode: report\.managerMode/);
  assert.match(ai, /deterministicFieldsAreImmutable: true/);
  assert.match(panel, /Risk Lab — leitura histórica homologada/);
  assert.match(panel, /Modo Gestor — qualidade e limites da decisão/);
});
