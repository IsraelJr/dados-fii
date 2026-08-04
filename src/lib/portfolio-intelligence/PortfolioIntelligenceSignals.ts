import type {
  PortfolioIntelligenceDataQuality,
  PortfolioIntelligenceMetrics,
  PortfolioIntelligenceSignal,
  PortfolioIntelligenceSignalCode,
} from "./PortfolioIntelligence";
import type { PortfolioIntelligencePolicy } from "./PortfolioIntelligencePolicy";

const SIGNAL_ORDER: Readonly<Record<PortfolioIntelligenceSignalCode, number>> = Object.freeze({
  DADOS_INSUFICIENTES: 1,
  CONCENTRACAO_ELEVADA: 2,
  DEPENDENCIA_DE_UM_FUNDO: 3,
  CONCENTRACAO_POR_SEGMENTO: 4,
  RENDA_EM_QUEDA: 5,
  RENDA_INSTAVEL: 6,
  MES_ATIPICO_NEGATIVO: 7,
  RENDA_EM_ALTA: 8,
  RENDA_ESTAVEL: 9,
  MES_ATIPICO_POSITIVO: 10,
});

function signal(
  policy: PortfolioIntelligencePolicy,
  value: Omit<PortfolioIntelligenceSignal, "policyVersion">,
): PortfolioIntelligenceSignal {
  return Object.freeze({ ...value, evidence: Object.freeze({ ...value.evidence }), policyVersion: policy.version });
}

