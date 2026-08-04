import { plausiblePvpValue } from "@/lib/fiiDerivedData";
import type { PublicFundData, RegulatorySource } from "@/types/regulatory";
import {
  evaluateFundSeoEligibility,
  type FundSeoEligibility,
  type FundSeoEligibilityInput,
} from "./SeoEligibilityEvaluator";

export type FundSeoEditorialReview = {
  explanation: string;
  reviewedAt: string;
  sourceLabel: string;
  unique: boolean;
};

const MONTH_INDEX: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value ?? "").replace("R$", "").replace("%", "").replace(/\s/g, "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value: unknown) {
  const normalized = text(value);
  if (!normalized) return null;
  const br = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const date = br
    ? new Date(Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1])))
    : new Date(normalized);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function latestDate(values: unknown[]) {
  return values
    .flatMap((value) => {
      const normalized = isoDate(value);
      return normalized ? [normalized] : [];
    })
    .sort((left, right) => right.localeCompare(left))[0] || null;
}

function sources(value: unknown): RegulatorySource[] {
  return Array.isArray(value)
    ? value.filter((item): item is RegulatorySource => Boolean(
      item
      && typeof item === "object"
      && typeof (item as RegulatorySource).provider === "string",
    ))
    : [];
}

function latestDividend(fund: PublicFundData | null) {
  if (!fund) return null;
  const entries: Array<{
    competence: string;
    value: number;
    source: string | null;
    asOf: string | null;
  }> = [];
  const dataSources = record(fund.dataSources);
  const defaultSource = text(fund.dividendDataSource)
    || text(dataSources?.fund)
    || sources(fund.regulatoryMeta?.sources).find((item) => item.kind === "regulatory" || item.kind === "legacy")?.provider
    || null;

  for (const [yearKey, yearValue] of Object.entries(fund)) {
    const match = yearKey.match(/^earnings(\d{4})$/);
    const year = match ? Number(match[1]) : 0;
    const months = record(yearValue);
    if (!year || !months) continue;
    for (const [monthName, rawInfo] of Object.entries(months)) {
      const month = MONTH_INDEX[monthName];
      const info = record(rawInfo);
      const value = numberValue(info?.earnings);
      if (!month || value === null || value <= 0) continue;
      entries.push({
        competence: `${year}-${String(month).padStart(2, "0")}`,
        value,
        source: text(info?.source) || defaultSource,
        asOf: isoDate(info?.payment_date) || isoDate(info?.date_with),
      });
    }
  }

  return entries.sort((left, right) => right.competence.localeCompare(left.competence))[0] || null;
}

function officialCatalogProjection(fund: PublicFundData | null) {
  if (!fund) return null;
  const quality = record(fund.catalogDataQuality);
  const lifecycle = record(fund.lifecycle);
  const catalogUpdatedAt = isoDate(fund.catalogUpdatedAt);
  const fundSource = text(fund.fundDataSource) || text(record(fund.dataSources)?.fund);
  const catalogFound = Boolean(
    quality
    || catalogUpdatedAt
    || fundSource?.toLowerCase().includes("catálogo oficial"),
  );
  if (!catalogFound) return null;

  const regulatorySources = sources(fund.regulatoryMeta?.sources);
  const investorComposition = record(fund.investorComposition);
  const referenceDate = latestDate([
    fund.valuationReferenceDate,
    investorComposition?.referenceDate,
    ...regulatorySources.map((item) => item.fetchedAt),
  ]);

  return {
    identity: {
      cnpj: fund.cnpj,
      legalName: fund.socialReason || fund.corporateName || fund.name,
      kind: fund.fundKind,
    },
    classification: {
      sector: fund.sector,
      segment: fund.segment,
      strategy: fund.strategy,
    },
    lifecycle: {
      status: lifecycle?.status || fund.status,
      b3Listed: lifecycle?.b3Listed,
      canceledAt: lifecycle?.canceledAt,
    },
    provenance: {
      sourceIds: regulatorySources.map((item) => item.provider),
      referenceDate,
      generatedAt: catalogUpdatedAt,
    },
    dataQuality: {
      basicComplete: quality?.basicComplete,
      essentialComplete: quality?.essentialComplete,
      warnings: quality?.warnings,
    },
  };
}

export function buildFundSeoEligibilityInput(
  ticker: string,
  fund: PublicFundData | null,
  editorial: FundSeoEditorialReview | null = null,
): FundSeoEligibilityInput {
  const price = numberValue(fund?.price);
  const dividend = latestDividend(fund);
  const pvp = plausiblePvpValue(fund?.pvp) ?? plausiblePvpValue(record(fund?.valuation)?.pvp);
  const navPerShare = numberValue(fund?.vpCota ?? fund?.valorPatrimonialPorCota);
  const valuationAsOf = isoDate(fund?.valuationReferenceDate);

  return {
    ticker,
    publicRecordFound: Boolean(fund),
    catalog: officialCatalogProjection(fund),
    market: fund ? {
      price,
      asOf: isoDate(fund.marketDataUpdatedAt),
      plausible: price !== null ? price > 0 && price < 1_000_000 : null,
    } : null,
    dividend: dividend ? {
      value: dividend.value,
      competence: dividend.competence,
      source: dividend.source,
      asOf: dividend.asOf,
      plausible: price && price > 0 ? dividend.value <= price : dividend.value > 0,
    } : null,
    valuation: {
      pvp,
      navPerShare,
      asOf: valuationAsOf,
      explicitlyUnavailable: Boolean(
        fund
        && !pvp
        && (!navPerShare || navPerShare <= 0)
        && text(fund.valuationUnavailableReason),
      ),
      plausible: pvp || (navPerShare && navPerShare > 0) ? true : null,
    },
    editorial,
    technical: {
      canonicalPath: `/fii/${ticker}`,
      httpStatus: fund ? 200 : 404,
      privateDataDetected: false,
    },
  };
}

export function evaluatePublicFundSeo(
  ticker: string,
  fund: PublicFundData | null,
  editorial: FundSeoEditorialReview | null = null,
): FundSeoEligibility {
  return evaluateFundSeoEligibility(buildFundSeoEligibilityInput(ticker, fund, editorial));
}
