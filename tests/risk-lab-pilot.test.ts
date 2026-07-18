import assert from "node:assert/strict";
import test from "node:test";
import { BacktestEngine } from "../src/lib/risk-lab/BacktestEngine";
import { RiskRuleEngine } from "../src/lib/risk-lab/RuleEngine";
import { PILOT_RISK_RULES } from "../src/lib/risk-lab/rules";
import type { MetricObservation, RiskFamily, RiskSnapshot } from "../src/types/riskLab";

const engine = new BacktestEngine(new RiskRuleEngine(PILOT_RISK_RULES));

function metric(metric: string, value: MetricObservation["value"], knownAt: string, confidence = 100): MetricObservation {
  return {
    metric,
    value,
    competenceDate: knownAt,
    knownAt,
    confidence,
    evidence: [{ documentId: `${metric}-${knownAt}`, classification: "confirmed" }],
  };
}

function snapshot(ticker: string, family: RiskFamily, asOf: string, structuralRiskScore: number, values: Record<string, MetricObservation["value"]>): RiskSnapshot {
  return {
    ticker,
    family,
    asOf,
    structuralRiskScore,
    observations: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, metric(key, value, asOf)])),
  };
}

test("HCTR11 pilot reproduces prudential yellow, orange and red without future data", () => {
  const result = engine.run([
    snapshot("HCTR11", "credit_high_yield", "2020-07-31T23:59:59-03:00", 90, {
      currentAssetsPercent: 100,
      graceAssetsPercent: 0,
      defaultedAssetsPercent: 0,
      cashResultPerShare: 1,
      dividendPerShare: 0.9,
    }),
    snapshot("HCTR11", "credit_high_yield", "2024-11-30T23:59:59-03:00", 95, {
      currentAssetsPercent: 17,
      graceAssetsPercent: 77,
      defaultedAssetsPercent: 6,
      cashResultPerShare: 0.32,
      dividendPerShare: 0.37,
    }),
    snapshot("HCTR11", "credit_high_yield", "2024-12-12T23:59:59-03:00", 95, {
      currentAssetsPercent: 17,
      graceAssetsPercent: 77,
      defaultedAssetsPercent: 6,
      cashResultPerShare: 0,
      dividendPerShare: 0.37,
    }),
  ]);

  assert.equal(result.rows[0].structuralRisk, "very_high");
  assert.equal(result.rows[0].deteriorationAlert, "green");
  assert.equal(result.rows[0].prudentialAlert, "yellow");
  assert.equal(result.rows[1].deteriorationAlert, "orange");
  assert.equal(result.rows[2].deteriorationAlert, "red");
});

test("TGAR11 pilot reproduces green, yellow and orange stages", () => {
  const result = engine.run([
    snapshot("TGAR11", "development_equity", "2024-03-31T23:59:59-03:00", 75, {
      semesterCashResultPerShare: 1.41,
      semesterDistributionsPerShare: 1.33,
      reservePerShare: 0.1,
      cashResultPerShare: 1.41,
      dividendPerShare: 1.33,
    }),
    snapshot("TGAR11", "development_equity", "2024-06-30T23:59:59-03:00", 75, {
      semesterCashResultPerShare: 7.77,
      semesterDistributionsPerShare: 8,
      reservePerShare: 0.05,
    }),
    snapshot("TGAR11", "development_equity", "2026-01-26T23:59:59-03:00", 80, {
      cashResultPerShare: 0.62,
      dividendPerShare: 0.71,
      reservePerShare: 0.1,
      guidanceDependsOnLiquidityEvent: true,
      liquidityEventDelayed: true,
      positiveNavRevaluation: true,
    }),
  ]);

  assert.equal(result.rows[0].prudentialAlert, "green");
  assert.equal(result.rows[1].deteriorationAlert, "yellow");
  assert.equal(result.rows[2].deteriorationAlert, "orange");
});

test("backtest rejects observations that were not yet public", () => {
  const invalid = snapshot("TGAR11", "development_equity", "2024-06-30T23:59:59-03:00", 75, {
    semesterCashResultPerShare: 7.77,
  });
  invalid.observations.semesterCashResultPerShare = metric(
    "semesterCashResultPerShare",
    7.77,
    "2024-07-20T12:00:00-03:00",
  );

  assert.throws(() => engine.run([invalid]), /Look-ahead bias detected/);
});
