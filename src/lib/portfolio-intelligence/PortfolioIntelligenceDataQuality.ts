import type {
  PortfolioIntelligenceDataQuality,
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
  const missingFields: string[] = [];
  if (unpricedPositionCount > 0) missingFields.push(`cotação válida em ${unpricedPositionCount} posição(ões)`);
  const missingSegments = positions.length - knownSegmentPositionCount;
  if (missingSegments > 0) missingFields.push(`segmento conhecido em ${missingSegments} posição(ões)`);
  const missingIncome = positions.length - incomeKnownPositionCount;
  if (missingIncome > 0) missingFields.push(`renda estimada em ${missingIncome} posição(ões)`);
  if (income.validMonthCount < policy.trend.minimumMonths) {
    missingFields.push(`${policy.trend.minimumMonths - income.validMonthCount} mês(es) encerrado(s) para tendência`);
  }

  const allSufficient = trendConfidence !== "low"
    && concentrationConfidence !== "low"
    && segmentsConfidence !== "low"
    && incomeConfidence !== "low";
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
