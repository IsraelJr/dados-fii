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
  if (!value || /\s/.test(value) || value.length > 254) {
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
      reviewMethod: "automatic_regulatory_validation",
      reviewedBy: actor,
      reviewedAt,
      page: null,
      excerpt: `Aviso estruturado FNET validado automaticamente: ${current.periodReferenceRaw}; R$ ${current.amountPerShare.toFixed(6)} por cota; protocolo entregue em ${current.announcedAt}; validação ${current.validationVersion} (${current.validationHash}).`,
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

      const verifiedReference = adminDb.collection(VERIFIED_COLLECTION).doc(`${candidate.ticker}_${candidate.competenceMonth}`);
      const existingVerified = await transaction.get(verifiedReference);
      const conflict = existingVerified.exists
        && (existingVerified.data() as VerifiedDividendNotice).source.documentId !== candidate.documentId;
      const persisted: FnetDividendNoticePreview = conflict
        ? {
            ...candidate,
            reviewStatus: "quarantined",
            validationReasons: [...candidate.validationReasons, "competence_document_conflict"],
            rejectionReason: "Conflito com outro documento já verificado para o mesmo fundo e competência.",
          }
        : candidate;

      transaction.set(reference, persisted);
      if (!existingVerified.exists && !conflict) {
        transaction.set(
          verifiedReference,
          verifiedObservation(candidate, candidate.reviewedBy || candidate.importedBy, candidate.reviewedAt || candidate.importedAt),
        );
      }
      const auditReference = adminDb.collection(AUDIT_COLLECTION).doc();
      transaction.set(auditReference, {
        action: conflict ? "quarantine" : "automatic_verify",
        candidateId: candidate.candidateId,
        documentId: candidate.documentId,
        actor: candidate.importedBy,
        at: candidate.importedAt,
        sourceHash: candidate.sourceHash,
        protocolHash: candidate.protocolHash,
        validationVersion: candidate.validationVersion,
        validationHash: candidate.validationHash,
        validationReasons: persisted.validationReasons,
      });

      return { candidate: persisted, created: true };
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

  async reject(candidateId: string, actor: string, reason: string): Promise<FnetDividendNoticePreview> {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 10 || normalizedReason.length > 500) {
      throw new Error("A rejeição exige justificativa entre 10 e 500 caracteres.");
    }
    assertCandidateId(candidateId);
    assertActor(actor);
    const reference = adminDb.collection(CANDIDATE_COLLECTION).doc(candidateId);
    const reviewedAt = new Date().toISOString();

    return adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new Error("Candidato FNET não encontrado.");
      const current = snapshot.data() as FnetDividendNoticePreview;

      if (current.reviewStatus === "rejected") return current;
      if (current.reviewStatus !== "quarantined") {
        throw new Error("Somente itens em quarentena podem ser rejeitados administrativamente.");
      }

      const reviewed: FnetDividendNoticePreview = {
        ...current,
        reviewStatus: "rejected",
        reviewedBy: actor,
        reviewedAt,
        rejectionReason: normalizedReason,
      };
      transaction.set(reference, reviewed);

      const auditReference = adminDb.collection(AUDIT_COLLECTION).doc();
      transaction.set(auditReference, {
        action: "reject_quarantined",
        candidateId,
        documentId: current.documentId,
        ticker: current.ticker,
        competenceMonth: current.competenceMonth,
        actor,
        at: reviewedAt,
        rejectionReason: normalizedReason,
        verifiedObservationId: null,
      });
      return reviewed;
    });
  }
}

export const fnetNoticeCandidateStore = new FirestoreFnetNoticeCandidateStore();
