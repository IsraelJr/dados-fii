import assert from "node:assert/strict";
import test from "node:test";
import {
  PortfolioIntelligenceService,
  PortfolioIntelligenceValidationError,
  intelligenceSnapshotsFromConsolidated,
  type PortfolioIntelligenceInput,
  type PortfolioIntelligencePositionInput,
  type PortfolioIntelligenceSignalCode,
} from "../src/lib/portfolio-intelligence/index";

const AS_OF_JULY = "2026-07-15T12:00:00.000Z";
const GENERATED_AT = "2026-07-15T12:00:01.000Z";
const service = new PortfolioIntelligenceService();

function history(values: readonly (number | null)[], year = 2026) {
  return values.map((dividends, index) => ({
    competence: `${year}-${String(index + 1).padStart(2, "0")}`,
    dividends,
  }));
}

function position(
  ticker: string,
  value: number,
  options: Partial<PortfolioIntelligencePositionInput> = {},
): PortfolioIntelligencePositionInput {
  return {
    ticker,
    quantity: options.quantity ?? value,
    price: options.price === undefined ? 1 : options.price,
    estimatedIncome: options.estimatedIncome === undefined ? value / 10 : options.estimatedIncome,
    segment: options.segment === undefined ? "Tijolo" : options.segment,
  };
}

function analyze(
  snapshots: PortfolioIntelligenceInput["snapshots"],
  positions: PortfolioIntelligenceInput["positions"] = [],
  asOf = AS_OF_JULY,
) {
  return service.analyze({ snapshots, positions }, { asOf, generatedAt: GENERATED_AT });
}

function codes(result: ReturnType<typeof analyze>) {
  return result.signals.map((signal) => signal.code);
}

function signal(result: ReturnType<typeof analyze>, code: PortfolioIntelligenceSignalCode) {
  return result.signals.find((item) => item.code === code);
}

test("caso A: identifica renda em alta pela média dos dois blocos de três meses", () => {
  const result = analyze(history([100, 100, 100, 110, 110, 110]));
  assert.equal(result.metrics.income.previousThreeMonthAverage, 100);
  assert.equal(result.metrics.income.recentThreeMonthAverage, 110);
  assert.equal(result.metrics.income.blockVariationPercent, 10);
  assert.ok(codes(result).includes("RENDA_EM_ALTA"));
  assert.ok(!codes(result).includes("RENDA_EM_QUEDA"));
  assert.ok(!codes(result).includes("RENDA_ESTAVEL"));
});

test("caso B: identifica renda em queda no limiar", () => {
  const result = analyze(history([100, 100, 100, 80, 80, 80]));
  assert.equal(result.metrics.income.blockVariationPercent, -20);
  assert.ok(codes(result).includes("RENDA_EM_QUEDA"));
});

test("caso C: identifica renda estável sem sinal contraditório", () => {
  const result = analyze(history([100, 102, 98, 101, 99, 100]));
  assert.equal(result.metrics.income.blockVariationPercent, 0);
  assert.ok(codes(result).includes("RENDA_ESTAVEL"));
  assert.ok(!codes(result).includes("RENDA_EM_ALTA"));
  assert.ok(!codes(result).includes("RENDA_EM_QUEDA"));
});

test("caso D: calcula desvio-padrão populacional e identifica renda instável", () => {
  const result = analyze(history([50, 150, 40, 160, 60, 140]));
  assert.ok((result.metrics.income.sixMonthCoefficientOfVariationPercent ?? 0) >= 20);
  assert.ok(codes(result).includes("RENDA_INSTAVEL"));
});

test("caso E: dois meses geram dados insuficientes e nenhuma tendência forte", () => {
  const result = analyze(history([100, 110]));
  assert.equal(result.dataQuality.monthsAvailable, 2);
  assert.ok(codes(result).includes("DADOS_INSUFICIENTES"));
  assert.ok(!codes(result).some((code) => ["RENDA_EM_ALTA", "RENDA_EM_QUEDA", "RENDA_ESTAVEL"].includes(code)));
  assert.match(signal(result, "DADOS_INSUFICIENTES")?.summary ?? "", /Atualmente existem 2 meses válidos/);
});

