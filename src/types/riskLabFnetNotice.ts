export type FnetNoticeReviewStatus = "pending_manual_review" | "approved" | "rejected";

export interface FnetDividendNoticePreview {
  candidateId: string;
  documentId: string;
  sourceUrl: string;
  sourceHash: string;
  ticker: string;
  fundName: string;
  informationDate: string;
  announcedAt: string;
  baseDate: string;
  paymentDate: string;
  competenceMonth: string;
  periodReferenceRaw: string;
  amountPerShare: number;
  incomeTaxExempt: boolean | null;
  reviewStatus: FnetNoticeReviewStatus;
  importedBy: string;
  importedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface FnetNoticeImportResult {
  candidate: FnetDividendNoticePreview;
  created: boolean;
}
