import assert from "node:assert/strict";
import test from "node:test";
import { decidePublicEvidenceStatus } from "../src/lib/risk-lab/PublicRiskLabEvidenceContract";
import type { PublicRiskLabCohortBacktestEvidence } from "../src/types/riskLabCohortBacktest";

const release = "a".repeat(40);
const runId = "risk-lab-3-5-20260720-v2";

function evidence(status: "running" | "passed" | "failed"): PublicRiskLabCohortBacktestEvidence {
  return {
    schemaVersion: 2,
    sprint: "3.5",
    runId,
    attemptId: "attempt-1",
    methodologyVersion: "2.0.0",
    status,
    releaseCommit: release,
    deploymentUrl: "https://dadosfii.com.br",
    environment: "production",
    rulesetVersion: "0.1.0",
    cohortId: "risk-lab-credit-oos-v0.1",
    cohortVersion: "0.1.0",
    cohortIdentityHash: "b".repeat(64),
    sourceExecutionAllowed: false,
    executionAllowed: false,
    startedAt: "2026-07-20T00:00:00.000Z",
    completedAt: status === "running" ? null : "2026-07-20T01:00:00.000Z",
    cases: [],
    metrics: {
      totalCases: 0,
      conclusiveCases: 0,
      truePositives: 0,
      trueNegatives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      inconclusiveCases: 0,
      coveragePercent: 0,
      averageLeadTimeDays: null,
      minimumLeadTimeDays: null,
      maximumLeadTimeDays: null,
    },
    checks: [],
    blockers: [],
    premiumIntegrated: false,
    notificationsSent: false,
    evidenceHash: status === "running" ? null : "c".repeat(64),
    evidenceUrl: "/api/system/risk-lab-cohort-backtest",
  };
}

test("evidência ausente ou obsoleta nunca retorna sucesso", () => {
  assert.deepEqual(decidePublicEvidenceStatus(null, release, runId, null), {
    statusCode: 404,
    status: "not-found",
    ok: false,
  });
  assert.equal(decidePublicEvidenceStatus(evidence("passed"), "d".repeat(40), runId, null).statusCode, 409);
  assert.equal(decidePublicEvidenceStatus(evidence("passed"), release, "old-run", null).statusCode, 409);
});

test("[REG-DEF-01] falha interna não pode ser mascarada por HTTP 200", () => {
  assert.deepEqual(decidePublicEvidenceStatus(evidence("failed"), release, runId, release), {
    statusCode: 422,
    status: "failed",
    ok: false,
  });
  assert.equal(decidePublicEvidenceStatus(evidence("running"), release, runId, release).statusCode, 202);
});

test("somente evidência aprovada do release ativo retorna HTTP 200", () => {
  assert.deepEqual(decidePublicEvidenceStatus(evidence("passed"), release, runId, release), {
    statusCode: 200,
    status: "passed",
    ok: true,
  });
});
