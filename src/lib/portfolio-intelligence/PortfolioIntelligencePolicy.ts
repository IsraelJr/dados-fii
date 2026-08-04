export const PORTFOLIO_INTELLIGENCE_POLICY_VERSION = "1.0.0" as const;

export type PortfolioIntelligencePolicy = Readonly<{
  version: string;
  trend: Readonly<{
    minimumMonths: number;
    blockSize: number;
    risingThresholdPercent: number;
    fallingThresholdPercent: number;
  }>;
  instability: Readonly<{
    windowMonths: number;
    attentionThresholdPercent: number;
    signalThresholdPercent: number;
    standardDeviation: "population";
  }>;
  concentration: Readonly<{
    largestPositionThresholdPercent: number;
    topThreeThresholdPercent: number;
    hhiThreshold: number;
    highConfidenceCoveragePercent: number;
    minimumCoveragePercent: number;
  }>;
  income: Readonly<{
    singleFundThresholdPercent: number;
  }>;
  segments: Readonly<{
    minimumCoveragePercent: number;
    concentrationThresholdPercent: number;
    highConfidenceCoveragePercent: number;
  }>;
  outlier: Readonly<{
    baselineMonths: number;
    robustScoreThreshold: number;
    minimumRelativeDeviationPercent: number;
    constantBaselineMinimumDifference: number;
  }>;
}>;

export const PORTFOLIO_INTELLIGENCE_POLICY: PortfolioIntelligencePolicy = Object.freeze({
  version: PORTFOLIO_INTELLIGENCE_POLICY_VERSION,
  trend: Object.freeze({
    minimumMonths: 6,
    blockSize: 3,
    risingThresholdPercent: 5,
    fallingThresholdPercent: -5,
  }),
  instability: Object.freeze({
    windowMonths: 6,
    attentionThresholdPercent: 10,
    signalThresholdPercent: 20,
    standardDeviation: "population" as const,
  }),
  concentration: Object.freeze({
    largestPositionThresholdPercent: 30,
    topThreeThresholdPercent: 70,
    hhiThreshold: 2_500,
    highConfidenceCoveragePercent: 95,
    minimumCoveragePercent: 70,
  }),
  income: Object.freeze({
    singleFundThresholdPercent: 35,
  }),
  segments: Object.freeze({
    minimumCoveragePercent: 70,
    concentrationThresholdPercent: 50,
    highConfidenceCoveragePercent: 95,
  }),
  outlier: Object.freeze({
    baselineMonths: 6,
    robustScoreThreshold: 3.5,
    minimumRelativeDeviationPercent: 50,
    constantBaselineMinimumDifference: 0.01,
  }),
});
