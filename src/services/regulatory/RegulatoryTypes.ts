import type { RegulatoryInsightSnapshot } from "@/lib/regulatoryInsights";
import type { buildRegulatoryInsights } from "@/lib/regulatoryInsights";
import type { buildRegulatoryTimeline } from "@/lib/regulatoryTimeline";

export type RegulatoryQuality = {
  monthlySnapshots: number;
  documents: number;
  coverage: number;
  conflictCount: number;
  qaVerdict: string | null;
  qaScore: number;
};

export type RegulatoryDocument = {
  documentType: string | null;
  deliveryDate: string | null;
  referenceDate: string | null;
  documentUrl: string | null;
  sourceUrl: string | null;
  [key: string]: unknown;
};

export type RegulatoryData = {
  source: string | null;
  status: string | null;
  ticker: string;
  cnpj: string | null;
  fundType: string | null;
  adapterId: string | null;
  parserVersion: number | null;
  sourceRunId: string | null;
  referenceYear: number | null;
  referenceYears: number[];
  generatedAt: string | null;
  dataVersion: string;
  latestSnapshot: RegulatoryInsightSnapshot | null;
  monthlyHistory: RegulatoryInsightSnapshot[];
  documents: RegulatoryDocument[];
  quality: RegulatoryQuality;
  publication: Record<string, unknown> | null;
};

export type RegulatoryFundView = {
  code: string;
  name: string | null;
  sector: string | null;
  segment: string | null;
  price: number | null;
  lastDividend: number | null;
  lastDividendDate: string | null;
  regulatoryData: RegulatoryData | null;
};

export type RegulatoryFundResult = {
  found: boolean;
  ticker: string;
  fund: RegulatoryFundView | null;
  cache: {
    hit: boolean;
    loadedAt: string;
  };
};

export type RegulatoryReportResult = RegulatoryFundResult & {
  reportAvailable: boolean;
  reason: "fund_not_found" | "regulatory_data_not_published" | "regulatory_data_invalid" | null;
  insights: ReturnType<typeof buildRegulatoryInsights> | null;
  timeline: ReturnType<typeof buildRegulatoryTimeline> | null;
};

export type RawFundDocument = Record<string, unknown>;

export type RawRegulatoryData = Record<string, unknown>;
