import assert from "node:assert/strict";
import test from "node:test";
import type { PortfolioIncrementalChange } from "../src/lib/portfolio-intelligence/PortfolioIntelligenceIncremental";
import { formatPortfolioIncrementalValue } from "../src/lib/portfolio-intelligence/PortfolioIncrementalPresentation";

function change(code: string): PortfolioIncrementalChange {
  return Object.freeze({
    id: `data:${code}:new`,
    category: "data",
    state: "new",
    code,
    title: "Mudança",
    summary: "Resumo",
    material: true,
    before: 2,
    after: 3,
    evidence: Object.freeze({
      previousAsOf: "2026-08-01T12:00:00.000Z",
      currentAsOf: "2026-08-02T12:00:00.000Z",
      previousFingerprint: "a".repeat(64),
      currentFingerprint: "b".repeat(64),
      threshold: null,
    }),
  });
}

test("contagens de posições não são formatadas como percentuais", () => {
  for (const code of [
    "PRICED_POSITION_COUNT",
    "UNPRICED_POSITION_COUNT",
    "KNOWN_SEGMENT_POSITION_COUNT",
    "INCOME_KNOWN_POSITION_COUNT",
  ]) {
    assert.equal(formatPortfolioIncrementalValue(change(code), 2), "2");
  }
});

test("cobertura e concentração mantêm unidade percentual explícita", () => {
  assert.equal(formatPortfolioIncrementalValue(change("PATRIMONY_COVERAGE"), 20.91), "20,91%");
  assert.equal(formatPortfolioIncrementalValue(change("LARGEST_POSITION_CHANGED"), 35), "35%");
});
