import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");

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
  assert.match(model, /RISK_LAB_PREMIUM_REGISTRY_SHA256/);
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
  assert.match(panel, /Risco histórico elevado/);
  assert.match(panel, /Recuperação informativa/);
  assert.doesNotMatch(panel, />\{report\.riskLab\.(availability|disposition)\}</);
});

test("manifesto histórico 3.7 preserva insumos congelados e registra fonte agora substituída", () => {
  const manifest = JSON.parse(read("docs/production-evidence/risk-lab/premium-readonly-phase-3-7-manifest.json"));
  for (const [file, expectedHash] of Object.entries(manifest.files)) {
    if (file === "src/lib/risk-lab/RiskLabPremiumReadModel.ts") {
      assert.notEqual(sha256(read(file)), expectedHash, "a política corretiva substituiu o read model histórico");
    } else {
      assert.equal(sha256(read(file)), expectedHash, file);
    }
  }
  const { evidenceHash, ...withoutEvidenceHash } = manifest;
  assert.equal(sha256(`${JSON.stringify(withoutEvidenceHash, null, 2)}\n`), evidenceHash);
  assert.equal(manifest.invariants.readOnly, true);
  assert.equal(manifest.invariants.notificationsAllowed, false);
  assert.equal(manifest.invariants.externalEffectsAllowed, false);
  assert.equal(manifest.invariants.featureFlagDefault, false);
  assert.match(read("src/lib/risk-lab/RiskLabCategoryPolicy.ts"), /risk-lab-category-policy-v1/);
});

test("health check expõe somente estado operacional seguro e imutável", () => {
  const route = read("src/app/api/health/risk-lab-premium/route.ts");
  assert.match(route, /featureEnabled\("ENABLE_RISK_LAB_PREMIUM_READONLY", false\)/);
  assert.match(route, /mode: "read_only"/);
  assert.match(route, /notificationsAllowed: false/);
  assert.match(route, /externalEffectsAllowed: false/);
  assert.match(route, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(route, /status: enabled \? 200 : 503/);
  assert.doesNotMatch(route, /datasetHash|evidenceHash|calibrationReportHash|privateKey|token/i);
});

test("gate de produção reage ao Vercel sem polling e publica status auditável", () => {
  const workflow = read(".github/workflows/risk-lab-premium-production-gate.yml");
  for (const required of [
    "github.event.context == 'Vercel'",
    "github.event.state == 'success'",
    "contains(github.event.branches.*.name, 'main')",
    "payload.deploymentCommit === expectedCommit",
    "payload.enabled === true",
    "payload.mode === \"read_only\"",
    "payload.rulesetVersion === \"0.2.0\"",
    "payload.notificationsAllowed === false",
    "payload.externalEffectsAllowed === false",
    "statuses: write",
    "Risk Lab Premium Production Gate",
    "/statuses/${TARGET_SHA}",
    "steps.validate.outcome == 'success'",
  ]) {
    assert.ok(workflow.includes(required), required);
  }
  assert.match(workflow, /^\s{2}status:\s*$/m);
  assert.match(workflow, /timeout-minutes: 3/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /github\.token/);
  assert.match(workflow, /curl --location --silent --show-error/);
  assert.doesNotMatch(workflow, /\bsleep\s+\d+|\$\(seq\b|while\s+(true|:)/i);
});
