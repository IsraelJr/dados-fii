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

function currentPositions() {
  return intelligencePositionsFromCurrentWallet([
    {
      ticker: "AAAA11",
      quotas: 60,
      price: 1,
      estimatedIncome: 6,
      segment: "Papel",
    },
    {
      ticker: "BBBB11",
      quotas: 40,
      price: 1,
      estimatedIncome: 4,
      segment: "Tijolo",
    },
  ]);
}

test("integra a série consolidada e posições atuais em uma única análise", () => {
  const result = service.analyze({
    snapshots: snapshots([100, 100, 100, 110, 110, 110]),
    positions: currentPositions(),
  }, options);
  assert.equal(result.metrics.income.blockVariationPercent, 10);
  assert.equal(result.metrics.portfolio.validPatrimonyTotal, 100);
  assert.equal(result.metrics.portfolio.patrimonyBySegment[0].segment, "Papel");
  assert.ok(result.signals.some((signal) => signal.code === "RENDA_EM_ALTA"));
  assert.ok(result.signals.some((signal) => signal.code === "CONCENTRACAO_POR_SEGMENTO"));
});

test("inclusão, alteração e exclusão manual recalculam sinais sem estado persistido no motor", () => {
  const insufficient = service.analyze({
    snapshots: snapshots([100, 100]),
    positions: currentPositions(),
  }, options);
  assert.ok(insufficient.signals.some((signal) => signal.code === "DADOS_INSUFICIENTES"));
  assert.ok(!insufficient.signals.some((signal) => signal.code === "RENDA_EM_ALTA"));

  const completed = service.analyze({
    snapshots: snapshots([100, 100, 100, 110, 110, 110]),
    positions: currentPositions(),
  }, options);
  assert.ok(completed.signals.some((signal) => signal.code === "RENDA_EM_ALTA"));

  const changed = service.analyze({
    snapshots: snapshots([100, 100, 100, 90, 90, 90]),
    positions: currentPositions(),
  }, options);
  assert.ok(changed.signals.some((signal) => signal.code === "RENDA_EM_QUEDA"));
  assert.ok(!changed.signals.some((signal) => signal.code === "RENDA_EM_ALTA"));

  const afterDelete = service.analyze({
    snapshots: snapshots([100, 100, 100, 90, 90]),
    positions: currentPositions(),
  }, options);
  assert.ok(afterDelete.signals.some((signal) => signal.code === "DADOS_INSUFICIENTES"));
  assert.ok(!afterDelete.signals.some((signal) => (
    signal.code === "RENDA_EM_ALTA"
    || signal.code === "RENDA_EM_QUEDA"
    || signal.code === "RENDA_ESTAVEL"
  )));
});

test("ausência de dados regulatórios de segmento permanece ausência", () => {
  const positions = intelligencePositionsFromCurrentWallet([
    { ticker: "AAAA11", quotas: 50, price: 1, estimatedIncome: 5, segment: null },
    { ticker: "BBBB11", quotas: 50, price: 1, estimatedIncome: 5, segment: "Papel" },
  ]);
  const result = service.analyze({
    snapshots: snapshots([100, 100, 100, 100, 100, 100]),
    positions,
  }, options);
  assert.equal(result.dataQuality.segmentCoveragePercent, 50);
  assert.ok(!result.metrics.portfolio.patrimonyBySegment.some((segment) => /sem segmento/i.test(segment.segment)));
  assert.ok(!result.signals.some((signal) => signal.code === "CONCENTRACAO_POR_SEGMENTO"));
});

test("adapter preserva zero explícito e null de renda por posição", () => {
  const positions = intelligencePositionsFromCurrentWallet([
    { ticker: "AAAA11", quotas: 10, price: 10, estimatedIncome: 0, segment: "Papel" },
    { ticker: "BBBB11", quotas: 10, price: 10, estimatedIncome: null, segment: null },
  ]);
  assert.equal(positions[0].estimatedIncome, 0);
  assert.equal(positions[1].estimatedIncome, null);
  const result = service.analyze({ snapshots: [], positions }, options);
  assert.equal(result.metrics.portfolio.estimatedIncomeTotal, null);
  assert.equal(result.dataQuality.incomeCoveragePercent, null);
});

test("alterações de histórico e posições recalculam também o modelo de apresentação", () => {
  const diversified = ["AAAA11", "BBBB11", "CCCC11", "DDDD11", "EEEE11"].map((ticker) => ({
    ticker,
    quotas: 20,
    price: 1,
    estimatedIncome: 20,
    segment: ticker === "AAAA11" ? "Papel" : "Tijolo",
  }));
  const concentrated = diversified.map((item, index) => ({
    ...item,
    quotas: index === 0 ? 30 : 17.5,
  }));
  const rising = service.analyze({
    snapshots: snapshots([100, 100, 100, 110, 110, 110]),
    positions: intelligencePositionsFromCurrentWallet(diversified),
  }, options);
  const afterMonthChange = service.analyze({
    snapshots: snapshots([100, 100, 100, 95, 95, 95]),
    positions: intelligencePositionsFromCurrentWallet(diversified),
  }, options);
  const afterMonthDelete = service.analyze({
    snapshots: snapshots([100, 100, 100, 95, 95]),
    positions: intelligencePositionsFromCurrentWallet(diversified),
  }, options);
  const afterPositionChange = service.analyze({
    snapshots: snapshots([100, 100, 100, 110, 110, 110]),
    positions: intelligencePositionsFromCurrentWallet(concentrated),
  }, options);

  assert.equal(buildPortfolioIntelligencePresentation(rising).summary.incomeState, "rising");
  assert.equal(buildPortfolioIntelligencePresentation(afterMonthChange).summary.incomeState, "falling");
  assert.equal(buildPortfolioIntelligencePresentation(afterMonthDelete).summary.incomeState, "unavailable");
  assert.ok(!rising.signals.some((item) => item.code === "CONCENTRACAO_ELEVADA"));
  assert.ok(afterPositionChange.signals.some((item) => item.code === "CONCENTRACAO_ELEVADA"));
  assert.ok(buildPortfolioIntelligencePresentation(afterPositionChange).summary.attentionCount > 0);
});
