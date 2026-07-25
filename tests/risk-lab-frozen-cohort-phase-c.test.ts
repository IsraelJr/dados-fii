import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFrozenCohortPhaseC,
  buildFrozenTimeline,
  calculateFrozenCohortMetrics,
  hashValue,
  stableValue,
  type FrozenCaseBacktestResult,
} from "@/lib/risk-lab/FrozenCohortPhaseC";
import type { VerifiedDividendNotice } from "@/types/riskLabDividendStress";

const REGISTRY = "src/lib/risk-lab/frozen-cohort-phase-c-v1.json";

function notice(month: string, amount: number, announcedAt: string): VerifiedDividendNotice {
  return {
    ticker: "TEST11",
    competenceMonth: month,
    amountPerShare: amount,
    announcedAt,
    source: {
      documentId: month,
      sourceUrl: `https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=${month.replace("-", "")}`,
      sourceType: "primary_regulatory",
      reviewMethod: "automatic_regulatory_validation",
      reviewedBy: "risk-lab-test",
      reviewedAt: "2026-07-25T00:00:00-03:00",
      page: 1,
      excerpt: `Rendimento ${month}`,
      sourceHash: "a".repeat(64),
      sourceVersion: "1",
      protocolHash: "b".repeat(64),
      protocolVersion: 1,
    },
  };
}

test("stableValue e hashValue não dependem da ordem das chaves", () => {
  assert.deepEqual(stableValue({ z: 1, a: { d: 2, b: 3 } }), { a: { b: 3, d: 2 }, z: 1 });
  assert.equal(hashValue({ z: 1, a: 2 }), hashValue({ a: 2, z: 1 }));
});

test("corte temporal nunca usa anúncio posterior ao asOf", () => {
  const series = [
    notice("2022-01", 1, "2022-02-01T10:00:00-03:00"),
    notice("2022-02", 1, "2022-03-01T10:00:00-03:00"),
    notice("2022-03", 1, "2022-04-01T10:00:00-03:00"),
    notice("2022-04", 1, "2022-05-01T10:00:00-03:00"),
    notice("2022-05", 1, "2022-06-01T10:00:00-03:00"),
    notice("2022-06", 1, "2022-07-01T10:00:00-03:00"),
    notice("2022-07", 0.5, "2022-08-01T10:00:00-03:00"),
    notice("2022-08", 0.5, "2022-09-01T10:00:00-03:00"),
    notice("2022-09", 0.5, "2022-10-01T10:00:00-03:00"),
  ];
  const result = buildFrozenTimeline(series);
  assert.equal(result.lookAheadDetected, false);
  assert.equal(result.points[0].asOf, series[0].announcedAt);
  assert.equal(result.points[0].observationsKnown, 1);
  assert.equal(result.firstSignalAt, series[8].announcedAt);
  assert.equal(result.finalDetector.status, "stress_without_recovery");
});

test("registro adulterado falha fechado antes do backtest", () => {
  const folder = mkdtempSync(path.join(tmpdir(), "phase-c-registry-"));
  try {
    const registry = JSON.parse(readFileSync(REGISTRY, "utf8"));
    registry.cases[0].expectedEvidenceHash = "0".repeat(64);
    const tampered = path.join(folder, "registry.json");
    writeFileSync(tampered, JSON.stringify(registry));
    assert.throws(() => buildFrozenCohortPhaseC(process.cwd(), tampered), /evidenceHash não corresponde/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("a fase 3.5-C não permite calibração silenciosa do ruleset", () => {
  const folder = mkdtempSync(path.join(tmpdir(), "phase-c-ruleset-"));
  try {
    const registry = JSON.parse(readFileSync(REGISTRY, "utf8"));
    registry.rulesetVersion = "0.1.1";
    const tampered = path.join(folder, "registry.json");
    writeFileSync(tampered, JSON.stringify(registry));
    assert.throws(() => buildFrozenCohortPhaseC(process.cwd(), tampered), /não pode alterar o ruleset/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("métricas mantêm inconclusivos fora do denominador de cobertura", () => {
  const base = { leadTimeDays: null } as FrozenCaseBacktestResult;
  const values = [
    { ...base, outcome: "true_positive", leadTimeDays: 10 },
    { ...base, outcome: "true_negative" },
    { ...base, outcome: "false_positive" },
    { ...base, outcome: "inconclusive" },
  ] as FrozenCaseBacktestResult[];
  const result = calculateFrozenCohortMetrics(values);
  assert.equal(result.totalCases, 4);
  assert.equal(result.conclusiveCases, 3);
  assert.equal(result.coveragePercent, 75);
  assert.equal(result.averageLeadTimeDays, 10);
});

test("dataset real dos seis fundos é reproduzível e mede falhas sem escondê-las", () => {
  const run1 = buildFrozenCohortPhaseC();
  const run2 = buildFrozenCohortPhaseC();
  assert.equal(run1.evidenceHash, run2.evidenceHash);
  assert.equal(run1.datasetHash, run2.datasetHash);
  assert.equal(run1.status, "completed_requires_calibration");
  assert.equal(run1.methodologicalBlockers.length, 0);
  assert.equal(run1.observationCount, 318);
  assert.deepEqual(Object.fromEntries(run1.cases.map((item) => [item.ticker, item.outcome])), {
    DEVA11: "true_positive",
    VSLH11: "true_positive",
    KNCR11: "true_negative",
    KNSC11: "false_positive",
    MCCI11: "inconclusive",
    RBRY11: "true_positive",
  });
  assert.deepEqual(run1.metrics, {
    totalCases: 6,
    conclusiveCases: 5,
    truePositives: 3,
    trueNegatives: 1,
    falsePositives: 1,
    falseNegatives: 0,
    inconclusiveCases: 1,
    coveragePercent: 83.33,
    averageLeadTimeDays: run1.metrics.averageLeadTimeDays,
    minimumLeadTimeDays: run1.metrics.minimumLeadTimeDays,
    maximumLeadTimeDays: run1.metrics.maximumLeadTimeDays,
  });
  assert.ok((run1.metrics.averageLeadTimeDays || 0) > 0);
  assert.equal(run1.homologationAllowed, false);
  assert.equal(run1.premiumIntegrated, false);
  assert.equal(run1.notificationsSent, false);
  assert.ok(run1.cases.every((item) => item.lookAheadDetected === false));
});
