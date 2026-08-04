import type {
  PortfolioIntelligenceDataQuality,
  PortfolioIntelligenceDataQualityReason,
  PortfolioIntelligenceIncomeMetrics,
  PortfolioIntelligencePortfolioMetrics,
  PortfolioIntelligenceWarning,
} from "./PortfolioIntelligence";
import type { NormalizedPortfolioPosition } from "./PortfolioIntelligenceMetrics";
import type { PortfolioIntelligencePolicy } from "./PortfolioIntelligencePolicy";

export function assessPortfolioIntelligenceDataQuality(args: {
  positions: readonly NormalizedPortfolioPosition[];
  income: PortfolioIntelligenceIncomeMetrics;
  portfolio: PortfolioIntelligencePortfolioMetrics;
  policy: PortfolioIntelligencePolicy;
}) {
  const { positions, income, portfolio, policy } = args;
  const pricedPositionCount = positions.filter((position) => position.price !== null && position.price > 0).length;
  const unpricedPositionCount = positions.length - pricedPositionCount;
  const knownSegmentPositionCount = positions.filter((position) => Boolean(position.segment)).length;
  const incomeKnownPositionCount = positions.filter((position) => position.estimatedIncome !== null).length;
  const allPricesKnown = positions.length > 0 && pricedPositionCount === positions.length;
  const allIncomeKnown = positions.length > 0 && incomeKnownPositionCount === positions.length;
  const patrimonyCoveragePercent = allPricesKnown ? 100 : null;
  const segmentCoveragePercent = allPricesKnown ? portfolio.segmentCoveragePercent : null;
  const incomeCoveragePercent = allIncomeKnown ? 100 : null;
  const latestSixConsecutive = income.latestSixMonthsAreConsecutive;
  const trendConfidence = income.validMonthCount < policy.trend.minimumMonths
    ? "low"
    : latestSixConsecutive ? "high" : "medium";
  const concentrationConfidence = allPricesKnown && portfolio.validPatrimonyTotal > 0 ? "high" : "low";
  const segmentsConfidence = (
    segmentCoveragePercent !== null
    && segmentCoveragePercent >= policy.segments.minimumCoveragePercent
  )
    ? segmentCoveragePercent >= policy.segments.highConfidenceCoveragePercent ? "high" : "medium"
    : "low";
  const incomeConfidence = allIncomeKnown && (portfolio.estimatedIncomeTotal ?? 0) > 0 ? "high" : "low";
  const reasons: PortfolioIntelligenceDataQualityReason[] = [];
  const addReason = (reason: PortfolioIntelligenceDataQualityReason) => {
    reasons.push(Object.freeze({ ...reason, evidence: Object.freeze({ ...reason.evidence }) }));
  };

  if (positions.length === 0) {
    addReason({
      code: "EMPTY_PORTFOLIO",
      conclusion: "analysis",
      impact: "suppressed",
      message: "A carteira está vazia; adicione ao menos uma posição para avaliar concentração, segmentos e renda estimada.",
      evidence: { totalPositions: 0 },
    });
  }
  if (unpricedPositionCount > 0) {
    addReason({
      code: "MISSING_QUOTES",
      conclusion: "concentration",
      impact: "suppressed",
      message: `${unpricedPositionCount} posição(ões) estão sem cotação válida; a concentração patrimonial não pode ser comprovada.`,
      evidence: { affectedPositions: unpricedPositionCount, totalPositions: positions.length },
    });
  }
  const missingSegments = positions.length - knownSegmentPositionCount;
  if (missingSegments > 0) {
    addReason({
      code: "MISSING_SEGMENTS",
      conclusion: "segments",
      impact: "suppressed",
      message: `${missingSegments} posição(ões) estão sem segmento conhecido; a concentração por segmento pode ficar indisponível.`,
      evidence: { affectedPositions: missingSegments, totalPositions: positions.length },
    });
  }
  const missingIncome = positions.length - incomeKnownPositionCount;
  if (missingIncome > 0) {
    addReason({
      code: "MISSING_ESTIMATED_INCOME",
      conclusion: "income",
      impact: "suppressed",
      message: `${missingIncome} posição(ões) estão sem renda estimada; a dependência de renda por fundo não pode ser comprovada.`,
      evidence: { affectedPositions: missingIncome, totalPositions: positions.length },
    });
  }
  if (allIncomeKnown && portfolio.estimatedIncomeTotal === 0) {
    addReason({
      code: "ZERO_ESTIMATED_INCOME_TOTAL",
      conclusion: "income",
      impact: "suppressed",
      message: "Todas as rendas estimadas são conhecidas, mas o total é zero; não existe base positiva para calcular participação por fundo.",
      evidence: { incomeKnownPositions: incomeKnownPositionCount, estimatedIncomeTotal: 0 },
    });
  }
  if (income.validMonthCount < policy.trend.minimumMonths) {
    const missingMonths = policy.trend.minimumMonths - income.validMonthCount;
    addReason({
      code: "INSUFFICIENT_CLOSED_MONTHS",
      conclusion: "trend",
      impact: "suppressed",
      message: `São necessários mais ${missingMonths} mês(es) encerrado(s) para calcular a tendência; há ${income.validMonthCount} de ${policy.trend.minimumMonths}.`,
      evidence: {
        monthsAvailable: income.validMonthCount,
        monthsRequired: policy.trend.minimumMonths,
        missingMonths,
      },
    });
  } else if (!latestSixConsecutive) {
    addReason({
      code: "NON_CONSECUTIVE_HISTORY",
      conclusion: "trend",
      impact: "reduced_confidence",
      message: "Os seis meses disponíveis têm lacunas; a tendência foi mantida com confiança reduzida.",
      evidence: { monthsAvailable: income.validMonthCount, latestSixMonthsAreConsecutive: false },
    });
  }

  const missingFields = reasons.map((reason) => reason.message);

  const allSufficient = trendConfidence !== "low"
    && concentrationConfidence !== "low"
    && segmentsConfidence !== "low"
    && incomeConfidence !== "low"
    && reasons.length === 0;
  const hasAnyUsableData = income.validMonthCount > 0 || pricedPositionCount > 0;
  const state = allSufficient ? "sufficient" : hasAnyUsableData ? "partial" : "insufficient";
  const warnings: PortfolioIntelligenceWarning[] = [];
  if (positions.length > 0 && !allPricesKnown) {
    warnings.push(Object.freeze({
      code: "PATRIMONY_COVERAGE_UNDETERMINED",
      message: "Cobertura patrimonial percentual não pode ser comprovada porque existem posições sem cotação.",
    }));
  }
  if (positions.length > 0 && !allIncomeKnown) {
    warnings.push(Object.freeze({
      code: "INCOME_COVERAGE_INSUFFICIENT",
      message: "Concentração de renda suprimida porque a renda estimada não cobre todas as posições.",
    }));
  }
  if (
    positions.length > 0
    && (segmentCoveragePercent === null || segmentCoveragePercent < policy.segments.minimumCoveragePercent)
  ) {
    warnings.push(Object.freeze({
      code: "SEGMENT_COVERAGE_INSUFFICIENT",
      message: "Concentração por segmento suprimida porque a cobertura patrimonial conhecida é insuficiente.",
    }));
  }

  const quality: PortfolioIntelligenceDataQuality = Object.freeze({
    state,
    pricedPositionCount,
    unpricedPositionCount,
    patrimonyCoveredByValidData: portfolio.validPatrimonyTotal,
    patrimonyCoveragePercent,
    knownSegmentPositionCount,
    segmentCoveredPatrimony: portfolio.patrimonyBySegment.reduce((total, segment) => total + segment.value, 0),
    segmentCoveragePercent,
    incomeKnownPositionCount,
    incomeCoveragePercent,
    monthsAvailable: income.validMonthCount,
    monthsRequired: policy.trend.minimumMonths,
    reasons: Object.freeze(reasons),
    missingFields: Object.freeze(missingFields),
    confidence: Object.freeze({
      trend: trendConfidence,
      concentration: concentrationConfidence,
      segments: segmentsConfidence,
      income: incomeConfidence,
    }),
  });

  return Object.freeze({ quality, warnings: Object.freeze(warnings) });
}
