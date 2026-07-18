export type FnetNoticeReviewStatus = "pending_manual_review" | "approved" | "rejected";

export interface FnetDividendNoticePreview {
  candidateId: string;
  documentId: string;

  sourceUrl: string;
  sourceHash: string;
  protocolUrl: string;
  protocolHash: string;
  protocolVersion: number;

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

export interface FnetNoticeCandidateRepository {
  saveImported(candidate: FnetDividendNoticePreview): Promise<FnetNoticeImportResult>;
  listRecent(limit?: number): Promise<FnetDividendNoticePreview[]>;
  approve(candidateId: string, actor: string): Promise<FnetDividendNoticePreview>;
  reject(candidateId: string, actor: string, reason: string): Promise<FnetDividendNoticePreview>;
}