test("caso F: ausência não vira zero e zero explícito permanece válido", () => {
  const result = analyze(history([100, null, 0]), [], "2026-04-15T12:00:00.000Z");
  assert.equal(result.metrics.income.validMonthCount, 2);
  assert.deepEqual(result.metrics.income.worstMonth, { competence: "2026-03", value: 0 });
  assert.equal(result.metrics.income.latestIncome, 0);
});

test("caso G: mês corrente é excluído", () => {
  const result = analyze(history([10, 20, 30, 40, 50, 60, 70]));
  assert.equal(result.metrics.income.validMonthCount, 6);
  assert.equal(result.metrics.income.latestClosedCompetence, "2026-06");
  assert.ok(result.warnings.some((warning) => warning.code === "CURRENT_COMPETENCE_IGNORED"));
});

test("caso H: mês futuro é excluído com warning explícito", () => {
  const result = analyze([
    { competence: "2026-01", dividends: 10 },
    { competence: "2026-08", dividends: 80 },
  ]);
  assert.equal(result.metrics.income.validMonthCount, 1);
  assert.ok(result.warnings.some((warning) => (
    warning.code === "FUTURE_COMPETENCE_IGNORED" && warning.competence === "2026-08"
  )));
});

test("caso I: identifica concentração por maior posição e três maiores", () => {
  const positions = [32, 21, 19, 10, 8, 5, 5].map((value, index) => (
    position(`FII${String(index + 1).padStart(2, "0")}`, value)
  ));
  const result = analyze(history([100, 100, 100, 100, 100, 100]), positions);
  assert.equal(result.metrics.portfolio.largestPosition?.sharePercent, 32);
  assert.equal(result.metrics.portfolio.topThreeSharePercent, 72);
  assert.ok(codes(result).includes("CONCENTRACAO_ELEVADA"));
});

test("caso J: identifica dependência de renda com ticker, valor e participação", () => {
  const positions = [
    position("AAAA11", 25, { estimatedIncome: 40 }),
    position("BBBB11", 25, { estimatedIncome: 30 }),
    position("CCCC11", 25, { estimatedIncome: 20 }),
    position("DDDD11", 25, { estimatedIncome: 10 }),
  ];
  const result = analyze(history([100, 100, 100, 100, 100, 100]), positions);
  const dependency = signal(result, "DEPENDENCIA_DE_UM_FUNDO");
  assert.equal(dependency?.evidence.ticker, "AAAA11");
  assert.equal(dependency?.evidence.estimatedIncome, 40);
  assert.equal(dependency?.evidence.sharePercent, 40);
});

test("caso K: cobertura de segmentos abaixo de 70% suprime concentração", () => {
  const positions = Array.from({ length: 10 }, (_, index) => (
    position(`SEGM${String(index).padStart(2, "0")}`, 10, {
      segment: index < 6 ? "Papel" : null,
    })
  ));
  const result = analyze(history([100, 100, 100, 100, 100, 100]), positions);
  assert.equal(result.dataQuality.segmentCoveragePercent, 60);
  assert.equal(result.dataQuality.confidence.segments, "low");
  assert.ok(!codes(result).includes("CONCENTRACAO_POR_SEGMENTO"));
  assert.ok(codes(result).includes("DADOS_INSUFICIENTES"));
});

test("caso L: segmento com 55% e cobertura suficiente gera sinal", () => {
  const result = analyze(history([100, 100, 100, 100, 100, 100]), [
    position("AAAA11", 55, { segment: "Papel" }),
    position("BBBB11", 45, { segment: "Tijolo" }),
  ]);
  const segmentSignal = signal(result, "CONCENTRACAO_POR_SEGMENTO");
  assert.equal(segmentSignal?.evidence.segment, "Papel");
  assert.equal(segmentSignal?.evidence.sharePercent, 55);
});

