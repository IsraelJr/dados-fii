import {
  type PortfolioIncrementalComparison,
  type PortfolioIntelligenceReference,
} from "./PortfolioIntelligenceIncremental";

export type PortfolioIncrementalBaselineState = "found" | "missing" | "invalid";

export type PortfolioIntelligenceReferenceStoreResult = Readonly<{
  previous: PortfolioIntelligenceReference | null;
  current: PortfolioIntelligenceReference;
  stored: boolean;
  baselineState: PortfolioIncrementalBaselineState;
}>;

export interface PortfolioIntelligenceReferenceRepository {
  compareAndStore(input: Readonly<{
    ownerId: string;
    portfolioId: string;
    current: PortfolioIntelligenceReference;
  }>): Promise<PortfolioIntelligenceReferenceStoreResult>;
}

export type PortfolioIncrementalAnalysisResult = Readonly<{
  comparison: PortfolioIncrementalComparison;
  persistence: Readonly<{
    stored: boolean;
    baselineState: PortfolioIncrementalBaselineState;
  }>;
}>;
