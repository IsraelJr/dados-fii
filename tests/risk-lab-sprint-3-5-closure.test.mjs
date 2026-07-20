import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const SCRIPT = "scripts/finalize-risk-lab-sprint-3-5.mjs";
const HANDOFF_FIXTURE = "tests/fixtures/risk-lab-handoff-pre-3-5.md";
const TICKERS = ["DEVA11", "VSLH11", "KNCR11", "KNSC11", "MCCI11", "RBRY11"];

function validEvidence() {
  const falseNegatives = 2;
  const checks = [
    "deployment.production",
    "cohort.identity",
    "ruleset.frozen",
    "cohort.six-cases",
    "verification.primary-authorized",
    "evidence.primary-complete",
    "look-ahead.none",
    "controls.no-unjustified-alert",
    "metrics.no-false-positive",
    "metrics.performance-measured",
    "metrics.no-inconclusive",
    "metrics.coverage",
    "isolation.external-effects",
  ];
  return {
    schemaVersion: 2,
    sprint: "3.5",
    runId: "risk-lab-3-5-20260720-v2",
    attemptId: "risk-lab-3-5-attempt-20260720161000-abcdef12",
    supersedesRunId: "risk-lab-3-5-20260720-v1",
    previousEvidenceHash: "6".repeat(64),
    methodologyVersion: "2.0.0",
    status: "passed",
    releaseCommit: "1".repeat(40),
    deploymentUrl: "https://dadosfii.com.br",
    environment: "production",
    rulesetVersion: "0.1.0",
    cohortId: "risk-lab-credit-oos-v0.1",
    cohortVersion: "0.1.0",
    cohortIdentityHash: "2".repeat(64),
    sourceExecutionAllowed: true,
    executionAllowed: true,
    performanceReviewRequired: true,
    startedAt: "2026-07-20T10:00:00.000Z",
    completedAt: "2026-07-20T10:10:00.000Z",
    cases: TICKERS.map((ticker, index) => ({
      ticker,
      role: index < 2 ? "severe_deterioration" : index < 4 ? "healthy_control" : "reversible_stress",
      status: "validated",
      outcome: index < 2 ? "false_negative" : index < 4 ? "true_negative" : "true_positive",
      detectorStatus: index < 2 ? "no_qualifying_stress" : index < 4 ? "no_qualifying_stress" : "reversible_stress_confirmed",
      creditScreenStatus: index < 2 ? "material_event_confirmed" : "no_explicit_event_found",
      firstSignalAt: index < 2 ? null : "2024-09-15T18:00:00-03:00",
      leadTimeDays: index < 2 ? null : 30,
      sourceCoveragePercent: 100,
      primaryEvidenceComplete: true,
      lookAheadDetected: false,
      evidence: [{
        observationId: `${ticker}:2024-01`,
        kind: "dividend_notice",
        documentId: `${ticker}-1`,
        knownAt: "2024-01-15T18:00:00-03:00",
        sourceUrl: "https://fnet.bmfbovespa.com.br/documento",
        excerpt: "Evidência primária validada.",
        page: 1,
        sourceHash: "3".repeat(64),
        sourceVersion: "v1",
        protocolHash: "4".repeat(64),
        protocolVersion: 1,
      }],
      blockers: index < 2 ? ["O ruleset não antecipou o evento."] : [],
      structuredBlockers: index < 2 ? [{
        code: "NO_SIGNAL_BEFORE_MATERIAL_EVENT",
        stage: "detector",
        message: "O ruleset não antecipou o evento.",
        sourceUrl: null,
        year: 2024,
      }] : [],
      groundTruth: {
        status: "verified",
        eventAt: index < 2 ? "2024-07-10T18:00:00-03:00" : null,
        stressAt: index >= 4 ? "2024-09-15T18:00:00-03:00" : null,
        recoveryAt: index >= 4 ? "2024-12-15T18:00:00-03:00" : null,
        sourceCoveragePercent: 100,
        dividendObservationCount: 12,
        longestContiguousSequence: 12,
        verificationHash: "7".repeat(64),
        evidence: [{
          observationId: `${ticker}:2024-01`,
          kind: "dividend_notice",
          documentId: `${ticker}-1`,
          knownAt: "2024-01-15T18:00:00-03:00",
          sourceUrl: "https://fnet.bmfbovespa.com.br/documento",
          excerpt: "Evidência primária validada.",
          page: 1,
          sourceHash: "3".repeat(64),
          sourceVersion: "v1",
          protocolHash: "4".repeat(64),
          protocolVersion: 1,
        }],
        blockers: [],
      },
      premiumIntegrated: false,
      notificationsSent: false,
    })),
    metrics: {
      totalCases: 6,
      conclusiveCases: 6,
      truePositives: 2,
      trueNegatives: 2,
      falsePositives: 0,
      falseNegatives,
      inconclusiveCases: 0,
      coveragePercent: 100,
      averageLeadTimeDays: 30,
      minimumLeadTimeDays: 30,
      maximumLeadTimeDays: 30,
    },
    checks: checks.map((id) => ({ id, status: "passed", message: "Gate aprovado.", metadata: {} })),
    blockers: [],
    structuredBlockers: [],
    premiumIntegrated: false,
    notificationsSent: false,
    evidenceHash: "5".repeat(64),
  };
}

