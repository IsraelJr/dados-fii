export type DividendNoticeSourceType = "primary_regulatory" | "primary_manager";

export interface VerifiedDividendNoticeSource {
  documentId: string;
  sourceUrl: string;
  sourceType: DividendNoticeSourceType;
  reviewMethod: "manual_document_review";
  reviewedBy: string;
  reviewedAt: string;
  page: number | null;
  excerpt: string;
}

export interface VerifiedDividendNotice {
  ticker: string;
  competenceMonth: string;
  amountPerShare: number;
  announcedAt: string;
  source: VerifiedDividendNoticeSource;
}

export interface VerifiedMaterialCreditEvent {
  ticker: string;
  knownAt: string;
  type: "default" | "impairment" | "material_restructuring" | "judicial_recovery";
  documentId: string;
  sourceUrl: string;
  reviewedBy: string;
  reviewedAt: string;
}

export type DividendStressStatus =
  | "no_qualifying_stress"
  | "stress_without_recovery"
  | "recovery_blocked_by_material_credit_event"
  | "reversible_stress_confirmed";

export interface DividendStressWindow {
  ticker: string;
  status: DividendStressStatus;
  baselineMonths: string[];
  baselineMedian: number | null;
  stressMonths: string[];
  stressAverage: number | null;
  stressDropPercent: number | null;
  stressDetectedAt: string | null;
  recoveryMonths: string[];
  recoveryAverage: number | null;
  recoveryPercentOfBaseline: number | null;
  recoveryDetectedAt: string | null;
  blockingCreditEvent: VerifiedMaterialCreditEvent | null;
  observationsUsed: number;
}
