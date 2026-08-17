import {
  comparePortfolioIntelligenceReferences,
  type PortfolioIncrementalComparison,
} from "@/lib/portfolio-intelligence/PortfolioIntelligenceIncremental";
import type { PortfolioIntelligenceReferencePairReader } from "@/server/repositories/FirestorePortfolioIntelligenceReferenceRepositoryCore";

const DEFAULT_PORTFOLIO_ID = "default";
const SHA256 = /^[a-f0-9]{64}$/;

export class PortfolioIncrementalStoredComparisonError extends Error {
  readonly code:
    | "PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED"
    | "PORTFOLIO_INCREMENTAL_REFERENCE_NOT_FOUND"
    | "PORTFOLIO_INCREMENTAL_REFERENCE_FINGERPRINT_MISMATCH";

  constructor(
    code:
      | "PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED"
      | "PORTFOLIO_INCREMENTAL_REFERENCE_NOT_FOUND"
      | "PORTFOLIO_INCREMENTAL_REFERENCE_FINGERPRINT_MISMATCH",
  ) {
    super(code);
    this.name = "PortfolioIncrementalStoredComparisonError";
    this.code = code;
  }
}

export class PortfolioIncrementalStoredComparisonService {
  private readonly references: PortfolioIntelligenceReferencePairReader;

  constructor(references: PortfolioIntelligenceReferencePairReader) {
    this.references = references;
  }

  async load(input: Readonly<{
    ownerId: string;
    portfolioId?: unknown;
    currentFingerprint: unknown;
    comparisonId: unknown;
  }>): Promise<PortfolioIncrementalComparison> {
    const portfolioId = String(input.portfolioId ?? DEFAULT_PORTFOLIO_ID).trim();
    if (portfolioId !== DEFAULT_PORTFOLIO_ID) {
      throw new PortfolioIncrementalStoredComparisonError(
        "PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED",
      );
    }
    const currentFingerprint = String(input.currentFingerprint ?? "").trim();
    if (!SHA256.test(currentFingerprint)) {
      throw new PortfolioIncrementalStoredComparisonError(
        "PORTFOLIO_INCREMENTAL_REFERENCE_FINGERPRINT_MISMATCH",
      );
    }
    const comparisonId = String(input.comparisonId ?? "").trim();
    if (!SHA256.test(comparisonId)) {
      throw new PortfolioIncrementalStoredComparisonError(
        "PORTFOLIO_INCREMENTAL_REFERENCE_FINGERPRINT_MISMATCH",
      );
    }
    const pair = await this.references.readPair({
      ownerId: input.ownerId,
      portfolioId,
    });
    if (!pair) {
      throw new PortfolioIncrementalStoredComparisonError(
        "PORTFOLIO_INCREMENTAL_REFERENCE_NOT_FOUND",
      );
    }
    if (pair.current.fingerprint !== currentFingerprint) {
      throw new PortfolioIncrementalStoredComparisonError(
        "PORTFOLIO_INCREMENTAL_REFERENCE_FINGERPRINT_MISMATCH",
      );
    }
    const comparison = comparePortfolioIntelligenceReferences(pair.previous, pair.current);
    if (comparison.comparisonId !== comparisonId) {
      throw new PortfolioIncrementalStoredComparisonError(
        "PORTFOLIO_INCREMENTAL_REFERENCE_FINGERPRINT_MISMATCH",
      );
    }
    return comparison;
  }
}
