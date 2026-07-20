import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("src/lib/risk-lab/RiskLabCohortBacktestService.ts", "utf8");
const store = readFileSync("src/lib/risk-lab/RiskLabCohortBacktestStore.ts", "utf8");
const route = readFileSync("src/app/api/system/risk-lab-cohort-backtest/route.ts", "utf8");
const workflow = readFileSync(".github/workflows/risk-lab-cohort-backtest.yml", "utf8");
const series = readFileSync("src/lib/risk-lab/AutomaticDividendSeriesService.ts", "utf8");
const cohort = JSON.parse(readFileSync("src/lib/risk-lab/out-of-sample-cohort-v0.1.json", "utf8"));

function executable(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("matriz externa permanece exatamente pré-registrada", () => {
  assert.deepEqual(
    cohort.cases.map((item) => item.ticker),
    ["DEVA11", "VSLH11", "KNCR11", "KNSC11", "MCCI11", "RBRY11"],
  );
  assert.equal(cohort.metadata.rulesetVersion, "0.1.0");
  assert.equal(cohort.metadata.executionAllowed, false);
  assert.equal(cohort.metadata.status, "pre_registered_pending_primary_verification");
});

test("executor exige evidência completa por observação e proíbe look-ahead", () => {
  for (const field of [
    "knownAt",
    "sourceUrl",
    "excerpt",
    "page",
    "sourceHash",
    "sourceVersion",
    "protocolHash",
    "protocolVersion",
  ]) {
    assert.match(service, new RegExp(field));
  }
  assert.match(service, /sequentialDetector/);
  assert.match(service, /lookAheadDetected/);
  assert.match(service, /EXPECTED_COHORT_HASH/);
  assert.match(service, /rule\.version === "0\.1\.0"/);
  assert.match(service, /falsePositives === 0/);
  assert.match(service, /falseNegatives === 0/);
  assert.match(service, /inconclusiveCases === 0/);
  assert.match(service, /coveragePercent === 100/);
});

test("avisos FNET preservam hash, protocolo, versão, página e primeira data pública", () => {
  assert.match(series, /sourceHash/);
  assert.match(series, /protocolHash/);
  assert.match(series, /protocolVersion:\s*protocol\.version/);
  assert.match(series, /page:\s*1/);
  assert.match(series, /announcedAt:\s*protocol\.deliveredAt/);
  assert.match(series, /automatic_regulatory_validation/);
});

test("execução não pede aprovação técnica manual do proprietário", () => {
  const source = executable(service);
  assert.doesNotMatch(source, /manual_document_review|pending_manual_review|eligibleForCohortPromotion|approve\(/);
  assert.match(source, /ACTOR = "risk-lab-cohort@dadosfii\.internal"/);
  assert.match(source, /sourceExecutionAllowed:\s*false/);
});

test("persistência possui lock, auditoria, hash e isolamento de efeitos externos", () => {
  assert.match(store, /RiskLabCohortBacktestRuns/);
  assert.match(store, /RiskLabCohortBacktestAudit/);
  assert.match(store, /RiskLabCohortBacktestLocks/);
  assert.match(store, /runTransaction/);
  assert.match(service, /evidenceHash:\s*hashValue/);
  assert.match(service, /premiumIntegrated:\s*false/);
  assert.match(service, /notificationsSent:\s*false/);
  assert.doesNotMatch(executable(service), /getPremiumReport|AIInsights|sendEmail|sendNotification|createAlert/);
});

test("rota só executa no deployment exato e workflow versiona resultado automaticamente", () => {
  assert.match(route, /source === "github-actions"/);
  assert.match(route, /release === deployedRelease/);
  assert.match(route, /VERCEL_ENV === "production"/);
  assert.match(route, /RISK_LAB_COHORT_BACKTEST_RUN_ID/);
  assert.match(workflow, /github\.sha/);
  assert.match(workflow, /evidence\.releaseCommit/);
  assert.match(workflow, /docs\/production-evidence\/risk-lab/);
  assert.match(workflow, /gh pr create/);
  assert.match(workflow, /Nenhuma aprovação técnica manual/);
});
