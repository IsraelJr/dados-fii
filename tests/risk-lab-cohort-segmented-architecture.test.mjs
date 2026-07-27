import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const publicRoute = read("src/app/api/system/risk-lab-cohort-backtest/route.ts");
const adminRoute = read("src/app/api/admin/system/risk-lab/cohort-backtest/route.ts");
const planner = read("src/lib/risk-lab/RiskLabCohortAdvancePlanner.ts");
const client = read("src/app/admin/risk-lab/cohortBacktestClient.ts");
const panel = read("src/app/admin/risk-lab/CohortBacktestPanel.tsx");
const workflow = read(".github/workflows/risk-lab-cohort-backtest.yml");
const service = read("src/lib/risk-lab/SegmentedRiskLabCohortBacktestService.ts");

function executable(source) {
  return source.replace(/^\s*#.*$/gm, "");
}

test("API pública publica evidência sem executar nenhuma etapa", () => {
  assert.match(publicRoute, /forbiddenMutation/);
  assert.match(publicRoute, /decidePublicEvidenceStatus/);
  assert.match(publicRoute, /getPublicEvidence/);
  assert.doesNotMatch(publicRoute, /\.initialize\(\)|\.runTicker\(|\.finalize\(\)|SEGMENTED_COHORT_TICKERS/);
});

test("API Admin mantém autenticação, coorte fechada e avanço delegado", () => {
  assert.match(adminRoute, /authorizeAdminRequest/);
  assert.match(adminRoute, /requireGithubActionsProductionIdentity/);
  assert.match(adminRoute, /new Set\(\["initialize", "case", "finalize", "advance"\]\)/);
  assert.match(adminRoute, /SEGMENTED_COHORT_TICKERS\.includes\(ticker\)/);
  assert.match(adminRoute, /action === "advance"/);
  assert.match(adminRoute, /planRiskLabCohortAdvance/);
  assert.match(planner, /tickers\.find/);
  assert.doesNotMatch(adminRoute, /action === "execute"/);
});

test("cliente existente executa seis tickers sem aprovação manual e persiste progresso", () => {
  for (const ticker of ["DEVA11", "VSLH11", "KNCR11", "KNSC11", "MCCI11", "RBRY11"]) {
    assert.match(client, new RegExp(`"${ticker}"`));
  }
  assert.match(client, /postStage\("initialize"\)/);
  assert.match(client, /postStage\("case", ticker\)/);
  assert.match(client, /postStage\("finalize"\)/);
  assert.match(panel, /progresso já persistido no servidor/);
  assert.doesNotMatch(panel, /confirm\s*\(/i);
});

test("GitHub somente inicia a tentativa e não executa fundos ou formaliza evidência", () => {
  const source = executable(workflow);
  assert.match(workflow, /"action":"initialize"/);
  assert.match(workflow, /^\s{2}workflow_dispatch:/m);
  assert.match(workflow, /inputs\.release_sha/);
  assert.match(workflow, /getIDToken\("dados-fii-risk-lab-operation"\)/);
  assert.equal((workflow.match(/curl\b/g) || []).length, 1);
  assert.doesNotMatch(source, /action=case|action=finalize/);
  assert.doesNotMatch(source, /DEVA11|VSLH11|KNCR11|KNSC11|MCCI11|RBRY11/);
  assert.doesNotMatch(source, /git\s+(commit|push)|gh\s+pr|sleep|for\s+attempt/);
});

test("serviço segmentado é idempotente por ticker e só finaliza com seis casos únicos", () => {
  assert.match(service, /current\.cases\.some\(\(candidate\) => candidate\.ticker === ticker\)/);
  assert.match(service, /cases\.length !== SEGMENTED_COHORT_TICKERS\.length/);
  assert.match(service, /uniqueTickers\.size !== SEGMENTED_COHORT_TICKERS\.length/);
  assert.match(service, /premiumIntegrated: false/);
  assert.match(service, /notificationsSent: false/);
});
