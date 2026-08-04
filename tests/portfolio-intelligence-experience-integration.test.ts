import assert from "node:assert/strict";
import test from "node:test";
import {
  PortfolioIntelligenceService,
  buildPortfolioIntelligencePresentation,
  intelligencePositionsFromCurrentWallet,
  intelligenceSnapshotsFromConsolidated,
} from "../src/lib/portfolio-intelligence/index";

const service = new PortfolioIntelligenceService();
const options = {
  asOf: "2026-07-15T12:00:00.000Z",
  generatedAt: "2026-07-15T12:00:01.000Z",
} as const;

function snapshots(values: readonly number[]) {
  return intelligenceSnapshotsFromConsolidated(values.map((estimatedMonthlyIncome, index) => ({
    monthKey: `2026-${String(index + 1).padStart(2, "0")}`,
    estimatedMonthlyIncome,
  })));
}

const diversified = ["AAAA11", "BBBB11", "CCCC11", "DDDD11", "EEEE11"].map((ticker) => ({
  ticker,
  quotas: 20,
  price: 1,
  estimatedIncome: 20,
  segment: ticker === "AAAA11" ? "Papel" : "Tijolo",
}));

test("alteração e exclusão de mês atualizam o estado apresentado sem cache interno", () => {
  const rising = service.analyze({
    snapshots: snapshots([100, 100, 100, 110, 110, 110]),
    positions: intelligencePositionsFromCurrentWallet(diversified),
  }, options);
  const falling = service.analyze({
    snapshots: snapshots([100, 100, 100, 95, 95, 95]),
    positions: intelligencePositionsFromCurrentWallet(diversified),
  }, options);
  const insufficientAfterDelete = service.analyze({
    snapshots: snapshots([100, 100, 100, 95, 95]),
    positions: intelligencePositionsFromCurrentWallet(diversified),
  }, options);

  assert.equal(buildPortfolioIntelligencePresentation(rising).summary.incomeState, "rising");
  assert.equal(buildPortfolioIntelligencePresentation(falling).summary.incomeState, "falling");
  assert.equal(buildPortfolioIntelligencePresentation(insufficientAfterDelete).summary.incomeState, "unavailable");
});

test("mudança de posição atualiza concentração e pontos de atenção apresentados", () => {
  const concentrated = diversified.map((item, index) => ({
    ...item,
    quotas: index === 0 ? 60 : 10,
  }));
  const baseline = service.analyze({
    snapshots: snapshots([100, 100, 100, 100, 100, 100]),
    positions: intelligencePositionsFromCurrentWallet(diversified),
  }, options);
  const changed = service.analyze({
    snapshots: snapshots([100, 100, 100, 100, 100, 100]),
    positions: intelligencePositionsFromCurrentWallet(concentrated),
  }, options);

  assert.ok(!baseline.signals.some((item) => item.code === "CONCENTRACAO_ELEVADA"));
  assert.ok(changed.signals.some((item) => item.code === "CONCENTRACAO_ELEVADA"));
  assert.ok(
    buildPortfolioIntelligencePresentation(changed).summary.attentionCount
      > buildPortfolioIntelligencePresentation(baseline).summary.attentionCount,
  );
});

test("apresentação preserva ressalvas quando cotação, segmento ou renda estão ausentes", () => {
  const result = service.analyze({
    snapshots: snapshots([100, 100, 100, 100, 100, 100]),
    positions: intelligencePositionsFromCurrentWallet([
      { ticker: "AAAA11", quotas: 10, price: null, estimatedIncome: null, segment: null },
    ]),
  }, options);
  const presentation = buildPortfolioIntelligencePresentation(result);

  assert.notEqual(presentation.summary.qualityState, "sufficient");
  assert.ok(presentation.dataUsed.reasons.length > 0);
  assert.ok(presentation.dataUsed.reasons.some((reason) => reason.code === "MISSING_QUOTES"));
  assert.ok(presentation.dataUsed.reasons.some((reason) => reason.code === "MISSING_SEGMENTS"));
  assert.ok(presentation.dataUsed.reasons.some((reason) => reason.code === "MISSING_ESTIMATED_INCOME"));
});
