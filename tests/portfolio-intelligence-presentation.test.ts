import assert from "node:assert/strict";
import test from "node:test";
import {
  PortfolioIntelligenceService,
  buildPortfolioIntelligencePresentation,
  formatPortfolioIntelligenceCompetence,
  formatPortfolioIntelligenceCurrency,
  formatPortfolioIntelligencePercent,
  visiblePortfolioIntelligenceSignals,
  type PortfolioIntelligenceDataQualityReason,
  type PortfolioIntelligenceResult,
  type PortfolioIntelligenceSignal,
  type PortfolioIntelligenceSignalCode,
} from "../src/lib/portfolio-intelligence/index";

const ALL_CODES: readonly PortfolioIntelligenceSignalCode[] = [
  "DADOS_INSUFICIENTES",
  "CONCENTRACAO_ELEVADA",
  "DEPENDENCIA_DE_UM_FUNDO",
  "CONCENTRACAO_POR_SEGMENTO",
  "RENDA_EM_QUEDA",
  "RENDA_INSTAVEL",
  "MES_ATIPICO_NEGATIVO",
  "RENDA_EM_ALTA",
  "RENDA_ESTAVEL",
  "MES_ATIPICO_POSITIVO",
];

const COMPLETE_EVIDENCE = Object.freeze({
  monthsAvailable: 6,
  monthsRequired: 6,
  pricedPositions: 4,
  totalPositions: 4,
  segmentCoveragePercent: 100,
  incomeKnownPositions: 4,
  largestTicker: "AAAA11",
  largestPositionPercent: 30,
  topThreePercent: 70,
  hhi: 2_500,
  ticker: "AAAA11",
  estimatedIncome: 35,
  sharePercent: 35,
  totalEstimatedIncome: 100,
  segment: "Papel",
  coveragePercent: 70,
  previousAverage: 100,
  recentAverage: 105,
  variationPercent: 5,
  sixMonthAverage: 100,
  populationStandardDeviation: 20,
  coefficientOfVariationPercent: 20,
  competence: "2026-01",
  value: 150,
  baselineMedian: 100,
  mad: 10,
  robustScore: 3.5,
  relativeDeviationPercent: 50,
});

function signal(
  code: PortfolioIntelligenceSignalCode,
  index = 0,
): PortfolioIntelligenceSignal {
  const severity = index % 3 === 0 ? "warning" : index % 3 === 1 ? "attention" : "info";
  const confidence = index % 3 === 0 ? "high" : index % 3 === 1 ? "medium" : "low";
  return Object.freeze({
    code,
    severity,
    title: `Título do domínio ${code}`,
    summary: `Resumo determinístico ${code}`,
    confidence,
    evidence: COMPLETE_EVIDENCE,
    policyVersion: "1.0.0",
  });
}

function baseResult(): PortfolioIntelligenceResult {
  return new PortfolioIntelligenceService().analyze({
    snapshots: [100, 100, 100, 100, 100, 100].map((dividends, index) => ({
      competence: `2026-${String(index + 1).padStart(2, "0")}`,
      dividends,
    })),
    positions: ["AAAA11", "BBBB11", "CCCC11", "DDDD11"].map((ticker) => ({
      ticker,
      quantity: 25,
      price: 1,
      estimatedIncome: 25,
      segment: "Tijolo",
    })),
  }, {
    asOf: "2026-07-15T12:00:00.000Z",
    generatedAt: "2026-07-15T12:00:01.000Z",
  });
}

function resultWith(args: {
  signals?: readonly PortfolioIntelligenceSignal[];
  reasons?: readonly PortfolioIntelligenceDataQualityReason[];
  quality?: PortfolioIntelligenceResult["dataQuality"]["state"];
  fundCount?: number;
  segmentCoveragePercent?: number | null;
  incomeCoveragePercent?: number | null;
} = {}): PortfolioIntelligenceResult {
  const base = baseResult();
  return Object.freeze({
    ...base,
    signals: Object.freeze([...(args.signals ?? base.signals)]),
    metrics: Object.freeze({
      ...base.metrics,
      portfolio: Object.freeze({ ...base.metrics.portfolio, fundCount: args.fundCount ?? base.metrics.portfolio.fundCount }),
    }),
    dataQuality: Object.freeze({
      ...base.dataQuality,
      state: args.quality ?? base.dataQuality.state,
      segmentCoveragePercent: args.segmentCoveragePercent === undefined
        ? base.dataQuality.segmentCoveragePercent
        : args.segmentCoveragePercent,
      incomeCoveragePercent: args.incomeCoveragePercent === undefined
        ? base.dataQuality.incomeCoveragePercent
        : args.incomeCoveragePercent,
      reasons: Object.freeze([...(args.reasons ?? [])]),
    }),
  });
}

