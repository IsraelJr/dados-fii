import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const publicRoute = read("src/app/api/system/risk-lab-cohort-backtest/route.ts");
const adminRoute = read("src/app/api/admin/system/risk-lab/cohort-backtest/route.ts");
const client = read("src/app/admin/risk-lab/cohortBacktestClient.ts");
const panel = read("src/app/admin/risk-lab/CohortBacktestPanel.tsx");
const workflow = read(".github/workflows/risk-lab-cohort-backtest.yml");
const service = read("src/lib/risk-lab/SegmentedRiskLabCohortBacktestService.ts");

test("API pública divide a execução em initialize, case e finalize no release exato", () => {
  assert.match(publicRoute, /action === "initialize"/);
  assert.match(publicRoute, /action === "case"/);
  assert.match(publicRoute, /action === "finalize"/);
  assert.match(publicRoute, /parameters\.release === deployedRelease/);
  assert.match(publicRoute, /SEGMENTED_COHORT_TICKERS\.includes\(ticker\)/);
  assert.doesNotMatch(publicRoute, /segmentedRiskLabCohortBacktestService\.run\(\)/);
});

test("API Admin mantém autenticação, coorte fechada e etapas explícitas", () => {
  assert.match(adminRoute, /authorizeAdminRequest/);
  assert.match(adminRoute, /new Set\(\["initialize", "case", "finalize"\]\)/);
  assert.match(adminRoute, /SEGMENTED_COHORT_TICKERS\.includes\(ticker\)/);
  assert.doesNotMatch(adminRoute, /action === "execute"/);
});

test("cliente executa exatamente os seis tickers e persiste progresso entre chamadas", () => {
  for (const ticker of ["DEVA11", "VSLH11", "KNCR11", "KNSC11", "MCCI11", "RBRY11"]) {
    assert.match(client, new RegExp(`"${ticker}"`));
  }
  assert.match(client, /postStage\("initialize"\)/);
  assert.match(client, /postStage\("case", ticker\)/);
  assert.match(client, /postStage\("finalize"\)/);
  assert.match(panel, /progresso já persistido no servidor/);
  assert.doesNotMatch(panel, /confirm\s*\(/i);
});

test("workflow executa fundo a fundo, versiona artefatos e não exige aprovação humana", () => {
  assert.match(workflow, /action=initialize/);
  assert.match(workflow, /tickers=\(DEVA11 VSLH11 KNCR11 KNSC11 MCCI11 RBRY11\)/);
  assert.match(workflow, /action=case&ticker=\$\{ticker\}/);
  assert.match(workflow, /action=finalize/);
  assert.match(workflow, /risk-lab-segmented-cases\/\*\.json/);
  assert.match(workflow, /gh pr merge/);
  assert.doesNotMatch(workflow, /environment:\s*[^\n]+/);
});

test("serviço segmentado é idempotente por ticker e só finaliza com seis casos únicos", () => {
  assert.match(service, /current\.cases\.some\(\(candidate\) => candidate\.ticker === ticker\)/);
  assert.match(service, /cases\.length !== SEGMENTED_COHORT_TICKERS\.length/);
  assert.match(service, /uniqueTickers\.size !== SEGMENTED_COHORT_TICKERS\.length/);
  assert.match(service, /premiumIntegrated: false/);
  assert.match(service, /notificationsSent: false/);
});
