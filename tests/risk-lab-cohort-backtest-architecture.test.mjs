import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("src/lib/risk-lab/RiskLabCohortBacktestV2Service.ts", "utf8");
const verifier = readFileSync("src/lib/risk-lab/CohortPrimaryVerificationService.ts", "utf8");
const store = readFileSync("src/lib/risk-lab/RiskLabCohortBacktestStore.ts", "utf8");
const route = readFileSync("src/app/api/system/risk-lab-cohort-backtest/route.ts", "utf8");
const adminRoute = readFileSync("src/app/api/admin/system/risk-lab/cohort-backtest/route.ts", "utf8");
const planner = readFileSync("src/lib/risk-lab/RiskLabCohortAdvancePlanner.ts", "utf8");
const workflow = readFileSync(".github/workflows/risk-lab-cohort-backtest.yml", "utf8");
const series = readFileSync("src/lib/risk-lab/AutomaticDividendSeriesService.ts", "utf8");
const cohort = JSON.parse(readFileSync("src/lib/risk-lab/out-of-sample-cohort-v0.1.json", "utf8"));

function executable(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*(?:\/\/|#).*$/gm, "");
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

test("verdade-terreno é verificada antes do detector e possui hash independente", () => {
  assert.match(service, /this\.verifier\.verify/);
  assert.match(service, /groundTruth\.status === "verified"\s*\?\s*sequentialDetector/);
  assert.match(verifier, /derivePrimaryStressTruth/);
  assert.doesNotMatch(executable(verifier), /dividendStressWindowEngine/);
  assert.match(verifier, /verificationHash:\s*hashValue/);
  assert.match(service, /verification\.primary-authorized/);
  assert.match(service, /sourceExecutionAllowed:\s*primaryAuthorized/);
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
  assert.match(service, /inconclusiveCases === 0/);
  assert.match(service, /coveragePercent === 100/);
});

test("falso negativo é medido sem recalibrar o ruleset na mesma coorte", () => {
  assert.match(service, /metrics\.performance-measured/);
  assert.match(service, /performanceReviewRequired:\s*resultMetrics\.falseNegatives > 0/);
  assert.doesNotMatch(executable(service), /resultMetrics\.falseNegatives === 0/);
  assert.match(service, /NO_SIGNAL_BEFORE_MATERIAL_EVENT/);
  assert.match(service, /REVERSIBLE_STRESS_NOT_REPRODUCED/);
  assert.match(service, /if \(!referenceAt \|\| !firstSignalAt\) return null/);
});

test("avisos FNET preservam hash, protocolo, versão, página e primeira data pública", () => {
  assert.match(series, /sourceHash/);
  assert.match(series, /protocolHash/);
  assert.match(series, /protocolVersion:\s*protocol\.version/);
  assert.match(series, /page:\s*1/);
  assert.match(series, /announcedAt:\s*protocol\.deliveredAt/);
  assert.match(series, /automatic_regulatory_validation/);
  assert.match(series, /MAX_DOCUMENTS_PER_YEAR/);
});

test("execução não pede aprovação técnica manual do proprietário", () => {
  const source = executable(service);
  assert.doesNotMatch(source, /manual_document_review|pending_manual_review|eligibleForCohortPromotion|approve\(/);
  assert.match(source, /ACTOR = "risk-lab-cohort-v2@dadosfii\.internal"/);
  assert.match(source, /methodologyVersion:\s*"2\.0\.0"/);
});

test("persistência possui tentativa imutável, lock, auditoria, hash e isolamento", () => {
  assert.match(store, /RiskLabCohortBacktestRuns/);
  assert.match(store, /RiskLabCohortBacktestAttempts/);
  assert.match(store, /batch\.create\(db\.collection\(ATTEMPT_COLLECTION\)/);
  assert.match(store, /RiskLabCohortBacktestAudit/);
  assert.match(store, /RiskLabCohortBacktestLocks/);
  assert.match(store, /runTransaction/);
  assert.match(service, /previousEvidenceHash/);
  assert.match(service, /evidenceHash:\s*hashValue/);
  assert.match(service, /premiumIntegrated:\s*false/);
  assert.match(service, /notificationsSent:\s*false/);
  assert.doesNotMatch(executable(service), /getPremiumReport|AIInsights|sendEmail|sendNotification|createAlert/);
});

test("rota protege o release e o GitHub somente inicia uma tentativa persistida", () => {
  assert.match(route, /parameters\.source === "github-actions"/);
  assert.match(route, /parameters\.release === deployedRelease/);
  assert.match(route, /VERCEL_ENV === "production"/);
  assert.match(workflow, /risk-lab-3-5-20260720-v2/);
  assert.match(workflow, /inputs\.release_sha/);
  assert.match(workflow, /evidence\.releaseCommit == \$release/);
  assert.match(workflow, /action=initialize/);
  assert.equal((workflow.match(/curl\b/g) || []).length, 1);
  assert.doesNotMatch(executable(workflow), /action=case|action=finalize|git\s+push|gh\s+pr|sleep|npm run test/);
});

test("continuação automática de baixo nível pertence ao backend e ao planner puro", () => {
  assert.match(adminRoute, /planRiskLabCohortAdvance/);
  assert.match(planner, /tickers\.find/);
  assert.match(planner, /action: "initialize"/);
  assert.match(planner, /action: "case"/);
  assert.match(planner, /action: "finalize"/);
  assert.match(planner, /action: "noop"/);
  assert.match(adminRoute, /nextAction/);
  assert.doesNotMatch(executable(`${adminRoute}\n${planner}`), /git\s+push|github-actions|deploy-trigger|sendEmail|sendNotification/);
});
