import type {
  DividendStressWindow,
  VerifiedDividendNotice,
  VerifiedMaterialCreditEvent,
} from "./riskLabDividendStress";

export type AutomaticValidationStatus = "validated" | "inconclusive" | "blocked";

export type AutomaticAnalysisReadiness =
  | "historical_unit_available"
  | "structured_series_final"
  | "structured_series_ready"
  | "structured_series_incomplete"
  | "credit_event_screen_inconclusive"
  | "detector_not_yet_supported"
  | "insufficient_official_evidence"
  | "blocked";

export interface AutomaticFundIdentity {
  ticker: string;
  cnpj: string;
  fundName: string;
  identitySource: string;
}

export interface AutomaticDocumentEvidence {
  documentId: string;
  documentType: string;
  fileName: string;
  competenceDate: string | null;
  receivedAt: string;
  link: string;
  sourceYear: number;
  auditResult: string | null;
  confidence: number;
}

export interface AutomaticSourceSummary {
  year: number;
  sourceUrl: string;
  sourceHash: string | null;
  fetched: boolean;
  matchingRows: number;
  acceptedDocuments: number;
  rejectedRows: number;
  error: string | null;
}

export interface AutomaticValidationIssue {
  code: string;
  severity: "warning" | "error";
  message: string;
}

export interface AutomaticMonthlySourceSummary {
  year: number;
  sourceUrl: string;
  sourceHash: string | null;
  fetched: boolean;
  documentsInspected: number;
  matchingRows: number;
  acceptedMonths: number;
  error: string | null;
}

export type AutomaticCreditEventScreenStatus =
  | "material_event_confirmed"
  | "no_explicit_event_found"
  | "inconclusive";

export interface AutomaticCreditEventMatch {
  documentId: string;
  sourceUrl: string;
  knownAt: string;
  eventType: VerifiedMaterialCreditEvent["type"];
  matchedTerm: string;
  matchedIn: "metadata" | "official_html";
  confidence: number;
}

export interface AutomaticCreditAmbiguousDocument {
  documentId: string;
  documentType: string;
  fileName: string;
  receivedAt: string;
  sourceUrl: string;
  reason: string;
}

export interface AutomaticCreditEventScreen {
  status: AutomaticCreditEventScreenStatus;
  relevantFrom: string;
  relevantUntil: string;
  inspectedDocuments: number;
  sourceCoverageComplete: boolean;
  matches: AutomaticCreditEventMatch[];
  verifiedEvents: VerifiedMaterialCreditEvent[];
  ambiguousDocuments: AutomaticCreditAmbiguousDocument[];
  summary: string;
  classificationFinal: boolean;
}

export interface AutomaticMonthlySeries {
  status: "ready" | "incomplete" | "blocked";
  observations: VerifiedDividendNotice[];
  sources: AutomaticMonthlySourceSummary[];
  missingMonths: string[];
  conflicts: string[];
  longestContiguousSequence: number;
  method:
    | "direct_declared_per_share"
    | "official_monthly_liability_per_share"
    | "unavailable";
  detectorResult: DividendStressWindow | null;
  detectorExecuted: boolean;
  creditEventScreen?: AutomaticCreditEventScreen | null;
  classificationFinal: boolean;
  limitation:
    | "material_credit_events_not_automatically_validated"
    | "material_credit_event_confirmed"
    | "no_explicit_material_credit_event_found"
    | "material_credit_event_screen_inconclusive"
    | "insufficient_structured_series";
}

export interface RiskLabAutomaticScan {
  id: string;
  ticker: string;
  startedAt: string;
  completedAt: string;
  requestedBy: string;
  status: AutomaticValidationStatus;
  identity: AutomaticFundIdentity;
  documents: AutomaticDocumentEvidence[];
  sources: AutomaticSourceSummary[];
  issues: AutomaticValidationIssue[];
  monthlySeries: AutomaticMonthlySeries | null;
  analysisReadiness: AutomaticAnalysisReadiness;
  requiresHumanDocumentValidation: false;
  notificationsSent: false;
  premiumIntegrated: false;
  nextAction: string;
}

export interface RiskLabAutomaticScanRepository {
  save(scan: RiskLabAutomaticScan): Promise<RiskLabAutomaticScan>;
  latest(ticker: string): Promise<RiskLabAutomaticScan | null>;
}
