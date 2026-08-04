import type { PortfolioIntelligenceResult } from "./PortfolioIntelligence";
import {
  comparePortfolioIntelligenceReferences,
  createPortfolioIntelligenceReference,
  normalizePortfolioId,
  type PortfolioIncrementalComparison,
  type PortfolioIntelligenceReference,
} from "./PortfolioIntelligenceIncremental";

export type PortfolioIncrementalBaselineState = "found" | "missing" | "invalid";

export type PortfolioIntelligenceReferenceStoreResult = Readonly<{
  previous: PortfolioIntelligenceReference | null;
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

export class PortfolioIntelligenceIncrementalService {
  constructor(private readonly repository: PortfolioIntelligenceReferenceRepository) {}

  async compareAndStore(input: Readonly<{
    ownerId: string;
    portfolioId?: unknown;
    result: PortfolioIntelligenceResult | unknown;
  }>): Promise<PortfolioIncrementalAnalysisResult> {
    const ownerId = String(input.ownerId ?? "").trim();
    if (!ownerId || ownerId.length > 256) throw new Error("PORTFOLIO_INCREMENTAL_OWNER_INVALID");
    const portfolioId = normalizePortfolioId(input.portfolioId);
    const current = createPortfolioIntelligenceReference(input.result);
    const stored = await this.repository.compareAndStore({ ownerId, portfolioId, current });
    return Object.freeze({
      comparison: comparePortfolioIntelligenceReferences(stored.previous, current),
      persistence: Object.freeze({
        stored: stored.stored,
        baselineState: stored.baselineState,
      }),
    });
  }
}
