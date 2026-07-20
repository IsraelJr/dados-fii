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
  const evidence = {
    schemaVersion: 1,
    sprint: "3.5",
    runId: "risk-lab-3-5-20260720-v1",
    status: "passed",
    releaseCommit: "1".repeat(40),
    deploymentUrl: "https://dadosfii.com.br",
    environment: "production",
    rulesetVersion: "0.1.0",
    cohortId: "risk-lab-credit-oos-v0.1",
    cohortVersion: "0.1.0",
    cohortIdentityHash: "2".repeat(64),
    sourceExecutionAllowed: false,
    executionAllowed: true,
    startedAt: "2026-07-20T10:00:00.000Z",
    completedAt: "2026-07-20T10:10:00.000Z",
    cases: TICKERS.map((ticker, index) => ({
      ticker,
      role: index < 2 ? "severe_deterioration" : index < 4 ? "healthy_control" : "reversible_stress",
      status: "validated",
      outcome: index === 2 || index === 3 ? "true_negative" : "true_positive",
      detectorStatus: index < 2 ? null : index < 4 ? "no_qualifying_stress" : "reversible_stress_confirmed",
      creditScreenStatus: index < 2 ? "material_event_confirmed" : "no_explicit_event_found",
      leadTimeDays: 30,
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
      blockers: [],
      premiumIntegrated: false,
      notificationsSent: false,
    })),
    metrics: {
      totalCases: 6,
      conclusiveCases: 6,
      truePositives: 4,
      trueNegatives: 2,
      falsePositives: 0,
      falseNegatives: 0,
      inconclusiveCases: 0,
      coveragePercent: 100,
      averageLeadTimeDays: 30,
      minimumLeadTimeDays: 30,
      maximumLeadTimeDays: 30,
    },
    checks: Array.from({ length: 12 }, (_, index) => ({
      id: `check-${index + 1}`,
      status: "passed",
      message: "Gate aprovado.",
      metadata: {},
    })),
    blockers: [],
    premiumIntegrated: false,
    notificationsSent: false,
    evidenceHash: "5".repeat(64),
  };
  return evidence;
}

function execute(evidence) {
  const directory = mkdtempSync(join(tmpdir(), "risk-lab-3-5-"));
  const evidencePath = join(directory, "evidence.json");
  const handoffPath = join(directory, "DADOS_FII_HANDOFF.md");
  writeFileSync(evidencePath, JSON.stringify(evidence), "utf8");
  cpSync(HANDOFF_FIXTURE, handoffPath);
  const before = readFileSync(handoffPath, "utf8");
  const result = spawnSync(process.execPath, [SCRIPT, evidencePath, handoffPath], {
    encoding: "utf8",
  });
  const after = readFileSync(handoffPath, "utf8");
  return { result, before, after };
}

test("evidência integral atualiza o handoff para a Sprint 3.6", () => {
  const { result, after } = execute(validEvidence());

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"ok":true/);
  assert.match(after, /\*\*Versão:\*\* 6\.3\.0/);
  assert.match(after, /Sprint corrente canônica: \*\*3\.6/);
  assert.match(after, /Sprint 3\.5 — Coorte externa \(concluída\)/);
  assert.match(after, /100% de cobertura/);
  assert.match(after, /zero falso positivo/);
  assert.match(after, /zero falso negativo/);
  assert.match(after, /zero inconclusivo/);
  assert.match(after, new RegExp("5{64}"));
});

test("falso positivo impede encerramento e preserva o handoff byte a byte", () => {
  const evidence = validEvidence();
  evidence.metrics.falsePositives = 1;
  const { result, before, after } = execute(evidence);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /há falso positivo/);
  assert.equal(after, before);
});

test("caso sem evidência primária impede encerramento", () => {
  const evidence = validEvidence();
  evidence.cases[0].primaryEvidenceComplete = false;
  evidence.cases[0].evidence = [];
  const { result, before, after } = execute(evidence);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /evidência primária incompleta/);
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
