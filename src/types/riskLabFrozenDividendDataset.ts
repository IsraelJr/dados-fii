export type FrozenDividendCaseRole =
  | "severe_deterioration"
  | "healthy_control"
  | "reversible_stress";

export type FrozenDividendDatasetStatus = "pending" | "complete" | "blocked";
export type FrozenDividendCaseStatus = "complete" | "incomplete" | "blocked";
export type FrozenDividendProtocolEvidenceType =
  | "protocol_html"
  | "official_manager_metadata";

export interface FrozenDividendNoticeObservation {
  ticker: string;
  competenceMonth: string;
  amountPerShare: number;
  announcedAt: string;
  informationDate: string;
  baseDate: string;
  paymentDate: string;
  documentId: string;
  receivedAt: string;
  sourceUrl: string;
  protocolUrl: string;
  page: number;
  excerpt: string;
  sourceHash: string;
  protocolHash: string;
  protocolVersion: number;
  protocolEvidenceType?: FrozenDividendProtocolEvidenceType;
  sourceVersion: string;
}

export interface FrozenDividendNoticeFailure {
  documentId: string;
  message: string;
  attempts: number;
  retryable: boolean;
  lastAttemptAt: string;
}

export interface FrozenDividendNoticeCase {
  ticker: string;
  cnpj: string;
  role: FrozenDividendCaseRole;
  fromDate: string;
  untilDate: string;
  status: FrozenDividendCaseStatus;
  documentsDiscovered: number;
  documentsProcessed: number;
  pendingDocumentIds: string[];
  failures: FrozenDividendNoticeFailure[];
  conflicts: string[];
  missingMonths: string[];
  longestContiguousSequence: number;
  observations: FrozenDividendNoticeObservation[];
  caseHash: string;
}

export interface FrozenDividendNoticeDataset {
  schemaVersion: 1;
  datasetId: "risk-lab-fnet-dividend-notices-v0.1";
  datasetVersion: "0.1.0";
  collectorVersion: string;
  status: FrozenDividendDatasetStatus;
  generatedAt: string | null;
  releaseCommit: string | null;
  cohortId: "risk-lab-credit-oos-v0.1";
  cohortVersion: "0.1.0";
  rulesetVersion: "0.1.0";
  cases: FrozenDividendNoticeCase[];
  datasetHash: string | null;
}

export interface FrozenDividendCaseCheckpoint {
  ticker: string;
  cnpj: string;
  fromDate: string;
  untilDate: string;
  discoveredDocumentIds: string[];
  completedDocumentIds: string[];
  observationsByDocumentId: Record<string, FrozenDividendNoticeObservation>;
  failuresByDocumentId: Record<string, FrozenDividendNoticeFailure>;
  updatedAt: string;
}

export interface FrozenDividendCollectionCheckpoint {
  schemaVersion: 1;
  datasetId: "risk-lab-fnet-dividend-notices-v0.1";
  releaseCommit: string;
  cases: Record<string, FrozenDividendCaseCheckpoint>;
  updatedAt: string;
}

export interface FrozenDividendReconciliationDifference {
  competenceMonth: string;
  primaryAmountPerShare: number;
  auxiliaryAmountPerShare: number;
}

export interface FrozenDividendReconciliation {
  source: "cvm_monthly_bulk";
  status: "available" | "unavailable";
  comparedMonths: number;
  exactMatches: number;
  differences: FrozenDividendReconciliationDifference[];
  note: string;
}
