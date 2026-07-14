import test from "node:test";
import assert from "node:assert/strict";
import { calculateRegulatoryScores } from "../services/score/ScoreEngine.ts";

function baseInput() {
  return {
    historyLength: 5,
    coverage: 100,
    conflictCount: 0,
    qaScore: 100,
    documentsCount: 9,
    documentTypesCount: 3,
    netWorthChangePct: 0,
    shareholdersChangePct: 10,
    vpCotaChangePct: 0,
    delinquentValue: 0,
  };
}

test("score engine preserves deterministic regulatory methodology", () => {
  const result = calculateRegulatoryScores(baseInput());

  assert.equal(result.version, "regulatory-score-engine-v1");
  assert.equal(result.methodologyVersion, 1);
  assert.equal(result.scores.dataQuality, 100);
  assert.equal(result.scores.documentation, 95);
  assert.equal(result.scores.governanceEvidence, 92);
  assert.equal(result.scores.investorBase, 75);
  assert.equal(result.scores.patrimonial, 55);
  assert.equal(result.scores.growth, 65);
  assert.equal(result.scores.stability, 100);
  assert.equal(result.scores.risk, 11);
  assert.equal(result.scores.overall, 83);
  assert.equal(result.semaphore, "green");
});

test("score engine never estimates unavailable dimensions", () => {
  const result = calculateRegulatoryScores({
    ...baseInput(),
    historyLength: 0,
    netWorthChangePct: null,
    shareholdersChangePct: null,
    vpCotaChangePct: null,
    delinquentValue: null,
  });

  assert.equal(result.scores.growth, null);
  assert.equal(result.scores.liquidity, null);
  assert.ok(result.unavailableDimensions.includes("growth"));
  assert.ok(result.unavailableDimensions.includes("liquidity"));
  assert.ok(!result.assessedDimensions.includes("growth"));
  assert.ok(!result.assessedDimensions.includes("liquidity"));
});

test("conflicts and delinquency deteriorate quality, stability and risk", () => {
  const healthy = calculateRegulatoryScores(baseInput());
  const stressed = calculateRegulatoryScores({
    ...baseInput(),
    conflictCount: 4,
    netWorthChangePct: -8,
    vpCotaChangePct: -5,
    delinquentValue: 1_000_000,
  });

  assert.ok(stressed.scores.dataQuality < healthy.scores.dataQuality);
  assert.ok(stressed.scores.stability < healthy.scores.stability);
  assert.ok(stressed.scores.risk > healthy.scores.risk);
  assert.ok(stressed.scores.overall < healthy.scores.overall);
});

test("published methodology exposes explicit normalized risk weights", () => {
  const result = calculateRegulatoryScores(baseInput());
  const total = Object.values(result.weights.risk).reduce((sum, value) => sum + value, 0);

  assert.equal(total, 1);
  assert.deepEqual(result.weights.risk, {
    dataQuality: 0.2,
    stability: 0.55,
    patrimonial: 0.25,
  });
});