function execute(evidence) {
  const directory = mkdtempSync(join(tmpdir(), "risk-lab-3-5-"));
  const evidencePath = join(directory, "evidence.json");
  const handoffPath = join(directory, "DADOS_FII_HANDOFF.md");
  writeFileSync(evidencePath, JSON.stringify(evidence), "utf8");
  cpSync(HANDOFF_FIXTURE, handoffPath);
  const before = readFileSync(handoffPath, "utf8");
  const result = spawnSync(process.execPath, [SCRIPT, evidencePath, handoffPath], { encoding: "utf8" });
  const after = readFileSync(handoffPath, "utf8");
  return { result, before, after };
}

test("evidência metodológica integral atualiza o handoff para a Sprint 3.6", () => {
  const { result, after } = execute(validEvidence());

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"ok":true/);
  assert.match(result.stdout, /"falseNegatives":2/);
  assert.match(after, /\*\*Versão:\*\* 6\.3\.0/);
  assert.match(after, /Sprint corrente canônica: \*\*3\.6/);
  assert.match(after, /Sprint 3\.5 — Coorte externa \(concluída\)/);
  assert.match(after, /100% de cobertura/);
  assert.match(after, /zero falso positivo/);
  assert.match(after, /2 falso\(s\) negativo\(s\) medido\(s\)/);
  assert.match(after, /zero inconclusivo/);
  assert.match(after, new RegExp("5{64}"));
});

test("falso negativo medido não é apagado nem impede o encerramento metodológico", () => {
  const evidence = validEvidence();
  evidence.metrics.falseNegatives = 3;
  evidence.metrics.truePositives = 1;
  const { result, after } = execute(evidence);
  assert.equal(result.status, 0, result.stderr);
  assert.match(after, /3 falso\(s\) negativo\(s\) medido\(s\)/);
});

test("falso positivo em controle impede encerramento e preserva o handoff byte a byte", () => {
  const evidence = validEvidence();
  evidence.metrics.falsePositives = 1;
  const { result, before, after } = execute(evidence);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /há falso positivo/);
  assert.equal(after, before);
});

test("caso sem verdade-terreno primária impede encerramento", () => {
  const evidence = validEvidence();
  evidence.cases[0].groundTruth.status = "blocked";
  evidence.cases[0].primaryEvidenceComplete = false;
  const { result, before, after } = execute(evidence);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /verdade-terreno primária não verificada/);
  assert.equal(after, before);
});

test("release fora de Produção impede encerramento", () => {
  const evidence = validEvidence();
  evidence.environment = "preview";
  const { result, before, after } = execute(evidence);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /não ocorreu em Produção/);
  assert.equal(after, before);
});
