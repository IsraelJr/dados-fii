export type SeoIndexingDecision = "index" | "noindex" | "not-found";

export type FundSeoEligibilityInput = {
  ticker: unknown;
  publicRecordFound?: boolean;
  catalog?: {
    identity?: {
      cnpj?: unknown;
      legalName?: unknown;
      kind?: unknown;
    } | null;
    classification?: {
      sector?: unknown;
      segment?: unknown;
      strategy?: unknown;
    } | null;
    lifecycle?: {
      status?: unknown;
      b3Listed?: unknown;
      canceledAt?: unknown;
    } | null;
    provenance?: {
      sourceIds?: unknown;
      referenceDate?: unknown;
      generatedAt?: unknown;
    } | null;
    dataQuality?: {
      basicComplete?: unknown;
      essentialComplete?: unknown;
      warnings?: unknown;
    } | null;
  } | null;
  market?: {
    price?: unknown;
    asOf?: unknown;
    plausible?: boolean | null;
  } | null;
  dividend?: {
    value?: unknown;
    competence?: unknown;
    source?: unknown;
    asOf?: unknown;
    plausible?: boolean | null;
  } | null;
  valuation?: {
    pvp?: unknown;
    navPerShare?: unknown;
    asOf?: unknown;
    explicitlyUnavailable?: boolean;
    plausible?: boolean | null;
  } | null;
  editorial?: {
    explanation?: unknown;
    unique?: boolean;
    reviewedAt?: unknown;
    sourceLabel?: unknown;
  } | null;
  technical?: {
    canonicalPath?: unknown;
    httpStatus?: unknown;
    privateDataDetected?: boolean;
  } | null;
};

export type FundSeoEligibility = {
  ticker: string;
  decision: SeoIndexingDecision;
  score: number;
  blockers: string[];
  warnings: string[];
  lastModified: string | null;
};

const INDEXING_SCORE_THRESHOLD = 80;
const ACTIVE_FUND_KINDS = new Set(["FII", "FIAGRO", "FI_INFRA"]);
const NOT_FOUND_BLOCKERS = new Set([
  "INVALID_TICKER",
  "FUND_NOT_FOUND",
  "INACTIVE_FUND",
  "NOT_LISTED_ON_B3",
]);

function normalizedTicker(value: unknown) {
  const ticker = String(value || "").trim().toUpperCase();
  return /^[A-Z]{4}\d{2}$/.test(ticker) ? ticker : "";
}