test("caso M: mesma entrada produz métricas e sinais idênticos", () => {
  const input = {
    snapshots: history([100, 100, 100, 110, 110, 110]),
    positions: [position("BBBB11", 40), position("AAAA11", 60)],
  };
  const first = service.analyze(input, { asOf: AS_OF_JULY, generatedAt: GENERATED_AT });
  const second = service.analyze({
    snapshots: [...input.snapshots].reverse(),
    positions: [...input.positions].reverse(),
  }, { asOf: AS_OF_JULY, generatedAt: GENERATED_AT });
  assert.deepEqual(first.metrics, second.metrics);
  assert.deepEqual(first.signals, second.signals);
  assert.deepEqual(first.dataQuality, second.dataQuality);
});

test("caso N: valores inválidos falham fechado", () => {
  const invalidInputs: PortfolioIntelligenceInput[] = [
    { snapshots: [{ competence: "2026-13", dividends: 1 }], positions: [] },
    { snapshots: [{ competence: "2026-01", dividends: Number.NaN }], positions: [] },
    { snapshots: [{ competence: "2026-01", dividends: Number.POSITIVE_INFINITY }], positions: [] },
    { snapshots: [{ competence: "2026-01", dividends: -1 }], positions: [] },
    { snapshots: [], positions: [position("AAAA11", 10, { quantity: -1 })] },
    { snapshots: [], positions: [position("AAAA11", 10, { price: -1 })] },
    { snapshots: [], positions: [position("AAAA11", 10, { price: Number.NaN })] },
    { snapshots: [], positions: [position("AAAA11", 10, { estimatedIncome: -1 })] },
  ];
  for (const input of invalidInputs) {
    assert.throws(
      () => service.analyze(input, { asOf: AS_OF_JULY, generatedAt: GENERATED_AT }),
      PortfolioIntelligenceValidationError,
    );
  }
});

test("caso N: divisão por zero retorna ausência explicada, nunca Infinity ou NaN", () => {
  const result = analyze(history([0, 0, 0, 10, 10, 10]));
  assert.equal(result.metrics.income.blockVariationPercent, null);
  assert.ok(result.warnings.some((warning) => warning.code === "ZERO_BASE_VARIATION_UNAVAILABLE"));
  assert.ok(!JSON.stringify(result).includes("Infinity"));
  assert.ok(!JSON.stringify(result).includes("NaN"));
});

test("caso O: HHI usa participações percentuais ao quadrado", () => {
  const result = analyze([], [
    position("AAAA11", 50),
    position("BBBB11", 30),
    position("CCCC11", 20),
  ]);
  assert.equal(result.metrics.portfolio.patrimonyHhi, 50 ** 2 + 30 ** 2 + 20 ** 2);
});

test("MAD igual a zero usa fallback documentado sem classificar mero máximo automaticamente", () => {
  const noOutlier = analyze(
    history([100, 100, 100, 100, 100, 100, 100]),
    [],
    "2026-08-15T12:00:00.000Z",
  );
  assert.equal(noOutlier.metrics.income.outlier, null);

  const outlier = analyze(
    history([100, 100, 100, 100, 100, 100, 200]),
    [],
    "2026-08-15T12:00:00.000Z",
  );
  assert.equal(outlier.metrics.income.outlier?.method, "constant_baseline_fallback");
  assert.equal(outlier.metrics.income.outlier?.direction, "positive");
  assert.ok(codes(outlier).includes("MES_ATIPICO_POSITIVO"));
  assert.ok(outlier.warnings.some((warning) => warning.code === "OUTLIER_ZERO_MAD_FALLBACK"));
});

test("busca o mês atípico anterior quando o mês mais recente não é atípico", () => {
  const result = analyze(
    history([100, 100, 100, 100, 100, 100, 200, 100]),
    [],
    "2026-09-15T12:00:00.000Z",
  );

  assert.equal(result.metrics.income.outlier?.competence, "2026-07");
  assert.equal(result.metrics.income.outlier?.value, 200);
  assert.ok(codes(result).includes("MES_ATIPICO_POSITIVO"));
});

test("entrada permanece inalterada", () => {
  const input = {
    snapshots: history([100, 101, 102, 103, 104, 105]),
    positions: [position("BBBB11", 40), position("AAAA11", 60)],
  };
  const before = JSON.stringify(input);
  service.analyze(input, { asOf: AS_OF_JULY, generatedAt: GENERATED_AT });
  assert.equal(JSON.stringify(input), before);
});