function reason(
  code: PortfolioIntelligenceDataQualityReason["code"],
  impact: PortfolioIntelligenceDataQualityReason["impact"] = "suppressed",
): PortfolioIntelligenceDataQualityReason {
  return Object.freeze({
    code,
    conclusion: "analysis",
    impact,
    message: `Motivo específico ${code}`,
    evidence: Object.freeze({ affectedPositions: 1 }),
  });
}

test("modelo mapeia todos os códigos, preserva ordem e seleciona somente os três primeiros", () => {
  const signals = ALL_CODES.map(signal);
  const model = buildPortfolioIntelligencePresentation(resultWith({ signals }));

  assert.deepEqual(model.allSignals.map((item) => item.code), ALL_CODES);
  assert.deepEqual(model.primarySignals.map((item) => item.code), ALL_CODES.slice(0, 3));
  assert.equal(model.hasMoreSignals, true);
  assert.deepEqual(visiblePortfolioIntelligenceSignals(model, false), model.primarySignals);
  assert.deepEqual(visiblePortfolioIntelligenceSignals(model, true), model.allSignals);
  for (const item of model.allSignals) {
    assert.notEqual(item.title, `Título do domínio ${item.code}`);
    assert.match(item.summary, /Resumo determinístico/);
    assert.ok(["Alerta", "Atenção", "Informativo"].includes(item.severityLabel));
    assert.ok(["Alta", "Média", "Baixa"].includes(item.confidenceLabel));
    assert.ok(item.evidence.length > 0);
  }
});

test("evidências usam moeda, percentual e competência brasileiros sem confundir null com zero", () => {
  const income = signal("RENDA_EM_ALTA");
  const outlier = signal("MES_ATIPICO_POSITIVO", 1);
  const unavailable = Object.freeze({
    ...signal("DEPENDENCIA_DE_UM_FUNDO", 2),
    evidence: Object.freeze({
      ticker: "AAAA11",
      estimatedIncome: 0,
      sharePercent: null,
      totalEstimatedIncome: null,
    }),
  });
  const model = buildPortfolioIntelligencePresentation(resultWith({ signals: [income, outlier, unavailable] }));

  assert.equal(model.allSignals[0].evidence.find((item) => item.key === "previousAverage")?.value, "R$ 100,00");
  assert.equal(model.allSignals[0].evidence.find((item) => item.key === "variationPercent")?.value, "5%");
  assert.equal(model.allSignals[1].evidence.find((item) => item.key === "competence")?.value, "Janeiro/2026");
  assert.equal(model.allSignals[2].evidence.find((item) => item.key === "estimatedIncome")?.value, "R$ 0,00");
  assert.equal(model.allSignals[2].evidence.find((item) => item.key === "sharePercent")?.value, "Não disponível");
  assert.equal(formatPortfolioIntelligenceCurrency(null), "Não disponível");
  assert.equal(formatPortfolioIntelligenceCurrency(0), "R$ 0,00");
  assert.equal(formatPortfolioIntelligencePercent(null), "Não disponível");
  assert.equal(formatPortfolioIntelligencePercent(0), "0%");
  assert.equal(formatPortfolioIntelligenceCompetence(null), "Não disponível");
  assert.equal(formatPortfolioIntelligenceCompetence("inválida"), "inválida");
});

