import type { FundAIInsights } from "@/types/ai-insights";
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
  recommendations: PremiumRecommendation[];
  aiAnalysis: FundAIInsights;
  methodology: string[];
  disclaimer: string[];
};
