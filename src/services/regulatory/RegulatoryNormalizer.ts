import { normalizeIngestionTicker } from "@/lib/fiiIngestionConfig";
import type { RegulatoryInsightSnapshot } from "@/lib/regulatoryInsights";
import type {
  RawFundDocument,
  RawRegulatoryData,
  RegulatoryData,
  RegulatoryDocument,
  RegulatoryFundView,
} from "./RegulatoryTypes";

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeSnapshot(value: unknown): RegulatoryInsightSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const referenceDate = stringOrNull(item.referenceDate);
  if (!referenceDate) return null;

  return {
    referenceDate,
    fundName: stringOrNull(item.fundName),
    netWorth: numberOrNull(item.netWorth),
    sharesOutstanding: numberOrNull(item.sharesOutstanding),
    numberShareholders: numberOrNull(item.numberShareholders),
    vpCota: numberOrNull(item.vpCota),
    totalPortfolioValue: numberOrNull(item.totalPortfolioValue),
    delinquentCreditValue: numberOrNull(item.delinquentCreditValue),
  };
}

function snapshotCompleteness(item: RegulatoryInsightSnapshot) {
  return Object.entries(item).filter(([key, value]) => key !== "referenceDate" && value !== null && value !== undefined).length;
}

function normalizeMonthlyHistory(value: unknown) {
  const byReferenceDate = new Map<string, RegulatoryInsightSnapshot>();
  const items = Array.isArray(value) ? value : [];

  for (const raw of items) {
    const normalized = normalizeSnapshot(raw);
    if (!normalized) continue;
    const current = byReferenceDate.get(normalized.referenceDate);
    if (!current || snapshotCompleteness(normalized) >= snapshotCompleteness(current)) {
      byReferenceDate.set(normalized.referenceDate, normalized);
    }
  }

  return [...byReferenceDate.values()].sort((left, right) => left.referenceDate.localeCompare(right.referenceDate));
}

function normalizeDocument(value: unknown): RegulatoryDocument | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const documentUrl = stringOrNull(item.documentUrl);
  const sourceUrl = stringOrNull(item.sourceUrl ?? (item.source as Record<string, unknown> | undefined)?.url);
  const documentType = stringOrNull(item.documentType ?? item.category);
  const deliveryDate = stringOrNull(item.deliveryDate);
  const referenceDate = stringOrNull(item.referenceDate);
  if (!documentUrl && !sourceUrl) return null;

  return {
    ...item,
    documentType,
    deliveryDate,
    referenceDate,
    documentUrl,
    sourceUrl,
  };
}

function normalizeDocuments(value: unknown) {
  const unique = new Map<string, RegulatoryDocument>();
  const items = Array.isArray(value) ? value : [];

  for (const raw of items) {
    const normalized = normalizeDocument(raw);
    if (!normalized) continue;
    const key = normalized.documentUrl
      || `${normalized.sourceUrl}|${normalized.documentType}|${normalized.deliveryDate || normalized.referenceDate || ""}`;
    if (!unique.has(key)) unique.set(key, normalized);
  }

  return [...unique.values()].sort((left, right) =>
    String(right.deliveryDate || right.referenceDate || "")
      .localeCompare(String(left.deliveryDate || left.referenceDate || ""))
  );
}

function normalizeYears(data: RawRegulatoryData, monthlyHistory: RegulatoryInsightSnapshot[]) {
  const explicit = Array.isArray(data.referenceYears)
    ? data.referenceYears.map(numberOrNull).filter((value): value is number => value !== null)
    : [];
  const derived = monthlyHistory
    .map((item) => Number(item.referenceDate.slice(0, 4)))
    .filter(Number.isFinite);
  const referenceYear = numberOrNull(data.referenceYear);
  if (referenceYear !== null) derived.push(referenceYear);
  return [...new Set([...explicit, ...derived])].sort((left, right) => left - right);
}

export function normalizeRegulatoryData(tickerInput: unknown, value: unknown): RegulatoryData | null {
  if (!value || typeof value !== "object") return null;
  const ticker = normalizeIngestionTicker(tickerInput);
  const data = value as RawRegulatoryData;
  const monthlyHistory = normalizeMonthlyHistory(data.monthlyHistory);
  const documents = normalizeDocuments(data.documents);
  const latestSnapshot = normalizeSnapshot(data.latestSnapshot) || monthlyHistory.at(-1) || null;
  const status = stringOrNull(data.status);
  const sourceRunId = stringOrNull(data.sourceRunId);
  const generatedAt = stringOrNull(data.generatedAt);
  const publication = data.publication && typeof data.publication === "object"
    ? data.publication as Record<string, unknown>
    : null;
  const dataVersion = stringOrNull(publication?.proposalHash)
    || sourceRunId
    || generatedAt
    || `${ticker}:${latestSnapshot?.referenceDate || "empty"}`;

  return {
    source: stringOrNull(data.source),
    status,
    ticker: normalizeIngestionTicker(data.ticker || ticker),
    cnpj: String(data.cnpj || "").replace(/\D/g, "") || null,
    fundType: stringOrNull(data.fundType),
    adapterId: stringOrNull(data.adapterId),
    parserVersion: numberOrNull(data.parserVersion),
    sourceRunId,
    referenceYear: numberOrNull(data.referenceYear),
    referenceYears: normalizeYears(data, monthlyHistory),
    generatedAt,
    dataVersion,
    latestSnapshot,
    monthlyHistory,
    documents,
    quality: {
      monthlySnapshots: numberOrNull((data.quality as Record<string, unknown> | undefined)?.monthlySnapshots) ?? monthlyHistory.length,
      documents: numberOrNull((data.quality as Record<string, unknown> | undefined)?.documents) ?? documents.length,
      coverage: numberOrNull((data.quality as Record<string, unknown> | undefined)?.coverage) ?? 0,
      conflictCount: numberOrNull((data.quality as Record<string, unknown> | undefined)?.conflictCount) ?? 0,
      qaVerdict: stringOrNull((data.quality as Record<string, unknown> | undefined)?.qaVerdict),
      qaScore: numberOrNull((data.quality as Record<string, unknown> | undefined)?.qaScore) ?? 0,
    },
    publication,
  };
}

export function normalizeFundDocument(tickerInput: unknown, raw: RawFundDocument): RegulatoryFundView {
  const ticker = normalizeIngestionTicker(tickerInput);
  const regulatoryData = normalizeRegulatoryData(ticker, raw.regulatoryData);
  const hasRegulatoryData = Boolean(regulatoryData?.latestSnapshot || regulatoryData?.monthlyHistory.length);

  return {
    code: String(raw.code || ticker),
    name: stringOrNull(raw.name || raw.socialReason || regulatoryData?.latestSnapshot?.fundName),
    sector: stringOrNull(raw.sector),
    segment: stringOrNull(raw.segment_new || raw.segment),
    price: numberOrNull(raw.price),
    lastDividend: numberOrNull(raw.lastDividend),
    lastDividendDate: stringOrNull(raw.lastDividendDate),
    regulatoryData: hasRegulatoryData ? regulatoryData : null,
  };
}

export function isPublishedRegulatoryData(data: RegulatoryData | null) {
  return data?.status === "published";
}