test("resumo representa alta, queda, estabilidade e indisponibilidade sem criar thresholds", () => {
  const rising = buildPortfolioIntelligencePresentation(resultWith({ signals: [signal("RENDA_EM_ALTA")] }));
  const falling = buildPortfolioIntelligencePresentation(resultWith({ signals: [signal("RENDA_EM_QUEDA")] }));
  const stable = buildPortfolioIntelligencePresentation(resultWith({ signals: [signal("RENDA_ESTAVEL", 2)] }));
  const unavailable = buildPortfolioIntelligencePresentation(resultWith({ signals: [] }));
  const oneAttention = buildPortfolioIntelligencePresentation(resultWith({ signals: [signal("CONCENTRACAO_POR_SEGMENTO", 1)] }));

  assert.deepEqual(
    [rising.summary.incomeLabel, falling.summary.incomeLabel, stable.summary.incomeLabel, unavailable.summary.incomeLabel],
    ["Alta", "Queda", "Estável", "Indisponível"],
  );
  assert.equal(oneAttention.summary.attentionLabel, "1 ponto");
  assert.equal(unavailable.summary.attentionLabel, "0 pontos");
});

test("estados distinguem erro validado, carteira vazia, histórico insuficiente, parcial e completo", () => {
  const invalid = buildPortfolioIntelligencePresentation(resultWith({
    reasons: [reason("INVALID_INPUT_REJECTED")],
    quality: "insufficient",
  }));
  const empty = buildPortfolioIntelligencePresentation(resultWith({
    reasons: [reason("EMPTY_PORTFOLIO")],
    quality: "insufficient",
    fundCount: 0,
  }));
  const insufficient = buildPortfolioIntelligencePresentation(resultWith({
    reasons: [reason("INSUFFICIENT_CLOSED_MONTHS")],
    quality: "partial",
  }));
  const partial = buildPortfolioIntelligencePresentation(resultWith({
    reasons: [reason("NON_CONSECUTIVE_HISTORY", "reduced_confidence")],
    quality: "partial",
  }));
  const complete = buildPortfolioIntelligencePresentation(resultWith({ reasons: [], quality: "sufficient" }));

  assert.deepEqual(
    [invalid.state, empty.state, insufficient.state, partial.state, complete.state],
    ["invalid", "empty", "insufficient_history", "partial", "complete"],
  );
  assert.deepEqual(
    [invalid.summary.qualityLabel, insufficient.summary.qualityLabel, complete.summary.qualityLabel],
    ["Insuficiente", "Parcial", "Suficiente"],
  );
  assert.match(invalid.stateMessage, /modo seguro/);
  assert.match(empty.stateMessage, /Adicione uma posição/);
  assert.match(insufficient.stateMessage, /histórico encerrado/);
  assert.match(partial.stateMessage, /parcial/);
  assert.match(complete.stateMessage, /todas as evidências/);
});

test("dados usados preservam todos os motivos específicos e coberturas ausentes", () => {
  const reasons = [
    reason("EMPTY_PORTFOLIO"),
    reason("MISSING_QUOTES"),
    reason("MISSING_SEGMENTS"),
    reason("MISSING_ESTIMATED_INCOME"),
    reason("ZERO_ESTIMATED_INCOME_TOTAL"),
    reason("INSUFFICIENT_CLOSED_MONTHS"),
    reason("NON_CONSECUTIVE_HISTORY", "reduced_confidence"),
    reason("INVALID_INPUT_REJECTED"),
  ];
  const input = resultWith({
    reasons,
    quality: "insufficient",
    segmentCoveragePercent: null,
    incomeCoveragePercent: null,
  });
  const before = JSON.stringify(input);
  const model = buildPortfolioIntelligencePresentation(input);

  assert.deepEqual(model.dataUsed.reasons.map((item) => item.code), reasons.map((item) => item.code));
  assert.equal(model.dataUsed.reasons.at(-2)?.impactLabel, "Confiança reduzida");
  assert.equal(model.dataUsed.segmentCoverageLabel, "Não disponível");
  assert.equal(model.dataUsed.incomeCoverageLabel, "Não disponível");
  assert.match(model.dataUsed.monthsLabel, /6 de 6/);
  assert.match(model.dataUsed.positionsLabel, /com cotação/);
  assert.equal(JSON.stringify(input), before);
});

test("modelo sem sinais adicionais não oferece expansão", () => {
  const model = buildPortfolioIntelligencePresentation(resultWith({ signals: [signal("RENDA_ESTAVEL", 2)] }));
  assert.equal(model.hasMoreSignals, false);
  assert.equal(model.primarySignals.length, 1);
});
