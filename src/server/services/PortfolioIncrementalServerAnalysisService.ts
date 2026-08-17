import type {
  PortfolioIntelligenceInput,
  PortfolioIntelligenceResult,
} from "@/lib/portfolio-intelligence/PortfolioIntelligence";
import {
  comparePortfolioIntelligenceReferences,
  type PortfolioIntelligenceReference,
} from "@/lib/portfolio-intelligence/PortfolioIntelligenceIncremental";
import type {
  PortfolioIncrementalAnalysisResult,
  PortfolioIntelligenceReferenceRepository,
} from "@/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalService";

const DEFAULT_PORTFOLIO_ID = "default";

export type PortfolioIntelligenceCanonicalInputLoader = Readonly<{
  load(input: Readonly<{
    ownerId: string;
    portfolioId: string;
    asOf: Date | string;
  }>): Promise<PortfolioIntelligenceInput>;
}>;

export type PortfolioIntelligenceAnalyzer = Readonly<{
  analyze(
    input: PortfolioIntelligenceInput,
    options: Readonly<{ asOf: Date | string; generatedAt?: Date | string }>,
  ): PortfolioIntelligenceResult;
}>;

export type PortfolioIntelligenceServerReferenceFactory = Readonly<{
  create(
    result: PortfolioIntelligenceResult,
    canonicalInput: PortfolioIntelligenceInput,
  ): PortfolioIntelligenceReference;
}>;

export type PortfolioIncrementalServerAnalysisServiceDependencies = Readonly<{
  input: PortfolioIntelligenceCanonicalInputLoader;
  analyzer: PortfolioIntelligenceAnalyzer;
  references: PortfolioIntelligenceReferenceRepository;
  referenceFactory: PortfolioIntelligenceServerReferenceFactory;
  clock?: () => Date;
}>;

function ownerIdFrom(value: unknown) {
  const ownerId = String(value ?? "").trim();
  if (!ownerId || ownerId.length > 512) throw new Error("PORTFOLIO_INCREMENTAL_OWNER_INVALID");
  return ownerId;
}

function defaultPortfolioId(value: unknown) {
  const portfolioId = String(value ?? DEFAULT_PORTFOLIO_ID).trim();
  if (portfolioId !== DEFAULT_PORTFOLIO_ID) {
    throw new Error("PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED");
  }
  return DEFAULT_PORTFOLIO_ID;
}

function asOfFrom(value: Date | string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("PORTFOLIO_INCREMENTAL_AS_OF_INVALID");
  return date.toISOString();
}

export class PortfolioIncrementalServerAnalysisService {
  private readonly input: PortfolioIntelligenceCanonicalInputLoader;
  private readonly analyzer: PortfolioIntelligenceAnalyzer;
  private readonly references: PortfolioIntelligenceReferenceRepository;
  private readonly referenceFactory: PortfolioIntelligenceServerReferenceFactory;
  private readonly clock: () => Date;

  constructor(dependencies: PortfolioIncrementalServerAnalysisServiceDependencies) {
    this.input = dependencies.input;
    this.analyzer = dependencies.analyzer;
    this.references = dependencies.references;
    this.referenceFactory = dependencies.referenceFactory;
    this.clock = dependencies.clock ?? (() => new Date());
  }

  async compareAndStore(input: Readonly<{
    ownerId: string;
    portfolioId?: unknown;
    asOf?: Date | string;
  }>): Promise<PortfolioIncrementalAnalysisResult> {
    const ownerId = ownerIdFrom(input.ownerId);
    const portfolioId = defaultPortfolioId(input.portfolioId);
    // Capture the clock exactly once. The same value is propagated through the
    // regulatory batch and the deterministic analysis.
    const asOf = asOfFrom(input.asOf ?? this.clock());
    const canonicalInput = await this.input.load({ ownerId, portfolioId, asOf });
    const analysis = this.analyzer.analyze(canonicalInput, {
      asOf,
      generatedAt: asOf,
    });
    const current = this.referenceFactory.create(analysis, canonicalInput);
    const stored = await this.references.compareAndStore({ ownerId, portfolioId, current });

    return Object.freeze({
      comparison: comparePortfolioIntelligenceReferences(stored.previous, stored.current),
      persistence: Object.freeze({
        stored: stored.stored,
        baselineState: stored.baselineState,
      }),
    });
  }
}
