import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const MANIFEST_PATH = "docs/production-evidence/risk-lab/cohort-phase-c-manifest.json";
const ROOT = "docs/production-evidence/risk-lab/cohort-phase-c";
const INDEX_PATH = `${ROOT}/index.json`;
const REGISTRY_PATH = `${ROOT}/registry.json`;
const DATASET_PATH = `${ROOT}/dataset-index.json`;
const REPORT_PATH = `${ROOT}/backtest-report.json`;
const DOSSIER_PATH = "docs/risk-lab/sprint-3-5-c-dataset-backtest.md";

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, stableValue(item)]));
}
function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value)), "utf8").digest("hex");
}
function read(path) { return JSON.parse(readFileSync(path, "utf8")); }

function load() {
  return {
    manifest: read(MANIFEST_PATH),
    index: read(INDEX_PATH),
    registry: read(REGISTRY_PATH),
    dataset: read(DATASET_PATH),
    report: read(REPORT_PATH),
  };
}

test("manifesto, índice, registro, dataset e relatório possuem hashes reproduzíveis", () => {
  const { manifest, index, registry, dataset, report } = load();
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.phase, "3.5-C");
  assert.equal(manifest.status, "complete");
  assert.equal(hashValue(registry), manifest.expected.registryHash);

  const datasetCore = { ...dataset };
  delete datasetCore.datasetIndexHash;
  assert.equal(hashValue(datasetCore), dataset.datasetIndexHash);
  assert.equal(dataset.datasetIndexHash, manifest.expected.datasetIndexHash);

  const reportCore = { ...report };
  delete reportCore.evidenceHash;
  assert.equal(hashValue(reportCore), report.evidenceHash);
  assert.equal(report.evidenceHash, manifest.expected.backtestEvidenceHash);
  assert.equal(hashValue(report), manifest.expected.backtestReportHash);

  const indexCore = { ...index };
  delete indexCore.evidenceHash;
  assert.equal(hashValue(indexCore), index.evidenceHash);
  assert.equal(index.evidenceHash, manifest.expected.indexEvidenceHash);
  assert.equal(index.files.registry.hash, manifest.expected.registryHash);
  assert.equal(index.files.dataset.hash, manifest.expected.datasetIndexHash);
  assert.equal(index.files.backtest.hash, manifest.expected.backtestReportHash);
});

test("duas execuções independentes geraram o mesmo dataset e relatório", () => {
  const { index } = load();
  assert.equal(index.execution.runs, 2);
  assert.equal(index.execution.hashesMatch, true);
  assert.deepEqual(index.execution.run1, index.execution.run2);
  assert.match(index.execution.run1.datasetHash, /^[a-f0-9]{64}$/);
  assert.match(index.execution.run1.evidenceHash, /^[a-f0-9]{64}$/);
});

test("os seis fundos e as 318 observações compõem o dataset imutável", () => {
  const { manifest, dataset, report } = load();
  assert.equal(dataset.observationCount, 318);
  assert.equal(report.observationCount, 318);
  assert.equal(manifest.expected.observationCount, 318);
  assert.deepEqual(dataset.cases.map((item) => item.ticker), [
    "DEVA11", "VSLH11", "KNCR11", "KNSC11", "MCCI11", "RBRY11",
  ]);
  assert.deepEqual(dataset.cases.map((item) => item.observations), [65, 64, 48, 48, 46, 47]);
  assert.equal(dataset.datasetHash, report.datasetHash);
  assert.equal(dataset.datasetHash, manifest.expected.datasetHash);
  assert.equal(dataset.cohortIdentityHash, report.cohortIdentityHash);
  assert.equal(dataset.cohortIdentityHash, manifest.expected.cohortIdentityHash);
  for (const item of dataset.cases) {
    assert.equal(existsSync(item.indexPath), true, `${item.indexPath} deve existir`);
    assert.match(item.indexEvidenceHash, /^[a-f0-9]{64}$/);
    assert.match(item.combinedObservationsHash, /^[a-f0-9]{64}$/);
  }
});

