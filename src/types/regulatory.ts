import type { FundScores } from "@/types/scores";
import type { IndexMembership } from "@/types/indexes";

export const REGULATORY_SCHEMA_VERSION = 1 as const;

export type FundKind = "FII" | "FIAGRO" | "FI_INFRA" | "UNKNOWN";
export type ValidationSeverity = "error" | "warning";
export type ParserStatus = "healthy" | "degraded" | "down" | "unknown";
export type HealthStatus = ParserStatus | "disabled";
export type DataQualityStatus = "valid" | "partial" | "stale" | "invalid" | "unavailable";

export type ValidationIssue = {
  code: string;
  field?: string;
  message: string;
  severity: ValidationSeverity;
};

export type DataQualityAssessment = {
  status: DataQualityStatus;
  valid: boolean;
  confidence: number;
  reasons: string[];
  missingFields: string[];
  invalidFields: string[];
  freshness: {
    status: "current" | "stale" | "unknown";
    asOf: string | null;
    ageDays: number | null;
    maxAgeDays: number;
  };
};

export type CanonicalFinancialMetric = {
  value: number | null;
  unit: "percent";
  numerator: { field: string; value: number | null; unit: "BRL_per_share" };
  denominator: { field: string; value: number | null; unit: "BRL_per_share"; asOf: string | null };
  formulaVersion: string;
  source: string;
  asOf: string | null;
  reason?: string;
};

export type CanonicalDividendMetrics = {
  dy12mCurrentPrice: CanonicalFinancialMetric;
  lastDividendYieldAtBaseDate: CanonicalFinancialMetric;
  distributionOnNav12m: CanonicalFinancialMetric;
  legacyConflict: {
    detected: boolean;
    legacyValue: number | null;
    canonicalValue: number | null;
    absoluteDifferencePercentagePoints: number | null;
  };
};

export type RegulatorySource = {
  provider: string;
  kind: "legacy" | "regulatory" | "market" | "manual";
  fetchedAt?: string | null;
  parserVersion?: string | null;
};

export type RegulatoryFund = {
  schemaVersion: typeof REGULATORY_SCHEMA_VERSION;
  ticker: string;
  kind: FundKind;
  name?: string | null;
  corporateName?: string | null;
  cnpj?: string | null;
  segment?: string | null;
  manager?: string | null;
  administrator?: string | null;
  status?: "active" | "inactive" | "unknown";
  currentVersion: number;
  publishedAt?: string | null;
  publishedBy?: string | null;
  sources: RegulatorySource[];
  raw: Record<string, unknown>;
};

export type MarketQuote = {
  code: string;
  price: string;
  opening?: string;
  variation?: string;
  minimum?: string;
  maximum?: string;
};

export type PublicFundData = Record<string, unknown> & {
  code: string;
  ticker: string;
  fundKind: FundKind;
  isIFIX?: boolean;
  ifixMembership?: IndexMembership;
  regulatoryMeta: {
    schemaVersion: number;
    currentVersion: number;
    cache: "hit" | "miss";
    sources: RegulatorySource[];
    validation: {
      valid: boolean;
      status?: DataQualityStatus;
      issues: ValidationIssue[];
      assessment?: DataQualityAssessment;
    };
  };
  canonicalDividendMetrics?: CanonicalDividendMetrics;
  scores?: FundScores;
};

export type ValidationFundResult = {
  ticker: string;
  kind: FundKind;
  valid: boolean;
  issues: ValidationIssue[];
};

export type ValidationCheck = {
  id: string;
  status: "passed" | "warning" | "failed";
  message: string;
  durationMs?: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ValidationRun = {
  id: string;
  status: "completed" | "failed";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  actor: string;
  totals: {
    processed: number;
    valid: number;
    invalid: number;
    errors: number;
    warnings: number;
  };
  healthScore: number;
  results: ValidationFundResult[];
  parserHealth: ParserHealth[];
  checks: ValidationCheck[];
  coverage: {
    fii: number;
    fiagro: number;
    fiInfra: number;
    unknown: number;
  };
  error?: string;
};

export type ParserHealth = {
  parser: string;
  status: ParserStatus;
  successRate: number;
  successes: number;
  failures: number;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastError?: string | null;
  updatedAt: string;
};

export type SystemHealth = {
  ok: boolean;
  status: HealthStatus;
  score: number;
  generatedAt: string;
  components: {
    firestore: HealthComponent;
    parser: HealthComponent;
    qa: HealthComponent;
    publication: HealthComponent;
    rollback: HealthComponent;
    cache: HealthComponent;
    score: HealthComponent;
  };
  latestValidation: Omit<ValidationRun, "results"> | null;
  parsers: ParserHealth[];
  cache: {
    entries: number;
    ttlMs: number;
    marketTtlMs: number;
    funds: CacheMetrics;
    market: CacheMetrics;
  };
  collections: Record<string, string>;
};

export type CacheMetrics = {
  entries: number;
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  expired: number;
  hitRate: number;
  maxEntries: number;
  ttlMs: number;
};

export type HealthComponent = {
  status: HealthStatus;
  score: number;
  message: string;
  checkedAt: string;
  latencyMs?: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export type RepositoryProbe = {
  ok: boolean;
  latencyMs: number;
  legacyFundsAvailable: boolean;
  error?: string;
};

export type RegulatoryAuditEvent = {
  id: string;
  action: "publish" | "rollback" | "validation" | string;
  actor?: string | null;
  ticker?: string | null;
  createdAt: string | null;
  metadata?: Record<string, unknown>;
};
