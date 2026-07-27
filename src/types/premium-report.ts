import type { PremiumAIInsights } from "@/types/ai-insights";
import type { FreeFundReport } from "@/types/reports";
import type { FundScores } from "@/types/scores";

export type PremiumValuation = {
  price: number | null;
  pvp: number | null;
  estimatedNavPerShare: number | null;
  premiumDiscountPercent: number | null;
  assessment: "discount" | "fair" | "premium" | "insufficient";
  explanation: string;
};

export type PremiumStressCase = {
  id: "mild" | "moderate" | "severe";
  label: string;
  priceShockPercent: number;
  dividendShockPercent: number;
  stressedPrice: number | null;
  stressedMonthlyDividend: number | null;
  annualizedYieldPercent: number | null;
  estimatedScore: number | null;
  explanation: string;
};

export type PremiumScenario = {
  id: "positive" | "base" | "adverse";
  label: string;
  assumptions: string[];
  projectedPrice: number | null;
  projectedMonthlyDividend: number | null;
  projectedAnnualizedYieldPercent: number | null;
  explanation: string;
};

export type PremiumComparative = {
  peerGroup: string;
  peerCount: number;
  percentile: number | null;
  sampleReliable: boolean;
  explanation: string;
  current: Record<keyof Pick<FundScores, "risk" | "dividend" | "governance" | "growth" | "liquidity" | "quality" | "premium">, number | null>;
  peerAverage: Record<keyof Pick<FundScores, "risk" | "dividend" | "governance" | "growth" | "liquidity" | "quality" | "premium">, number | null>;
};

export type PremiumPortfolioProjection = {
  id: string;
  projectedPositionValue: number | null;
  positionValueChange: number | null;
  projectedMonthlyIncome: number | null;
  monthlyIncomeChange: number | null;
};

export type PremiumPortfolioImpact = {
  available: boolean;
  holdingQuotas: number | null;
  currentPositionValue: number | null;
  estimatedMonthlyIncome: number | null;
  portfolioValue: number | null;
  portfolioWeightPercent: number | null;
  coveredHoldings: number;
  totalHoldings: number;
  summary: string;
  stressTests: PremiumPortfolioProjection[];
  scenarios: PremiumPortfolioProjection[];
};

export type PremiumRecommendation = {
  priority: "high" | "medium" | "low";
  category: string;
  action: string;
  trigger: string;
  rationale: string;
};

export type PremiumRiskLabReadOnly = {
  schemaVersion: 1;
  mode: "read_only";
  registryVersion: "premium-readonly-v1";
  rulesetVersion: "0.2.0";
  datasetId: string;
  datasetHash: string;
  evidenceHash: string;
  availability: "disabled" | "available" | "outside_verified_cohort" | "inconclusive" | "insufficient_data";
  applicabilityCategory: "paper_credit" | "development" | "brick" | "fiagro" | "fi_infra" | "fund_of_funds" | "hybrid" | "unknown";
  categoryPolicyVersion: "risk-lab-category-policy-v1";
  categoryCalibrated: boolean;
  groundTruthStatus: "verified" | "blocked" | null;
  outcome: "verified_correct" | "inconclusive_unscored" | null;
  status: "no_qualifying_stress" | "stress_without_recovery" | "reversible_stress_confirmed" | "inconclusive_unscored" | null;
  disposition: "none" | "informational_recovery" | "elevated_risk" | "inconclusive" | null;
  riskAlert: boolean | null;
  stressDetectedAt: string | null;
  recoveryDetectedAt: string | null;
  recoveryPercentOfBaseline: number | null;
  summary: string;
  limitations: string[];
  readOnly: true;
  notificationsAllowed: false;
  externalEffectsAllowed: false;
};

export type PremiumManagerMode = {
  version: "premium-manager-mode-v3";
  dataQualityScore: number;
  dataQualityLevel: "high" | "medium" | "low";
  availableInputs: string[];
  missingInputs: string[];
  objectiveReading: string[];
  limitations: string[];
  actionability: "monitoring_only";
  controlPrinciple: string;
};

export type PremiumFundReport = {
  reportVersion: string;
  ticker: string;
  generatedAt: string;
  freeReport: FreeFundReport;
  valuation: PremiumValuation;
  stressTest: PremiumStressCase[];
  scenarios: PremiumScenario[];
  comparative: PremiumComparative;
  portfolioImpact: PremiumPortfolioImpact;
  riskLab: PremiumRiskLabReadOnly;
  managerMode: PremiumManagerMode;
  recommendations: PremiumRecommendation[];
  aiAnalysis: PremiumAIInsights;
  auditReceipt: {
    eventId: string;
    action: "premium-read";
    createdAt: string;
    correlationId: string;
  };
  methodology: string[];
  disclaimer: string[];
};