test("sinais têm ordem estável e não possuem duplicados", () => {
  const result = analyze(history([50, 150, 40, 160, 60, 140]), [
    position("AAAA11", 80, { estimatedIncome: 80, segment: "Papel" }),
    position("BBBB11", 20, { estimatedIncome: 20, segment: "Tijolo" }),
  ]);
  const resultCodes = codes(result);
  assert.deepEqual(resultCodes, [
    "CONCENTRACAO_ELEVADA",
    "DEPENDENCIA_DE_UM_FUNDO",
    "CONCENTRACAO_POR_SEGMENTO",
    "RENDA_INSTAVEL",
    "RENDA_EM_ALTA",
  ]);
  assert.equal(new Set(resultCodes).size, resultCodes.length);
});

test("empates entre posições são resolvidos por ticker", () => {
  const result = analyze([], [
    position("BBBB11", 50),
    position("AAAA11", 50),
  ]);
  assert.deepEqual(
    result.metrics.portfolio.patrimonyByFund.map((item) => item.ticker),
    ["AAAA11", "BBBB11"],
  );
});

test("carteira vazia e carteira com um fundo possuem estados explícitos", () => {
  const empty = analyze([]);
  assert.equal(empty.dataQuality.state, "insufficient");
  assert.equal(empty.metrics.portfolio.fundCount, 0);

  const single = analyze([], [position("AAAA11", 100)]);
  assert.equal(single.metrics.portfolio.fundCount, 1);
  assert.equal(single.metrics.portfolio.largestPosition?.sharePercent, 100);
  assert.ok(codes(single).includes("CONCENTRACAO_ELEVADA"));
});

test("posição sem cotação suprime concentração forte e não inventa cobertura patrimonial", () => {
  const result = analyze(history([100, 100, 100, 100, 100, 100]), [
    position("AAAA11", 100),
    position("BBBB11", 100, { price: null }),
  ]);
  assert.equal(result.dataQuality.patrimonyCoveragePercent, null);
  assert.equal(result.dataQuality.confidence.concentration, "low");
  assert.ok(!codes(result).includes("CONCENTRACAO_ELEVADA"));
});

test("adapter consome a série consolidada sem criar outra reconciliação", () => {
  const snapshots = intelligenceSnapshotsFromConsolidated([
    { monthKey: "2026-01", estimatedMonthlyIncome: 100 },
    { monthKey: "2026-03", estimatedMonthlyIncome: 0 },
  ]);
  assert.deepEqual(snapshots, [
    { competence: "2026-01", dividends: 100 },
    { competence: "2026-03", dividends: 0 },
  ]);
});

test("processa 200 posições e 120 meses em memória dentro do limite básico", () => {
  const snapshots = Array.from({ length: 120 }, (_, index) => {
    const year = 2016 + Math.floor(index / 12);
    const month = (index % 12) + 1;
    return {
      competence: `${year}-${String(month).padStart(2, "0")}`,
      dividends: 100 + (index % 7),
    };
  });
  const positions = Array.from({ length: 200 }, (_, index) => (
    position(`FUND${String(index).padStart(3, "0")}`, index + 1, {
      estimatedIncome: (index + 1) / 10,
      segment: `Segmento ${index % 8}`,
    })
  ));
  const started = performance.now();
  const result = analyze(snapshots, positions, "2026-01-15T12:00:00.000Z");
  const duration = performance.now() - started;
  assert.equal(result.metrics.income.validMonthCount, 120);
  assert.equal(result.metrics.portfolio.fundCount, 200);
  assert.ok(duration < 1_000, `execução levou ${duration.toFixed(2)}ms`);
});

test("competências e posições duplicadas são rejeitadas", () => {
  assert.throws(() => analyze([
    { competence: "2026-01", dividends: 1 },
    { competence: "2026-01", dividends: 2 },
  ]), /Competência duplicada/);
  assert.throws(() => analyze([], [
    position("AAAA11", 10),
    position("AAAA11", 20),
  ]), /Posição duplicada/);
});
