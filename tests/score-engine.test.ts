import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { ScoreEngine } from "../src/lib/scores/ScoreEngine.ts";

const sample = {
  code: "TGAR11",
  ticker: "TGAR11",
  fundKind: "FII",
  name: "Fundo de teste",
  cnpj: "00000000000000",
  segment: "Híbrido",
  manager: "Gestora",
  administrator: "Administradora",
  price: "R$ 100,00",
  dividendYield12m: "11,5%",
  dailyLiquidity: 2_500_000,
  marketCap: 1_500_000_000,
  holders: 110_000,
  volatility12m: 12,
  vacancy: 4,
  ltv: 18,
  earnings2024: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [String(index + 1), { earnings: "R$ 0,900" }])),
  earnings2025: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [String(index + 1), { earnings: "R$ 1,000" }])),
  regulatoryMeta: {
    currentVersion: 2,
    sources: [{ provider: "CVM", kind: "regulatory" }],
    validation: { valid: true, issues: [] },
  },
};

test("calculates all seven scores with bounded, explainable results", () => {
  const scores = new ScoreEngine().calculate(sample, "2026-07-14T00:00:00.000Z");
  assert.equal(scores.generatedAt, "2026-07-14T00:00:00.000Z");
  for (const key of ["risk", "dividend", "governance", "growth", "liquidity", "quality", "premium"] as const) {
    const item = scores[key];
    assert.ok(item.score >= 0 && item.score <= 100, `${key} score out of range`);
    assert.ok(item.confidence >= 0 && item.confidence <= 100, `${key} confidence out of range`);
    assert.ok(item.reasons.length > 0, `${key} has no explanation`);
  }
});

test("penalizes objectively riskier inputs", () => {
  const engine = new ScoreEngine();
  const safer = engine.calculate(sample).risk.score;
  const riskier = engine.calculate({ ...sample, volatility12m: 45, vacancy: 30, ltv: 80 }).risk.score;
  assert.ok(riskier < safer);
});

test("does not reward governance for merely identifying manager and administrator", () => {
  const engine = new ScoreEngine();
  const identified = engine.calculate(sample).governance;
  const withoutRegistration = engine.calculate({ ...sample, manager: "", administrator: "" }).governance;
  assert.equal(identified.score, 50);
  assert.equal(identified.confidence, 0);
  assert.equal(identified.score, withoutRegistration.score);
  assert.equal(identified.confidence, withoutRegistration.confidence);
  assert.match(identified.reasons.join(" "), /dados cadastrais e não qualificam/i);
});

test("premium is the documented weighted composition", () => {
  const scores = new ScoreEngine().calculate(sample);
  const expected = Math.round(
    scores.risk.score * 0.25
    + scores.dividend.score * 0.2
    + scores.quality.score * 0.2
    + scores.governance.score * 0.15
    + scores.growth.score * 0.1
    + scores.liquidity.score * 0.1,
  );
  assert.equal(scores.premium.score, expected);
});

test("does not mutate regulatory input", () => {
  const input = structuredClone(sample);
  const before = structuredClone(input);
  new ScoreEngine().calculate(input);
  assert.deepEqual(input, before);
});

test("rejects implausible daily liquidity caused by parser labels", () => {
  const score = new ScoreEngine().calculate({ dailyLiquidity: 30 }).liquidity;
  assert.equal(score.metrics.dailyLiquidity, null);
  assert.doesNotMatch(score.reasons.join(" "), /R\$ 30/);
});