function text(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function positiveNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const raw = String(value ?? "").replace("R$", "").replace("%", "").replace(/\s/g, "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function cnpj(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

function isoDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function latestDate(values: unknown[]) {
  const dates = values.flatMap((value) => {
    const normalized = isoDate(value);
    return normalized ? [normalized] : [];
  });
  return dates.sort((left, right) => right.localeCompare(left))[0] || null;
}

function sourceIds(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => Boolean(text(item))) : [];
}

function catalogWarnings(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => {
      const warning = text(item);
      return warning ? [warning] : [];
    })
    : [];
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function evaluateFundSeoEligibility(input: FundSeoEligibilityInput): FundSeoEligibility {
  const ticker = normalizedTicker(input.ticker);
  const catalog = input.catalog || null;
  const publicRecordFound = input.publicRecordFound ?? Boolean(catalog);
  const identity = catalog?.identity || null;
  const classification = catalog?.classification || null;
  const lifecycle = catalog?.lifecycle || null;
  const provenance = catalog?.provenance || null;
  const dataQuality = catalog?.dataQuality || null;
  const blockers: string[] = [];
  const warnings = catalogWarnings(dataQuality?.warnings);
  let score = 0;

  if (ticker) score += 4;
  else blockers.push("INVALID_TICKER");

  if (!publicRecordFound) blockers.push("FUND_NOT_FOUND");
  else if (!catalog) blockers.push("MISSING_OFFICIAL_CATALOG");

  const lifecycleStatus = text(lifecycle?.status)?.toLowerCase() || null;
  if (lifecycleStatus === "inactive" || isoDate(lifecycle?.canceledAt)) blockers.push("INACTIVE_FUND");
  if (lifecycleStatus === "under_review") blockers.push("IDENTITY_UNDER_REVIEW");
  if (lifecycle?.b3Listed === false) blockers.push("NOT_LISTED_ON_B3");

  if (cnpj(identity?.cnpj)) score += 6;
  else blockers.push("MISSING_CONFIRMED_CNPJ");

  if (text(identity?.legalName)) score += 4;
  else blockers.push("MISSING_LEGAL_NAME");

  if (lifecycleStatus === "active" && lifecycle?.b3Listed !== false) score += 6;
  else if (catalog && !lifecycleStatus) blockers.push("MISSING_LIFECYCLE_STATUS");

  const fundKind = text(identity?.kind)?.toUpperCase() || "";
  if (ACTIVE_FUND_KINDS.has(fundKind)) score += 3;
  else blockers.push("MISSING_OR_INVALID_FUND_KIND");

  if (text(classification?.sector)) score += 3;
  else blockers.push("MISSING_SECTOR");

  if (text(classification?.segment) || text(classification?.strategy)) score += 4;
  else blockers.push("MISSING_SEGMENT_OR_STRATEGY");

  const marketPrice = positiveNumber(input.market?.price);
  if (marketPrice) score += 8;
  else blockers.push("MISSING_PRICE");

  if (isoDate(input.market?.asOf)) score += 4;
  else blockers.push("MISSING_PRICE_DATE");

  if (marketPrice && input.market?.plausible !== false) score += 3;
  if (input.market?.plausible === false) blockers.push("IMPLAUSIBLE_PRICE");

  const dividendValue = positiveNumber(input.dividend?.value);
  if (dividendValue) score += 6;
  else blockers.push("MISSING_DIVIDEND");

  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text(input.dividend?.competence) || "")) score += 4;
  else blockers.push("MISSING_DIVIDEND_COMPETENCE");

  if (text(input.dividend?.source)) score += 3;
  else blockers.push("MISSING_DIVIDEND_SOURCE");

  if (isoDate(input.dividend?.asOf)) score += 2;
  else blockers.push("MISSING_DIVIDEND_DATE");

  if (input.dividend?.plausible === false) blockers.push("IMPLAUSIBLE_DIVIDEND");

  const valuationAvailable = Boolean(
    positiveNumber(input.valuation?.pvp)
    || positiveNumber(input.valuation?.navPerShare),
  );
  if (input.valuation?.explicitlyUnavailable === true) {
    score += 10;
    warnings.push("VALUATION_EXPLICITLY_UNAVAILABLE");
  } else if (valuationAvailable) {
    score += 7;
    if (input.valuation?.plausible !== false) score += 3;
  } else {
    blockers.push("MISSING_VALUATION_CONTEXT");
  }
  if (input.valuation?.plausible === false) blockers.push("IMPLAUSIBLE_VALUATION");

  const provenanceSources = sourceIds(provenance?.sourceIds);
  if (provenanceSources.length) score += 4;
  else blockers.push("MISSING_PROVENANCE_SOURCES");

  if (isoDate(provenance?.referenceDate)) score += 3;
  else blockers.push("MISSING_PROVENANCE_REFERENCE_DATE");

  if (isoDate(provenance?.generatedAt)) score += 3;
  else blockers.push("MISSING_PROVENANCE_GENERATED_AT");

  const explanation = text(input.editorial?.explanation);
  if (explanation && explanation.length >= 120) score += 8;
  else blockers.push("INSUFFICIENT_EDITORIAL_EXPLANATION");

  if (input.editorial?.unique === true) score += 4;
  else blockers.push("NON_UNIQUE_EDITORIAL_CONTENT");

  if (isoDate(input.editorial?.reviewedAt)) score += 2;
  else blockers.push("MISSING_EDITORIAL_REVIEW_DATE");

  if (text(input.editorial?.sourceLabel)) score += 1;
  else blockers.push("MISSING_EDITORIAL_SOURCE_LABEL");

  if (ticker && text(input.technical?.canonicalPath) === `/fii/${ticker}`) score += 2;
  else blockers.push("INVALID_CANONICAL_PATH");

  if (input.technical?.httpStatus === 200) score += 1;
  else blockers.push("INVALID_HTTP_STATUS");

  if (input.technical?.privateDataDetected === false) score += 2;
  else blockers.push("PRIVATE_DATA_DETECTED");

  if (dataQuality?.basicComplete === false) blockers.push("INCOMPLETE_BASIC_CATALOG");
  if (dataQuality?.essentialComplete === false) warnings.push("INCOMPLETE_ESSENTIAL_CATALOG");

  const lastModified = latestDate([
    input.editorial?.reviewedAt,
    input.market?.asOf,
    input.dividend?.asOf,
    input.valuation?.asOf,
    provenance?.referenceDate,
    provenance?.generatedAt,
  ]);
  if (!lastModified) blockers.push("MISSING_LAST_MODIFIED");

  if (score < INDEXING_SCORE_THRESHOLD) blockers.push("SCORE_BELOW_MINIMUM");

  const normalizedBlockers = unique(blockers);
  const decision: SeoIndexingDecision = normalizedBlockers.some((blocker) => NOT_FOUND_BLOCKERS.has(blocker))
    ? "not-found"
    : normalizedBlockers.length
      ? "noindex"
      : "index";

  return {
    ticker,
    decision,
    score,
    blockers: normalizedBlockers,
    warnings: unique(warnings),
    lastModified,
  };
}
