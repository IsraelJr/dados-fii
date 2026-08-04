import {
  evaluateFundSeoEligibility,
  type FundSeoEligibilityInput,
  type SeoIndexingDecision,
} from "./SeoEligibilityEvaluator";

export const FUND_SEO_MANIFEST_SCHEMA_VERSION = 1 as const;

export type FundSeoManifestCandidate = {
  input: FundSeoEligibilityInput;
  contentFingerprint?: string | null;
};

export type FundSeoManifestEntry = {
  ticker: string;
  canonicalPath: `/fii/${string}` | null;
  indexable: boolean;
  decision: SeoIndexingDecision;
  score: number;
  lastModified: string | null;
  blockers: string[];
  warnings: string[];
};

export type FundSeoManifest = {
  schemaVersion: typeof FUND_SEO_MANIFEST_SCHEMA_VERSION;
  generatedAt: string;
  total: number;
  indexableTotal: number;
  entries: FundSeoManifestEntry[];
};

function normalizedFingerprint(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
}

function normalizedGeneratedAt(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("INVALID_SEO_MANIFEST_GENERATED_AT");
  return date.toISOString();
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function buildFundSeoManifest(
  candidates: FundSeoManifestCandidate[],
  generatedAt: string | Date,
): FundSeoManifest {
  const fingerprintCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const fingerprint = normalizedFingerprint(candidate.contentFingerprint);
    if (fingerprint) fingerprintCounts.set(fingerprint, (fingerprintCounts.get(fingerprint) || 0) + 1);
  }

  const entries = candidates.map((candidate): FundSeoManifestEntry => {
    const eligibility = evaluateFundSeoEligibility(candidate.input);
    const fingerprint = normalizedFingerprint(candidate.contentFingerprint);
    const editorialBlockers = eligibility.decision === "not-found"
      ? []
      : !fingerprint
        ? ["MISSING_EDITORIAL_FINGERPRINT"]
        : (fingerprintCounts.get(fingerprint) || 0) > 1
          ? ["DUPLICATE_EDITORIAL_CONTENT"]
          : [];
    const blockers = unique([...eligibility.blockers, ...editorialBlockers]);
    const decision: SeoIndexingDecision = eligibility.decision === "not-found"
      ? "not-found"
      : blockers.length
        ? "noindex"
        : "index";

    return {
      ticker: eligibility.ticker,
      canonicalPath: eligibility.ticker ? `/fii/${eligibility.ticker}` : null,
      indexable: decision === "index",
      decision,
      score: eligibility.score,
      lastModified: eligibility.lastModified,
      blockers,
      warnings: eligibility.warnings,
    };
  }).sort((left, right) => left.ticker.localeCompare(right.ticker));

  return {
    schemaVersion: FUND_SEO_MANIFEST_SCHEMA_VERSION,
    generatedAt: normalizedGeneratedAt(generatedAt),
    total: entries.length,
    indexableTotal: entries.filter((entry) => entry.indexable).length,
    entries,
  };
}