export function buildPortfolioIntelligenceSignals(args: {
  metrics: PortfolioIntelligenceMetrics;
  dataQuality: PortfolioIntelligenceDataQuality;
  policy: PortfolioIntelligencePolicy;
}) {
  const { metrics, dataQuality, policy } = args;
  const signals: PortfolioIntelligenceSignal[] = [];
  const insufficientDomains = Object.values(dataQuality.confidence).filter((confidence) => confidence === "low").length;

  if (insufficientDomains > 0) {
    const suppressedReasons = dataQuality.reasons.filter((reason) => reason.impact === "suppressed");
    const summary = suppressedReasons[0]?.message
      ?? "A evidência disponível não permite calcular todas as conclusões da carteira.";
    signals.push(signal(policy, {
      code: "DADOS_INSUFICIENTES",
      severity: "attention",
      title: "Complete os dados para ampliar a análise",
      summary,
      confidence: "low",
      evidence: {
        monthsAvailable: dataQuality.monthsAvailable,
        monthsRequired: dataQuality.monthsRequired,
        pricedPositions: dataQuality.pricedPositionCount,
        totalPositions: metrics.portfolio.fundCount,
        segmentCoveragePercent: dataQuality.segmentCoveragePercent,
        incomeKnownPositions: dataQuality.incomeKnownPositionCount,
        reasonCode: suppressedReasons[0]?.code ?? null,
        suppressedReasonCount: suppressedReasons.length,
      },
    }));
  }

  const largestPosition = metrics.portfolio.largestPosition;
  const concentrationTriggered = dataQuality.confidence.concentration !== "low" && Boolean(
    (largestPosition?.sharePercent ?? 0) >= policy.concentration.largestPositionThresholdPercent
    || (metrics.portfolio.topThreeSharePercent ?? 0) >= policy.concentration.topThreeThresholdPercent
    || (metrics.portfolio.patrimonyHhi ?? 0) >= policy.concentration.hhiThreshold,
  );
  if (concentrationTriggered) {
    signals.push(signal(policy, {
      code: "CONCENTRACAO_ELEVADA",
      severity: "warning",
      title: "A carteira está concentrada",
      summary: "Uma ou mais medidas de concentração patrimonial atingiram os limites da política.",
      confidence: dataQuality.confidence.concentration,
      evidence: {
        largestTicker: largestPosition?.ticker ?? null,
        largestPositionPercent: largestPosition?.sharePercent ?? null,
        topThreePercent: metrics.portfolio.topThreeSharePercent,
        hhi: metrics.portfolio.patrimonyHhi,
      },
    }));
  }

  const incomeLeader = metrics.portfolio.largestIncomeContributor;
  if (
    dataQuality.confidence.income !== "low"
    && incomeLeader
    && incomeLeader.sharePercent >= policy.income.singleFundThresholdPercent
  ) {
    signals.push(signal(policy, {
      code: "DEPENDENCIA_DE_UM_FUNDO",
      severity: "warning",
      title: "A renda depende muito de um único fundo",
      summary: `${incomeLeader.ticker} representa ${incomeLeader.sharePercent.toFixed(1)}% da renda mensal estimada coberta.`,
      confidence: dataQuality.confidence.income,
      evidence: {
        ticker: incomeLeader.ticker,
        estimatedIncome: incomeLeader.income,
        sharePercent: incomeLeader.sharePercent,
        totalEstimatedIncome: metrics.portfolio.estimatedIncomeTotal,
      },
    }));
  }

  const leadingSegment = metrics.portfolio.patrimonyBySegment[0] ?? null;
  if (
    dataQuality.confidence.segments !== "low"
    && leadingSegment
    && leadingSegment.sharePercent >= policy.segments.concentrationThresholdPercent
  ) {
    signals.push(signal(policy, {
      code: "CONCENTRACAO_POR_SEGMENTO",
      severity: "attention",
      title: "Um segmento concentra parte relevante da carteira",
      summary: `${leadingSegment.segment} representa ${leadingSegment.sharePercent.toFixed(1)}% do patrimônio com cotação válida.`,
      confidence: dataQuality.confidence.segments,
      evidence: {
        segment: leadingSegment.segment,
        sharePercent: leadingSegment.sharePercent,
        coveragePercent: dataQuality.segmentCoveragePercent,
      },
    }));
  }

  const trendVariation = metrics.income.blockVariationPercent;
  if (dataQuality.confidence.trend !== "low" && trendVariation !== null) {
    if (trendVariation >= policy.trend.risingThresholdPercent) {
      signals.push(signal(policy, {
        code: "RENDA_EM_ALTA",
        severity: "info",
        title: "A renda recente está em alta",
        summary: "A média dos três meses mais recentes superou a média dos três meses anteriores.",
        confidence: dataQuality.confidence.trend,
        evidence: {
          previousAverage: metrics.income.previousThreeMonthAverage,
          recentAverage: metrics.income.recentThreeMonthAverage,
          variationPercent: trendVariation,
        },
      }));
    } else if (trendVariation <= policy.trend.fallingThresholdPercent) {
      signals.push(signal(policy, {
        code: "RENDA_EM_QUEDA",
        severity: "warning",
        title: "A renda recente está em queda",
        summary: "A média dos três meses mais recentes ficou abaixo da média dos três meses anteriores.",
        confidence: dataQuality.confidence.trend,
        evidence: {
          previousAverage: metrics.income.previousThreeMonthAverage,
          recentAverage: metrics.income.recentThreeMonthAverage,
          variationPercent: trendVariation,
        },
      }));
    } else {
      signals.push(signal(policy, {
        code: "RENDA_ESTAVEL",
        severity: "info",
        title: "A renda recente está estável",
        summary: "A variação entre os dois blocos de três meses permaneceu dentro da faixa de estabilidade.",
        confidence: dataQuality.confidence.trend,
        evidence: {
          previousAverage: metrics.income.previousThreeMonthAverage,
          recentAverage: metrics.income.recentThreeMonthAverage,
          variationPercent: trendVariation,
        },
      }));
    }
  }

  const coefficient = metrics.income.sixMonthCoefficientOfVariationPercent;
  if (
    dataQuality.confidence.trend !== "low"
    && coefficient !== null
    && coefficient >= policy.instability.signalThresholdPercent
  ) {
    signals.push(signal(policy, {
      code: "RENDA_INSTAVEL",
      severity: "attention",
      title: "A renda variou bastante nos últimos seis meses",
      summary: "O coeficiente de variação atingiu o limite de instabilidade definido pela política.",
      confidence: dataQuality.confidence.trend,
      evidence: {
        sixMonthAverage: metrics.income.sixMonthAverage,
        populationStandardDeviation: metrics.income.sixMonthPopulationStandardDeviation,
        coefficientOfVariationPercent: coefficient,
      },
    }));
  }

  if (metrics.income.outlier) {
    const outlier = metrics.income.outlier;
    const positive = outlier.direction === "positive";
    signals.push(signal(policy, {
      code: positive ? "MES_ATIPICO_POSITIVO" : "MES_ATIPICO_NEGATIVO",
      severity: positive ? "info" : "warning",
      title: positive ? "Um mês ficou acima do padrão recente" : "Um mês ficou abaixo do padrão recente",
      summary: "A competência se afastou materialmente da mediana dos seis meses anteriores segundo a regra robusta.",
      confidence: dataQuality.confidence.trend,
      evidence: {
        competence: outlier.competence,
        value: outlier.value,
        baselineMedian: outlier.baselineMedian,
        mad: outlier.mad,
        robustScore: outlier.robustScore,
        relativeDeviationPercent: outlier.relativeDeviationPercent,
      },
    }));
  }

  const unique = new Map<PortfolioIntelligenceSignalCode, PortfolioIntelligenceSignal>();
  for (const item of signals) {
    if (!unique.has(item.code)) unique.set(item.code, item);
  }
  return Object.freeze(
    [...unique.values()].sort((left, right) => (
      SIGNAL_ORDER[left.code] - SIGNAL_ORDER[right.code]
      || left.code.localeCompare(right.code)
    )),
  );
}
