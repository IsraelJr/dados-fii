import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const MANIFEST_PATH = "docs/production-evidence/risk-lab/calibration-phase-3-6-manifest.json";
const OUTPUT = "docs/production-evidence/risk-lab/calibration-phase-3-6";
const RULESET_PATH = "src/lib/risk-lab/risk-lab-ruleset-v0.2.0.json";
const SOURCE_PHASE_C_INDEX = "docs/production-evidence/risk-lab/cohort-phase-c/index.json";

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value)), "utf8").digest("hex");
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function payloadWithoutEvidenceHash(value) {
  const { evidenceHash: _ignored, ...payload } = value;
  return payload;
}

test("artefatos permanentes da Sprint 3.6 existem", () => {
  for (const file of [
    RULESET_PATH,
    `${OUTPUT}/ruleset.json`,
    `${OUTPUT}/candidate-space.json`,
    `${OUTPUT}/calibration-report.json`,
    `${OUTPUT}/index.json`,
    MANIFEST_PATH,
    "docs/risk-lab/sprint-3-6-calibration.md",
    "src/lib/risk-lab/RiskLabRulesetV020.ts",
    "src/lib/risk-lab/FrozenCalibrationPhase36.ts",
    "scripts/build-risk-lab-calibration-phase-3-6.ts",
  ]) {
    assert.equal(existsSync(file), true, `${file} deve existir`);
  }
});

test("manifesto e arquivos da Sprint 3.6 conferem por SHA-256", () => {
  const manifest = readJson(MANIFEST_PATH);
  const ruleset = readJson(`${OUTPUT}/ruleset.json`);
  const sourceRuleset = readJson(RULESET_PATH);
  const candidateSpace = readJson(`${OUTPUT}/candidate-space.json`);
  const report = readJson(`${OUTPUT}/calibration-report.json`);
  const index = readJson(`${OUTPUT}/index.json`);
  const phaseCIndex = readJson(SOURCE_PHASE_C_INDEX);

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.phase, "3.6");
  assert.equal(manifest.status, "complete");
  assert.deepEqual(ruleset, sourceRuleset);
  assert.equal(hashValue(ruleset), manifest.expected.rulesetConfigHash);

  assert.equal(candidateSpace.evidenceHash, manifest.expected.candidateSpaceEvidenceHash);
  assert.equal(hashValue(payloadWithoutEvidenceHash(candidateSpace)), candidateSpace.evidenceHash);
  assert.equal(report.evidenceHash, manifest.expected.reportEvidenceHash);
  assert.equal(hashValue(payloadWithoutEvidenceHash(report)), report.evidenceHash);
  assert.equal(hashValue(report), manifest.expected.reportFileHash);
  assert.equal(index.evidenceHash, manifest.expected.indexEvidenceHash);
  assert.equal(hashValue(payloadWithoutEvidenceHash(index)), index.evidenceHash);
  assert.equal(index.sourcePhaseCIndexEvidenceHash, phaseCIndex.evidenceHash);
  assert.equal(index.execution.hashesMatch, true);
  assert.equal(index.execution.run1.evidenceHash, index.execution.run2.evidenceHash);
  assert.equal(index.execution.run1.reportHash, index.execution.run2.reportHash);
  assert.equal(index.execution.run1.rulesetConfigHash, index.execution.run2.rulesetConfigHash);
});

test("ruleset v0.2.0 preserva o dataset e congela a seleção reproduzida", () => {
  const manifest = readJson(MANIFEST_PATH);
  const ruleset = readJson(`${OUTPUT}/ruleset.json`);
  const candidateSpace = readJson(`${OUTPUT}/candidate-space.json`);
  const report = readJson(`${OUTPUT}/calibration-report.json`);

  assert.equal(ruleset.rulesetVersion, "0.2.0");
  assert.equal(ruleset.sourceRulesetVersion, "0.1.0");
  assert.equal(ruleset.dataset.hash, "f18f61b7ddb5cc63955fa9791c6e5e3e43552134aaa28a9dd622a96ee587fcae");
  assert.equal(ruleset.dataset.cohortIdentityHash, "97a3fc3bea0adde463ee3a8d06a9e40a6e90dc0f22303bad85e3dd488bfb7726");
  assert.deepEqual(ruleset.structure, { baselineMonths: 6, stressMonths: 3, recoveryMonths: 3 });
  assert.deepEqual(ruleset.candidateSpace.stressThresholds, [0.8]);
  assert.equal(ruleset.candidateSpace.recoveryThresholds.length, 10);
  assert.equal(ruleset.candidateSpace.recoveryThresholds[0], 0.81);
  assert.equal(ruleset.candidateSpace.recoveryThresholds.at(-1), 0.9);
  assert.equal(ruleset.candidateSpace.minimumRecoveryDecisionMargin, 0.005);
  assert.deepEqual(ruleset.selectedParameters, { stressThreshold: 0.8, recoveryThreshold: 0.89 });
  assert.equal(candidateSpace.candidates.length, 10);
  assert.equal(report.datasetHash, ruleset.dataset.hash);
  assert.equal(report.cohortIdentityHash, ruleset.dataset.cohortIdentityHash);
  assert.deepEqual(report.selectedParameters, {
    stressThreshold: 0.8,
    recoveryThreshold: 0.89,
    minimumRecoveryDecisionMargin: 0.005,
  });
  assert.deepEqual(manifest.expected.selectedParameters, report.selectedParameters);
});

