import { adminDb } from "@/lib/firebaseAdmin";
import { normalizeIngestionTicker } from "@/lib/fiiIngestionConfig";
import {
  buildRegulatoryInsights,
  type RegulatoryInsightSnapshot,
} from "@/lib/regulatoryInsights";

export type RegulatoryDataDocument = {
  source?: string;
  status?: string;
  ticker?: string;
  cnpj?: string;
  fundType?: string;
  adapterId?: string;
  parserVersion?: number;
  sourceRunId?: string;
  referenceYear?: number;
  generatedAt?: string;
  latestSnapshot?: Record<string, any> | null;
  monthlyHistory?: Array<Record<string, any>>;
  documents?: Array<Record<string, any>>;
  quality?: {
    monthlySnapshots?: number;
    documents?: number;
    coverage?: number;
    conflictCount?: number;
    qaVerdict?: string;
    qaScore?: number;
  };
  publication?: Record<string, any>;
};

export type RegulatoryFundView = {
  code: string;
  name: string | null;
  sector: string | null;
  segment: string | null;
  price: number | null;
  lastDividend: number | null;
  lastDividendDate: string | null;
  regulatoryData: ReturnType<typeof normalizeRegulatoryData> | null;
};

export type RegulatoryReportResult = {
  found: boolean;
  ticker: string;
  fund: RegulatoryFundView | null;
  reportAvailable: boolean;
  reason: string | null;
  insights: ReturnType<typeof buildRegulatoryInsights> | null;
};

function sortMonthly(items: Array<Record<string, any>>): RegulatoryInsightSnapshot[] {
  return [...items]
    .filter((item) => String(item?.referenceDate || "").trim())
    .map((item) => ({
      referenceDate: String(item.referenceDate),
      netWorth: item.netWorth,
      sharesOutstanding: item.sharesOutstanding,
      numberShareholders: item.numberShareholders,
      vpCota: item.vpCota,
      totalPortfolioValue: item.totalPortfolioValue,
      delinquentCreditValue: item.delinquentCreditValue,
    }))
    .sort((left, right) => left.referenceDate.localeCompare(right.referenceDate));
}

function sortDocuments(items: Array<Record<string, any>>) {
  return [...items].sort((left, right) =>
    String(right.deliveryDate || right.referenceDate || "")
      .localeCompare(String(left.deliveryDate || left.referenceDate || ""))
  );
}

export function normalizeRegulatoryData(ticker: string, value: unknown) {
  const data = value && typeof value === "object"
    ? value as RegulatoryDataDocument
    : {} as RegulatoryDataDocument;
  const monthlyHistory = sortMonthly(Array.isArray(data.monthlyHistory) ? data.monthlyHistory : []);
  const documents = sortDocuments(Array.isArray(data.documents) ? data.documents : []);
  const latestSnapshot = data.latestSnapshot || monthlyHistory.at(-1) || null;

  return {
    source: data.source || null,
    status: data.status || null,
    ticker: normalizeIngestionTicker(data.ticker || ticker),
    cnpj: String(data.cnpj || "").replace(/\D/g, "") || null,
    fundType: data.fundType || null,
    adapterId: data.adapterId || null,
    parserVersion: Number(data.parserVersion || 0) || null,
    sourceRunId: data.sourceRunId || null,
    referenceYear: Number(data.referenceYear || 0) || null,
    generatedAt: data.generatedAt || null,
    latestSnapshot,
    monthlyHistory,
    documents,
    quality: {
      monthlySnapshots: Number(data.quality?.monthlySnapshots ?? monthlyHistory.length),
      documents: Number(data.quality?.documents ?? documents.length),
      coverage: Number(data.quality?.coverage ?? 0),
      conflictCount: Number(data.quality?.conflictCount ?? 0),
      qaVerdict: data.quality?.qaVerdict || null,
      qaScore: Number(data.quality?.qaScore ?? 0),
    },
    publication: data.publication || null,
  };
}

export async function getRegulatoryFund(tickerInput: unknown): Promise<{
  found: boolean;
  ticker: string;
  fund: RegulatoryFundView | null;
}> {
  const ticker = normalizeIngestionTicker(tickerInput);
  if (!ticker) throw new Error("Ticker obrigatório.");

  const snapshot = await adminDb.collection("Fiis").doc(ticker).get();
  if (!snapshot.exists) {
    return { found: false, ticker, fund: null };
  }

  const fund = (snapshot.data() || {}) as Record<string, any>;
  const regulatoryData = normalizeRegulatoryData(ticker, fund.regulatoryData);
  const hasRegulatoryData = regulatoryData.monthlyHistory.length > 0 || Boolean(regulatoryData.latestSnapshot);

  return {
    found: true,
    ticker,
    fund: {
      code: String(fund.code || ticker),
      name: fund.name || fund.socialReason || regulatoryData.latestSnapshot?.fundName || null,
      sector: fund.sector || null,
      segment: fund.segment_new || fund.segment || null,
      price: Number.isFinite(Number(fund.price)) ? Number(fund.price) : null,
      lastDividend: Number.isFinite(Number(fund.lastDividend)) ? Number(fund.lastDividend) : null,
      lastDividendDate: fund.lastDividendDate || null,
      regulatoryData: hasRegulatoryData ? regulatoryData : null,
    },
  };
}

export async function getRegulatoryReportInput(tickerInput: unknown): Promise<RegulatoryReportResult> {
  const response = await getRegulatoryFund(tickerInput);
  if (!response.found || !response.fund) {
    return {
      found: false,
      ticker: response.ticker,
      fund: null,
      reportAvailable: false,
      reason: "fund_not_found",
      insights: null,
    };
  }

  const regulatoryData = response.fund.regulatoryData;
  if (!regulatoryData) {
    return {
      ...response,
      reportAvailable: false,
      reason: "regulatory_data_not_published",
      insights: null,
    };
  }

  const insights = buildRegulatoryInsights({
    ticker: response.ticker,
    monthlyHistory: regulatoryData.monthlyHistory,
    quality: regulatoryData.quality,
  });

  return {
    ...response,
    reportAvailable: true,
    reason: null,
    insights,
  };
}