test("backtest registra resultado honesto sem calibrar o ruleset", () => {
  const { manifest, report } = load();
  const outcomes = Object.fromEntries(report.cases.map((item) => [item.ticker, item.outcome]));
  assert.deepEqual(outcomes, {
    DEVA11: "true_positive",
    VSLH11: "true_positive",
    KNCR11: "true_negative",
    KNSC11: "false_positive",
    MCCI11: "inconclusive",
    RBRY11: "true_positive",
  });
  assert.deepEqual(outcomes, manifest.expected.outcomes);
  assert.deepEqual(report.metrics, manifest.expected.metrics);
  assert.deepEqual(report.metrics, {
    totalCases: 6,
    conclusiveCases: 5,
    truePositives: 3,
    trueNegatives: 1,
    falsePositives: 1,
    falseNegatives: 0,
    inconclusiveCases: 1,
    coveragePercent: 83.33,
    averageLeadTimeDays: report.metrics.averageLeadTimeDays,
    minimumLeadTimeDays: report.metrics.minimumLeadTimeDays,
    maximumLeadTimeDays: report.metrics.maximumLeadTimeDays,
  });
  assert.equal(report.status, "completed_requires_calibration");
  assert.equal(report.rulesetVersion, "0.1.0");
  assert.equal(report.calibrationRequired, true);
  assert.equal(report.homologationAllowed, false);
  assert.ok(report.performanceFindings.some((item) => item.includes("KNSC11: falso positivo")));
  assert.ok(report.performanceFindings.some((item) => item.includes("MCCI11: inconclusivo")));
});

test("nenhuma informação futura ou efeito de produto entrou no resultado", () => {
  const { report } = load();
  assert.equal(report.methodologicalBlockers.length, 0);
  assert.ok(report.methodologyChecks.every((item) => item.status === "passed"));
  assert.ok(report.cases.every((item) => item.lookAheadDetected === false));
  assert.ok(report.cases.every((item) => item.premiumIntegrated === false));
  assert.ok(report.cases.every((item) => item.notificationsSent === false));
  assert.equal(report.premiumIntegrated, false);
  assert.equal(report.notificationsSent, false);
});

test("dossiê documenta limitações, calibração e bloqueio de integração", () => {
  const dossier = readFileSync(DOSSIER_PATH, "utf8");
  for (const required of [
    "completed_requires_calibration",
    "KNSC11",
    "falso positivo",
    "MCCI11",
    "inconclusivo",
    "83,33%",
    "ruleset v0.1.0",
    "Premium",
    "notificações",
    "Sprint 3.6",
  ]) assert.match(dossier, new RegExp(required, "i"));
});

test("não restam sondas, workflows ou scripts temporários da fase", () => {
  const temporary = [
    ".github/workflows/risk-lab-cohort-primary-truth-diagnostic.yml",
    ".github/workflows/risk-lab-cohort-primary-truth-pr.yml",
    ".github/workflows/risk-lab-cohort-dividend-windows.yml",
    ".github/workflows/risk-lab-critical-pdf-diagnostic.yml",
    ".github/workflows/risk-lab-targeted-primary-pdfs.yml",
    ".github/workflows/risk-lab-missing-primary-pdfs-retry.yml",
    ".github/workflows/risk-lab-phase-c-materialize.yml",
    "scripts/diagnose-risk-lab-cohort-primary-truth.ts",
    "scripts/diagnose-risk-lab-cohort-dividend-windows.ts",
    "scripts/diagnose-risk-lab-critical-pdfs.mjs",
    "scripts/diagnose-risk-lab-targeted-primary-pdfs.mjs",
    "scripts/retry-risk-lab-missing-primary-pdfs.mjs",
  ];
  for (const file of temporary) assert.equal(existsSync(file), false, `${file} deve ter sido removido`);
});