test("homologação mantém cinco casos verificáveis corretos e MCCI11 inconclusivo", () => {
  const manifest = readJson(MANIFEST_PATH);
  const report = readJson(`${OUTPUT}/calibration-report.json`);
  const outcomes = Object.fromEntries(report.cases.map((item) => [item.ticker, item.outcome]));
  const dispositions = Object.fromEntries(report.cases.map((item) => [item.ticker, item.disposition]));

  assert.equal(report.status, "homologated");
  assert.equal(report.homologationAllowed, true);
  assert.deepEqual(report.blockers, []);
  assert.deepEqual(report.metrics, {
    totalCases: 6,
    verifiedCases: 5,
    correctVerified: 5,
    inconclusiveCases: 1,
    verifiedAccuracyPercent: 100,
    coveragePercent: 83.33,
    falsePositives: 0,
    falseNegatives: 0,
    riskAlerts: 2,
    informationalRecoveries: 2,
    noSignalCases: 2,
  });
  assert.deepEqual(outcomes, {
    DEVA11: "verified_correct",
    VSLH11: "verified_correct",
    KNCR11: "verified_correct",
    KNSC11: "verified_correct",
    MCCI11: "inconclusive_unscored",
    RBRY11: "verified_correct",
  });
  assert.deepEqual(dispositions, {
    DEVA11: "elevated_risk",
    VSLH11: "elevated_risk",
    KNCR11: "none",
    KNSC11: "informational_recovery",
    MCCI11: "none",
    RBRY11: "informational_recovery",
  });
  assert.deepEqual(manifest.expected.outcomes, outcomes);
  assert.deepEqual(manifest.expected.dispositions, dispositions);
  const mcci = report.cases.find((item) => item.ticker === "MCCI11");
  assert.equal(mcci.scored, false);
  assert.equal(mcci.correct, null);
  assert.equal(mcci.groundTruthStatus, "blocked");
});

test("todos os folds fora da amostra são estáveis, corretos e sem look-ahead", () => {
  const manifest = readJson(MANIFEST_PATH);
  const report = readJson(`${OUTPUT}/calibration-report.json`);
  assert.equal(report.leaveOneCaseOut.length, 5);
  for (const fold of report.leaveOneCaseOut) {
    assert.equal(fold.selectedRecoveryThreshold, 0.89);
    assert.equal(fold.selectedCandidateStable, true);
    assert.equal(fold.holdoutCorrect, true);
    assert.equal(fold.trainingCorrect, fold.trainingVerified);
  }
  assert.deepEqual(manifest.expected.foldThresholds, {
    DEVA11: 0.89,
    VSLH11: 0.89,
    KNCR11: 0.89,
    KNSC11: 0.89,
    RBRY11: 0.89,
  });
  assert.ok(report.cases.every((item) => item.lookAheadDetected === false));
  assert.ok(report.checks.every((item) => item.status === "passed"));
});

test("homologação metodológica não produz efeitos externos", () => {
  const ruleset = readJson(`${OUTPUT}/ruleset.json`);
  const report = readJson(`${OUTPUT}/calibration-report.json`);
  const index = readJson(`${OUTPUT}/index.json`);
  assert.equal(ruleset.policy.externalEffectsAllowed, false);
  assert.equal(report.premiumIntegrated, false);
  assert.equal(report.notificationsSent, false);
  assert.equal(index.result.premiumIntegrated, false);
  assert.equal(index.result.notificationsSent, false);
  assert.ok(report.cases.every((item) => item.externalEffectsAllowed === false));
});
