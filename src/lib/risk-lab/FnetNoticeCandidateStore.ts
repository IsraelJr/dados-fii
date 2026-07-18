import { adminDb } from "@/lib/firebaseAdmin";
import type { VerifiedDividendNotice } from "@/types/riskLabDividendStress";
import type {
  FnetDividendNoticePreview,
  FnetNoticeCandidateRepository,
  FnetNoticeImportResult,
} from "@/types/riskLabFnetNotice";

const CANDIDATE_COLLECTION = "RiskLabNoticeCandidates";
const VERIFIED_COLLECTION = "RiskLabVerifiedDividendNotices";
const AUDIT_COLLECTION = "RiskLabNoticeAudit";

function assertCandidateId(value: string) {
  if (!/^[A-Z]{4}11_\d{4}-\d{2}_\d{1,12}$/.test(value)) {
    throw new Error("Identificador do candidato FNET inválido.");
  }
}

function assertActor(value: string) {
  if (!value || !value.includes("@") || value.length > 254) {
    throw new Error("Responsável administrativo inválido.");
  }
}

function verifiedObservation(current: FnetDividendNoticePreview, actor: string, reviewedAt: string): VerifiedDividendNotice {
  return {
    ticker: current.ticker,
    competenceMonth: current.competenceMonth,
    amountPerShare: current.amountPerShare,
    announcedAt: current.announcedAt,
    source: {
      documentId: current.documentId,
      sourceUrl: current.sourceUrl,
      sourceType: "primary_regulatory",
      reviewMethod: "manual_document_review",
      reviewedBy: actor,
      reviewedAt,
      page: null,
      excerpt: `Aviso estruturado FNET confirmado: ${current.periodReferenceRaw}; R$ ${current.amountPerShare.toFixed(6)} por cota; protocolo entregue em ${current.announcedAt}.`,
    },
  };
}

export class FirestoreFnetNoticeCandidateStore implements FnetNoticeCandidateRepository {
  async saveImported(candidate: FnetDividendNoticePreview): Promise<FnetNoticeImportResult> {
    assertCandidateId(candidate.candidateId);
    assertActor(candidate.importedBy);
    const reference = adminDb.collection(CANDIDATE_COLLECTION).doc(candidate.candidateId);

    return adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists) {
        return {
          candidate: existing.data() as FnetDividendNoticePreview,
          created: false,
        };
      }

      transaction.set(reference, candidate);
      const auditReference = adminDb.collection(AUDIT_COLLECTION).doc();
      transaction.set(auditReference, {
        action: "import",
        candidateId: candidate.candidateId,
        documentId: candidate.documentId,
        actor: candidate.importedBy,
        at: candidate.importedAt,
        sourceHash: candidate.sourceHash,
        protocolHash: candidate.protocolHash,
      });

      return { candidate, created: true };
    });
  }

  async listRecent(limit = 30): Promise<FnetDividendNoticePreview[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const snapshot = await adminDb
      .collection(CANDIDATE_COLLECTION)
      .orderBy("importedAt", "desc")
      .limit(safeLimit)
      .get();
    return snapshot.docs.map((document) => document.data() as FnetDividendNoticePreview);
  }

  async approve(candidateId: string, actor: string): Promise<FnetDividendNoticePreview> {
    return this.review(candidateId, actor, "approved", null);
  }

  async reject(candidateId: string, actor: string, reason: string): Promise<FnetDividendNoticePreview> {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 10 || normalizedReason.length > 500) {
      throw new Error("A rejeição exige justificativa entre 10 e 500 caracteres.");
    }
    return this.review(candidateId, actor, "rejected", normalizedReason);
  }

  private async review(
    candidateId: string,
    actor: string,
    status: "approved" | "rejected",
    rejectionReason: string | null,
  ): Promise<FnetDividendNoticePreview> {
    assertCandidateId(candidateId);
    assertActor(actor);
    const reference = adminDb.collection(CANDIDATE_COLLECTION).doc(candidateId);
    const reviewedAt = new Date().toISOString();

    return adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new Error("Candidato FNET não encontrado.");
      const current = snapshot.data() as FnetDividendNoticePreview;

      if (current.reviewStatus !== "pending_manual_review") {
        if (current.reviewStatus === status) return current;
        throw new Error(`Candidato já revisado como ${current.reviewStatus}.`);
      }

      const verifiedReference = status === "approved"
        ? adminDb.collection(VERIFIED_COLLECTION).doc(`${current.ticker}_${current.competenceMonth}`)
        : null;
      const existingVerified = verifiedReference ? await transaction.get(verifiedReference) : null;
      if (existingVerified?.exists) {
        const existing = existingVerified.data() as VerifiedDividendNotice;
        if (existing.source.documentId !== current.documentId) {
          throw new Error(
            `Conflito: ${current.ticker} ${current.competenceMonth} já possui observação aprovada pelo documento ${existing.source.documentId}.`,
          );
        }
      }

      const reviewed: FnetDividendNoticePreview = {
        ...current,
        reviewStatus: status,
        reviewedBy: actor,
        reviewedAt,
        rejectionReason,
      };
      transaction.set(reference, reviewed);

      if (verifiedReference && !existingVerified?.exists) {
        transaction.set(verifiedReference, verifiedObservation(current, actor, reviewedAt));
      }

      const auditReference = adminDb.collection(AUDIT_COLLECTION).doc();
      transaction.set(auditReference, {
        action: status,
        candidateId,
        documentId: current.documentId,
        ticker: current.ticker,
        competenceMonth: current.competenceMonth,
        actor,
        at: reviewedAt,
        rejectionReason,
        verifiedObservationId: status === "approved" ? `${current.ticker}_${current.competenceMonth}` : null,
      });
      return reviewed;
    });
  }
}

export const fnetNoticeCandidateStore = new FirestoreFnetNoticeCandidateStore();
