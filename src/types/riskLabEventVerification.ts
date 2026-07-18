export type EventVerificationCaseRole =
  | "severe_deterioration"
  | "reversible_stress";

export type EventVerificationStatus =
  | "pending_document_location"
  | "candidate_document_located"
  | "primary_content_verified";

export type PrimaryContentReviewStatus =
  | "not_retrieved"
  | "manual_review_pending"
  | "manually_verified";

export interface EventLocatorEvidence {
  sourceUrl: string;
  sourceType: "secondary_locator";
  observedAt: string;
  note: string;
}

export interface PrimaryContentReview {
  status: PrimaryContentReviewStatus;
  page: number | null;
  excerpt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface CandidateOfficialDocument {
  documentId: string;
  sourceUrl: string;
  sourceType: "primary_regulatory" | "primary_manager";
  documentType: string;

  /** Só pode ser preenchida após conferência no documento ou protocolo primário. */
  referenceDate: string | null;

  /** Primeira data pública confirmada em fonte primária; nunca copiar de agregador. */
  publishedAt: string | null;

  contentReview: PrimaryContentReview;
}

export interface EventVerificationCandidate {
  candidateId: string;
  ticker: string;
  role: EventVerificationCaseRole;
  status: EventVerificationStatus;

  /** Deve permanecer null enquanto publishedAt não estiver confirmado na fonte primária. */
  eventDateCandidate: string | null;

  officialDocument: CandidateOfficialDocument | null;
  locatorEvidence: EventLocatorEvidence[];
  candidateFacts: string[];
  unresolvedChecks: string[];
  eligibleForCohortPromotion: boolean;
}

export interface EventVerificationLedgerMetadata {
  id: string;
  version: string;
  cohortId: string;
  rulesetVersion: string;
  status: "research_only_blocked" | "partially_verified" | "verified";
  createdAt: string;
  executionAllowed: boolean;
  policy: string[];
}

export interface EventVerificationLedger {
  metadata: EventVerificationLedgerMetadata;
  candidates: EventVerificationCandidate[];
}
