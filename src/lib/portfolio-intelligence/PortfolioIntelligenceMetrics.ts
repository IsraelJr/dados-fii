import type {
  PortfolioIntelligenceIncomeMetrics,
  PortfolioIntelligenceIncomePositionMetric,
  PortfolioIntelligenceMonthMetric,
  PortfolioIntelligenceOutlierMetric,
  PortfolioIntelligencePortfolioMetrics,
  PortfolioIntelligencePositionMetric,
  PortfolioIntelligenceSegmentMetric,
  PortfolioIntelligenceWarning,
} from "./PortfolioIntelligence";
import type { PortfolioIntelligencePolicy } from "./PortfolioIntelligencePolicy";

export type NormalizedIncomeMonth = Readonly<{ competence: string; value: number }>;
export type NormalizedPortfolioPosition = Readonly<{
  ticker: string;
  quantity: number;
  price: number | null;
  estimatedIncome: number | null;
  segment: string | null;
}>;

function round(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function average(values: readonly number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function median(values: readonly number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function variationPercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return round(((current - previous) / Math.abs(previous)) * 100);
}

function competenceOrdinal(competence: string) {
  const [year, month] = competence.split("-").map(Number);
  return year * 12 + month - 1;
}

function areConsecutive(months: readonly NormalizedIncomeMonth[]) {
  return months.every((month, index) => (
    index === 0
    || competenceOrdinal(month.competence) === competenceOrdinal(months[index - 1].competence) + 1
  ));
}

function monthExtreme(
  months: readonly NormalizedIncomeMonth[],
  direction: "best" | "worst",
): PortfolioIntelligenceMonthMetric | null {
  if (!months.length) return null;
  const sorted = [...months].sort((left, right) => {
    const valueDifference = direction === "best"
      ? right.value - left.value
      : left.value - right.value;
    return valueDifference || left.competence.localeCompare(right.competence);
  });
  return Object.freeze({ competence: sorted[0].competence, value: round(sorted[0].value, 2) });
}

function detectLatestOutlier(
  months: readonly NormalizedIncomeMonth[],
  policy: PortfolioIntelligencePolicy,
): { outlier: PortfolioIntelligenceOutlierMetric | null; warning: PortfolioIntelligenceWarning | null } {
  const baselineSize = policy.outlier.baselineMonths;
  if (months.length <= baselineSize) return { outlier: null, warning: null };

  let latestFallbackWarning: PortfolioIntelligenceWarning | null = null;
  for (let index = months.length - 1; index >= baselineSize; index -= 1) {
    const candidate = months[index];
    const baseline = months.slice(index - baselineSize, index).map((month) => month.value);
    const baselineMedian = median(baseline) as number;
    const absoluteDeviations = baseline.map((value) => Math.abs(value - baselineMedian));
    const mad = median(absoluteDeviations) as number;
    const difference = candidate.value - baselineMedian;
    const absoluteDifference = Math.abs(difference);
    const relativeDeviationPercent = baselineMedian === 0
      ? null
      : round((absoluteDifference / Math.abs(baselineMedian)) * 100);
    const materiallyDifferent = baselineMedian === 0
      ? absoluteDifference >= policy.outlier.constantBaselineMinimumDifference
      : (relativeDeviationPercent as number) >= policy.outlier.minimumRelativeDeviationPercent;

    let robustScore: number | null = null;
    let method: PortfolioIntelligenceOutlierMetric["method"] = "mad";
    let isOutlier = false;
    let fallbackWarning: PortfolioIntelligenceWarning | null = null;

    if (mad > 0) {
      robustScore = round((0.6745 * absoluteDifference) / mad);
      isOutlier = robustScore >= policy.outlier.robustScoreThreshold && materiallyDifferent;
    } else {
      const meanAbsoluteDeviation = average(absoluteDeviations) as number;
      fallbackWarning = Object.freeze({
        code: "OUTLIER_ZERO_MAD_FALLBACK" as const,
        competence: candidate.competence,
        message: "MAD igual a zero; aplicado fallback determinístico documentado.",
      });
      if (meanAbsoluteDeviation > 0) {
        method = "mean_absolute_deviation_fallback";
        robustScore = round(absoluteDifference / meanAbsoluteDeviation);
        isOutlier = robustScore >= policy.outlier.robustScoreThreshold && materiallyDifferent;
      } else {
        method = "constant_baseline_fallback";
        isOutlier = materiallyDifferent;
      }
    }

    if (isOutlier) {
      return {
        outlier: Object.freeze({
          competence: candidate.competence,
          value: round(candidate.value, 2),
          baselineMedian: round(baselineMedian, 2),
          mad: round(mad, 6),
          robustScore,
          relativeDeviationPercent,
          direction: difference >= 0 ? "positive" : "negative",
          method,
        }),
        warning: fallbackWarning,
      };
    }
    if (index === months.length - 1 && fallbackWarning) {
      latestFallbackWarning = fallbackWarning;
    }
  }

  return { outlier: null, warning: latestFallbackWarning };
}

export function calculateIncomeMetrics(
  months: readonly NormalizedIncomeMonth[],
  policy: PortfolioIntelligencePolicy,
) {
  const values = months.map((month) => month.value);
  const latest = months.at(-1) ?? null;
  const previous = months.at(-2) ?? null;
  const latestSix = months.slice(-policy.instability.windowMonths);
  const recentThree = months.slice(-policy.trend.blockSize);
  const previousThree = months.slice(-(policy.trend.blockSize * 2), -policy.trend.blockSize);
  const enoughForTrend = months.length >= policy.trend.minimumMonths;
  const recentAverage = recentThree.length === policy.trend.blockSize ? average(recentThree.map((month) => month.value)) : null;
  const previousAverage = enoughForTrend ? average(previousThree.map((month) => month.value)) : null;
  const sixAverage = latestSix.length === policy.instability.windowMonths
    ? average(latestSix.map((month) => month.value))
    : null;
  const populationVariance = sixAverage === null
    ? null
    : latestSix.reduce((total, month) => total + ((month.value - sixAverage) ** 2), 0) / latestSix.length;
  const populationStandardDeviation = populationVariance === null ? null : Math.sqrt(populationVariance);
  const coefficientOfVariation = sixAverage === null || sixAverage === 0 || populationStandardDeviation === null
    ? null
    : (populationStandardDeviation / Math.abs(sixAverage)) * 100;
  const outlierResult = detectLatestOutlier(months, policy);
  const monthlyVariation = latest && previous ? variationPercent(latest.value, previous.value) : null;
  const blockVariation = recentAverage !== null && previousAverage !== null
    ? variationPercent(recentAverage, previousAverage)
    : null;
  const warnings: PortfolioIntelligenceWarning[] = [];

  if (latest && previous && previous.value === 0 && latest.value !== 0) {
    warnings.push(Object.freeze({
      code: "ZERO_BASE_VARIATION_UNAVAILABLE",
      competence: latest.competence,
      message: "Variação percentual indisponível porque a base anterior é zero.",
    }));
  }
  if (recentAverage !== null && previousAverage === 0 && recentAverage !== 0) {
    warnings.push(Object.freeze({
      code: "ZERO_BASE_VARIATION_UNAVAILABLE",
      competence: latest?.competence,
      message: "Variação entre médias indisponível porque a média anterior é zero.",
    }));
  }
  if (outlierResult.warning) warnings.push(outlierResult.warning);

  const metrics: PortfolioIntelligenceIncomeMetrics = Object.freeze({
    validMonthCount: months.length,
    latestClosedCompetence: latest?.competence ?? null,
    latestIncome: latest ? round(latest.value, 2) : null,
    previousIncome: previous ? round(previous.value, 2) : null,
    monthlyVariationPercent: monthlyVariation,
    recentThreeMonthAverage: recentAverage === null ? null : round(recentAverage, 2),
    previousThreeMonthAverage: previousAverage === null ? null : round(previousAverage, 2),
    blockVariationPercent: blockVariation,
    sixMonthAverage: sixAverage === null ? null : round(sixAverage, 2),
    sixMonthPopulationStandardDeviation: populationStandardDeviation === null ? null : round(populationStandardDeviation, 6),
    sixMonthCoefficientOfVariationPercent: coefficientOfVariation === null ? null : round(coefficientOfVariation),
    median: values.length ? round(median(values) as number, 2) : null,
    bestMonth: monthExtreme(months, "best"),
    worstMonth: monthExtreme(months, "worst"),
    outlier: outlierResult.outlier,
    latestSixMonthsAreConsecutive: latestSix.length === policy.trend.minimumMonths && areConsecutive(latestSix),
  });

  return Object.freeze({ metrics, warnings: Object.freeze(warnings) });
}

function positionMetricSort<T extends { ticker: string; value?: number; income?: number }>(left: T, right: T) {
  const leftValue = left.value ?? left.income ?? 0;
  const rightValue = right.value ?? right.income ?? 0;
  return rightValue - leftValue || left.ticker.localeCompare(right.ticker);
}

export function calculatePortfolioMetrics(
  positions: readonly NormalizedPortfolioPosition[],
): PortfolioIntelligencePortfolioMetrics {
  const valuedPositions = positions
    .filter((position) => position.price !== null && position.price > 0)
    .map((position) => ({
      ...position,
      value: position.quantity * (position.price as number),
    }));
  const validPatrimonyTotal = valuedPositions.reduce((total, position) => total + position.value, 0);
  const patrimonyByFund: PortfolioIntelligencePositionMetric[] = valuedPositions
    .map((position) => Object.freeze({
      ticker: position.ticker,
      value: round(position.value, 2),
      sharePercent: validPatrimonyTotal > 0 ? round((position.value / validPatrimonyTotal) * 100) : 0,
    }))
    .sort(positionMetricSort);
  const topThreeSharePercent = validPatrimonyTotal > 0
    ? round(patrimonyByFund.slice(0, 3).reduce((total, position) => total + position.sharePercent, 0))
    : null;
  const patrimonyHhi = validPatrimonyTotal > 0
    ? round(patrimonyByFund.reduce((total, position) => total + (position.sharePercent ** 2), 0))
    : null;

  const segmentTotals = new Map<string, number>();
  for (const position of valuedPositions) {
    if (!position.segment) continue;
    segmentTotals.set(position.segment, (segmentTotals.get(position.segment) ?? 0) + position.value);
  }
  const segmentCoveredPatrimony = [...segmentTotals.values()].reduce((total, value) => total + value, 0);
  const patrimonyBySegment: PortfolioIntelligenceSegmentMetric[] = [...segmentTotals.entries()]
    .map(([segment, value]) => Object.freeze({
      segment,
      value: round(value, 2),
      sharePercent: validPatrimonyTotal > 0 ? round((value / validPatrimonyTotal) * 100) : 0,
    }))
    .sort((left, right) => right.value - left.value || left.segment.localeCompare(right.segment));

  const incomeKnown = positions.filter((position) => position.estimatedIncome !== null);
  const estimatedIncomeTotal = incomeKnown.length === positions.length && positions.length > 0
    ? incomeKnown.reduce((total, position) => total + (position.estimatedIncome as number), 0)
    : null;
  const incomeByFund: PortfolioIntelligenceIncomePositionMetric[] = estimatedIncomeTotal !== null && estimatedIncomeTotal > 0
    ? incomeKnown
      .map((position) => Object.freeze({
        ticker: position.ticker,
        income: round(position.estimatedIncome as number, 2),
        sharePercent: round(((position.estimatedIncome as number) / estimatedIncomeTotal) * 100),
      }))
      .sort(positionMetricSort)
    : [];

  return Object.freeze({
    fundCount: positions.length,
    validPatrimonyTotal: round(validPatrimonyTotal, 2),
    patrimonyByFund: Object.freeze(patrimonyByFund),
    largestPosition: patrimonyByFund[0] ?? null,
    topThreeSharePercent,
    patrimonyHhi,
    patrimonyBySegment: Object.freeze(patrimonyBySegment),
    segmentCoveragePercent: validPatrimonyTotal > 0
      ? round((segmentCoveredPatrimony / validPatrimonyTotal) * 100)
      : null,
    estimatedIncomeTotal: estimatedIncomeTotal === null ? null : round(estimatedIncomeTotal, 2),
    incomeByFund: Object.freeze(incomeByFund),
    largestIncomeContributor: incomeByFund[0] ?? null,
    incomeConcentrationPercent: incomeByFund[0]?.sharePercent ?? null,
  });
}

export { average, median, round };
