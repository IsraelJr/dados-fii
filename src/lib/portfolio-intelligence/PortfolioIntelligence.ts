export type PortfolioIntelligenceConfidence = "low" | "medium" | "high";
export type PortfolioIntelligenceQualityState = "sufficient" | "partial" | "insufficient";
export type PortfolioIntelligenceSeverity = "info" | "attention" | "warning";

export type PortfolioIntelligenceSignalCode =
  | "RENDA_EM_ALTA"
  | "RENDA_EM_QUEDA"
  | "RENDA_ESTAVEL"
  | "RENDA_INSTAVEL"
  | "CONCENTRACAO_ELEVADA"
  | "CONCENTRACAO_POR_SEGMENTO"
  | "DEPENDENCIA_DE_UM_FUNDO"
  | "MES_ATIPICO_POSITIVO"
  | "MES_ATIPICO_NEGATIVO"
  | "DADOS_INSUFICIENTES";

export type PortfolioIntelligenceWarningCode =
  | "CURRENT_COMPETENCE_IGNORED"
  | "FUTURE_COMPETENCE_IGNORED"
  | "INVALID_INPUT_REJECTED"
  | "ZERO_BASE_VARIATION_UNAVAILABLE"
  | "PATRIMONY_COVERAGE_UNDETERMINED"
  | "INCOME_COVERAGE_INSUFFICIENT"
  | "SEGMENT_COVERAGE_INSUFFICIENT"
  | "OUTLIER_ZERO_MAD_FALLBACK";

export type PortfolioIntelligenceSnapshotInput = Readonly<{
  competence: string;
  dividends: number | null;
}>;

export type PortfolioIntelligencePositionInput = Readonly<{
  ticker: string;
  quantity: number;
  price: number | null;
  estimatedIncome: number | null;
  segment: string | null;
}>;

export type PortfolioIntelligenceInput = Readonly<{
  snapshots: readonly PortfolioIntelligenceSnapshotInput[];
  positions: readonly PortfolioIntelligencePositionInput[];
}>;

export type PortfolioIntelligenceMonthMetric = Readonly<{
  competence: string;
  value: number;
}>;

export type PortfolioIntelligenceOutlierMetric = Readonly<{
  competence: string;
  value: number;
  baselineMedian: number;
  mad: number;
  robustScore: number | null;
  relativeDeviationPercent: number | null;
  direction: "positive" | "negative";
  method: "mad" | "mean_absolute_deviation_fallback" | "constant_baseline_fallback";
}>;

export type PortfolioIntelligenceIncomeMetrics = Readonly<{
  validMonthCount: number;
  latestClosedCompetence: string | null;
  latestIncome: number | null;
  previousIncome: number | null;
  monthlyVariationPercent: number | null;
  recentThreeMonthAverage: number | null;
  previousThreeMonthAverage: number | null;
  blockVariationPercent: number | null;
  sixMonthAverage: number | null;
  sixMonthPopulationStandardDeviation: number | null;
  sixMonthCoefficientOfVariationPercent: number | null;
  median: number | null;
  bestMonth: PortfolioIntelligenceMonthMetric | null;
  worstMonth: PortfolioIntelligenceMonthMetric | null;
  outlier: PortfolioIntelligenceOutlierMetric | null;
  latestSixMonthsAreConsecutive: boolean;
}>;

export type PortfolioIntelligencePositionMetric = Readonly<{
  ticker: string;
  value: number;
  sharePercent: number;
}>;

export type PortfolioIntelligenceIncomePositionMetric = Readonly<{
  ticker: string;
  income: number;
  sharePercent: number;
}>;

export type PortfolioIntelligenceSegmentMetric = Readonly<{
  segment: string;
  value: number;
  sharePercent: number;
}>;

export type PortfolioIntelligencePortfolioMetrics = Readonly<{
  fundCount: number;
  validPatrimonyTotal: number;
  patrimonyByFund: readonly PortfolioIntelligencePositionMetric[];
  largestPosition: PortfolioIntelligencePositionMetric | null;
  topThreeSharePercent: number | null;
  patrimonyHhi: number | null;
  patrimonyBySegment: readonly PortfolioIntelligenceSegmentMetric[];
  segmentCoveragePercent: number | null;
  estimatedIncomeTotal: number | null;
  incomeByFund: readonly PortfolioIntelligenceIncomePositionMetric[];
  largestIncomeContributor: PortfolioIntelligenceIncomePositionMetric | null;
  incomeConcentrationPercent: number | null;
}>;

export type PortfolioIntelligenceMetrics = Readonly<{
  income: PortfolioIntelligenceIncomeMetrics;
  portfolio: PortfolioIntelligencePortfolioMetrics;
}>;

export type PortfolioIntelligenceDataQuality = Readonly<{
  state: PortfolioIntelligenceQualityState;
  pricedPositionCount: number;
  unpricedPositionCount: number;
  patrimonyCoveredByValidData: number;
  patrimonyCoveragePercent: number | null;
  knownSegmentPositionCount: number;
  segmentCoveredPatrimony: number;
  segmentCoveragePercent: number | null;
  incomeKnownPositionCount: number;
  incomeCoveragePercent: number | null;
  monthsAvailable: number;
  monthsRequired: number;
  missingFields: readonly string[];
  confidence: Readonly<{
    trend: PortfolioIntelligenceConfidence;
    concentration: PortfolioIntelligenceConfidence;
    segments: PortfolioIntelligenceConfidence;
    income: PortfolioIntelligenceConfidence;
  }>;
}>;

export type PortfolioIntelligenceSignal = Readonly<{
  code: PortfolioIntelligenceSignalCode;
  severity: PortfolioIntelligenceSeverity;
  title: string;
  summary: string;
  confidence: PortfolioIntelligenceConfidence;
  evidence: Readonly<Record<string, string | number | boolean | null>>;
  policyVersion: string;
}>;

export type PortfolioIntelligenceWarning = Readonly<{
  code: PortfolioIntelligenceWarningCode;
  message: string;
  competence?: string;
}>;

export type PortfolioIntelligenceResult = Readonly<{
  policyVersion: string;
  generatedAt: string;
  asOf: string;
  metrics: PortfolioIntelligenceMetrics;
  signals: readonly PortfolioIntelligenceSignal[];
  dataQuality: PortfolioIntelligenceDataQuality;
  warnings: readonly PortfolioIntelligenceWarning[];
}>;

export class PortfolioIntelligenceValidationError extends Error {
  readonly code:
    | "INVALID_AS_OF"
    | "INVALID_COMPETENCE"
    | "DUPLICATE_COMPETENCE"
    | "INVALID_DIVIDENDS"
    | "INVALID_TICKER"
    | "DUPLICATE_POSITION"
    | "INVALID_QUANTITY"
    | "INVALID_PRICE"
    | "INVALID_ESTIMATED_INCOME";

  constructor(
    code:
      | "INVALID_AS_OF"
      | "INVALID_COMPETENCE"
      | "DUPLICATE_COMPETENCE"
      | "INVALID_DIVIDENDS"
      | "INVALID_TICKER"
      | "DUPLICATE_POSITION"
      | "INVALID_QUANTITY"
      | "INVALID_PRICE"
      | "INVALID_ESTIMATED_INCOME",
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "PortfolioIntelligenceValidationError";
  }
}
