import assert from "node:assert/strict";
import test from "node:test";
import {
  SEGMENTED_COHORT_TICKERS,
  SegmentedRiskLabCohortBacktestService,
} from "../src/lib/risk-lab/SegmentedRiskLabCohortBacktestService";
import type {
  CohortBacktestCaseResult,
  RiskLabCohortBacktestEvidence,
} from "../src/types/riskLabCohortBacktest";
import type { OutOfSampleValidationCase } from "../src/types/riskLabValidation";

const RELEASE = "7".repeat(40);
const ORIGINAL_ENV = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
};

process.env.VERCEL_ENV = "production";
process.env.VERCEL_GIT_COMMIT_SHA = RELEASE;
process.env.VERCEL_PROJECT_PRODUCTION_URL = "dadosfii.com.br";

test.after(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

class MemoryStore {
  values = new Map<string, RiskLabCohortBacktestEvidence>();
  latestValue: RiskLabCohortBacktestEvidence | null = null;
  saves: RiskLabCohortBacktestEvidence[] = [];
  locked = false;

  async get(runId: string) {
    return structuredClone(this.values.get(runId) || null);
  }

  async latest() {
    return structuredClone(this.latestValue);
  }

  async acquireLock() {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  async releaseLock() {
    this.locked = false;
  }

  async save(evidence: RiskLabCohortBacktestEvidence) {
    const copy = structuredClone(evidence);
    this.values.set(evidence.runId, copy);
    this.latestValue = copy;
    this.saves.push(copy);
    return structuredClone(copy);
  }
}

function validCase(item: OutOfSampleValidationCase): CohortBacktestCaseResult {
  const healthy = item.role === "healthy_control";
  return {
    ticker: item.ticker,
    role: item.role,
    status: "validated",
    outcome: healthy ? "true_negative" : "true_positive",
    detectorStatus: healthy ? "no_qualifying_stress" : "reversible_stress_confirmed",
    creditScreenStatus: item.role === "severe_deterioration"
      ? "material_event_confirmed"
      : "no_explicit_event_found",
    firstSignalAt: healthy ? null : "2024-06-15T18:00:00-03:00",
    leadTimeDays: healthy ? null : 30,
    sourceCoveragePercent: 100,
    primaryEvidenceComplete: true,
    lookAheadDetected: false,
    evidence: [],
    blockers: [],
    structuredBlockers: [],
    groundTruth: {
      status: "verified",
      eventAt: item.role === "severe_deterioration" ? "2024-07-15T18:00:00-03:00" : null,
      stressAt: item.role === "reversible_stress" ? "2024-06-15T18:00:00-03:00" : null,
      recoveryAt: item.role === "reversible_stress" ? "2024-09-15T18:00:00-03:00" : null,
      sourceCoveragePercent: 100,
      dividendObservationCount: 12,
      longestContiguousSequence: 12,
      verificationHash: "a".repeat(64),
      evidence: [],
      blockers: [],
    },
    premiumIntegrated: false,
    notificationsSent: false,
  };
}

function serviceFixture(overrides: { falsePositiveTicker?: string } = {}) {
  const store = new MemoryStore();
  const calls = new Map<string, number>();
  const executor = {
    async executeCase(item: OutOfSampleValidationCase) {
      calls.set(item.ticker, (calls.get(item.ticker) || 0) + 1);
      const result = validCase(item);
      if (item.ticker === overrides.falsePositiveTicker) {
        result.outcome = "false_positive";
        result.detectorStatus = "reversible_stress_confirmed";
        result.structuredBlockers = [{
          code: "UNJUSTIFIED_CONTROL_SIGNAL",
          stage: "detector",
          message: "Controle saudável recebeu sinal de deterioração.",
          sourceUrl: null,
          year: null,
        }];
      }
      return result;
    },
  };
  const service = new SegmentedRiskLabCohortBacktestService({
    executor,
    store,
    now: () => new Date("2026-07-20T20:00:00-03:00"),
  });
  return { service, store, calls, executor };
}

test("segmenta, persiste e consolida os seis fundos sem perder progresso", async () => {
  const { service, calls } = serviceFixture();
  const initialized = await service.initialize();
  assert.equal(initialized.status, "running");
  assert.equal(initialized.cases.length, 0);

  for (const ticker of [...SEGMENTED_COHORT_TICKERS].reverse()) {
    const progress = await service.runTicker(ticker);
    assert.ok(progress.cases.some((item) => item.ticker === ticker));
  }

  const duplicate = await service.runTicker("DEVA11");
  assert.equal(duplicate.cases.length, 6);
  assert.equal(calls.get("DEVA11"), 1);

  const evidence = await service.finalize();
  assert.equal(evidence.status, "passed");
  assert.equal(evidence.executionAllowed, true);
  assert.equal(evidence.sourceExecutionAllowed, true);
  assert.equal(evidence.cases.map((item) => item.ticker).join(","), SEGMENTED_COHORT_TICKERS.join(","));
  assert.equal(evidence.metrics.totalCases, 6);
  assert.equal(evidence.metrics.conclusiveCases, 6);
  assert.equal(evidence.metrics.coveragePercent, 100);
  assert.equal(evidence.metrics.falsePositives, 0);
  assert.equal(evidence.metrics.inconclusiveCases, 0);
  assert.equal(evidence.blockers.length, 0);
  assert.match(evidence.evidenceHash || "", /^[a-f0-9]{64}$/);
  assert.equal(evidence.premiumIntegrated, false);
  assert.equal(evidence.notificationsSent, false);
});

test("retoma tentativa já inicializada após interrupção sem reexecutar caso persistido", async () => {
  const { service, store, calls, executor } = serviceFixture();
  const first = await service.initialize();
  await service.runTicker("DEVA11");

  const resumedService = new SegmentedRiskLabCohortBacktestService({
    executor,
    store,
    now: () => new Date("2026-07-20T20:05:00-03:00"),
  });
  const resumed = await resumedService.initialize();
  assert.equal(resumed.attemptId, first.attemptId);
  assert.equal(resumed.cases.length, 1);

  await resumedService.runTicker("DEVA11");
  assert.equal(calls.get("DEVA11"), 1);
});

test("não finaliza enquanto os seis casos não estiverem persistidos", async () => {
  const { service } = serviceFixture();
  await service.initialize();
  await service.runTicker("DEVA11");
  await assert.rejects(() => service.finalize(), /Backtest incompleto: 1\/6/);
});

test("rejeita ticker fora da coorte e release divergente", async () => {
  const { service } = serviceFixture();
  await service.initialize();
  await assert.rejects(() => service.runTicker("XPTO11"), /não pertence à coorte/);

  process.env.VERCEL_GIT_COMMIT_SHA = "8".repeat(40);
  await assert.rejects(() => service.runTicker("DEVA11"), /não foi inicializado para o release ativo/);
  process.env.VERCEL_GIT_COMMIT_SHA = RELEASE;
});

test("falso positivo em controle permanece blocker na consolidação", async () => {
  const { service } = serviceFixture({ falsePositiveTicker: "KNCR11" });
  await service.initialize();
  for (const ticker of SEGMENTED_COHORT_TICKERS) await service.runTicker(ticker);
  const evidence = await service.finalize();

  assert.equal(evidence.status, "failed");
  assert.equal(evidence.executionAllowed, false);
  assert.equal(evidence.metrics.falsePositives, 1);
  assert.ok(evidence.blockers.some((item) => item.includes("UNJUSTIFIED_CONTROL_SIGNAL")));
  assert.equal(evidence.checks.find((item) => item.id === "controls.no-unjustified-alert")?.status, "failed");
});
