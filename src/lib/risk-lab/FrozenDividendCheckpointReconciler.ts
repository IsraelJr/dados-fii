import { sha256Text } from "@/lib/risk-lab/FrozenDividendDatasetIntegrity";
import type { SingleFrozenDividendIdentity } from "@/lib/risk-lab/SingleFrozenDividendCaseFinalizer";
import type {
  FrozenDividendCaseCheckpoint,
  FrozenDividendNoticeFailure,
  FrozenDividendNoticeObservation,
} from "@/types/riskLabFrozenDividendDataset";

interface FrozenDividendArtifactReference {
  artifactId: number;
  artifactDigest: string;
}

export interface FrozenDividendRecoveryEvidence extends FrozenDividendArtifactReference {
  documentId: string;
  failure: FrozenDividendNoticeFailure;
  observation: FrozenDividendNoticeObservation;
}

export interface FrozenDividendSecondaryClassEvidence extends FrozenDividendArtifactReference {
  documentId: string;
  failure: FrozenDividendNoticeFailure;
}

export interface FrozenDividendCheckpointReconciliationInput {
  identity: SingleFrozenDividendIdentity;
  checkpoint: FrozenDividendCaseCheckpoint;
  recoveryEvidence: FrozenDividendRecoveryEvidence[];
  secondaryClassEvidence: FrozenDividendSecondaryClassEvidence[];
}

export interface FrozenDividendRecoveryAudit {
  documentId: string;
  classification: "recovered_transient_failure";
  competenceMonth: string;
  amountPerShare: number;
  sourceUrl: string;
  artifactId: number;
  artifactDigest: string;
  priorFailure: FrozenDividendNoticeFailure;
  observationHash: string;
  evidenceHash: string;
}

export interface FrozenDividendSecondaryClassAudit {
  documentId: string;
  classification: "secondary_share_class";
  parsedTicker: string;
  sourceUrl: string;
  artifactId: number;
  artifactDigest: string;
  evidenceMessage: string;
  evidenceHash: string;
}

export interface FrozenDividendCheckpointReconciliationResult {
  checkpoint: FrozenDividendCaseCheckpoint;
  baselineCheckpointHash: string;
  reconciledCheckpointHash: string;
  recoveries: FrozenDividendRecoveryAudit[];
  secondaryShareClasses: FrozenDividendSecondaryClassAudit[];
  reconciliationHash: string;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function stableHash(value: unknown) {
  return sha256Text(JSON.stringify(stableValue(value)));
}

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function assertExactIds(actual: string[], expected: string[], label: string) {
  if (JSON.stringify(sortedUnique(actual)) !== JSON.stringify(sortedUnique(expected))) {
    throw new Error(`${label} divergem: ${sortedUnique(actual).join(", ")}.`);
  }
}

function assertArtifact(reference: FrozenDividendArtifactReference, documentId: string) {
  if (!Number.isInteger(reference.artifactId) || reference.artifactId <= 0) {
    throw new Error(`Artifact ID inválido para ${documentId}.`);
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(reference.artifactDigest)) {
    throw new Error(`Digest do artefato inválido para ${documentId}.`);
  }
}

function monthIndex(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error(`Competência inválida: ${value}.`);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`Competência inválida: ${value}.`);
  return Number(match[1]) * 12 + month - 1;
}

function assertObservation(
  identity: SingleFrozenDividendIdentity,
  documentId: string,
  observation: FrozenDividendNoticeObservation,
) {
  if (observation.documentId !== documentId || observation.ticker !== identity.ticker) {
    throw new Error(`Observação recuperada não pertence a ${documentId}.`);
  }
  if (!Number.isFinite(observation.amountPerShare) || observation.amountPerShare < 0) {
    throw new Error(`Valor recuperado inválido para ${documentId}.`);
  }
  const competence = monthIndex(observation.competenceMonth);
  const firstMonth = monthIndex(identity.fromDate.slice(0, 7));
  const lastMonth = monthIndex(identity.untilDate.slice(0, 7));
  if (competence < firstMonth || competence > lastMonth) {
    throw new Error(`Competência recuperada fora da janela para ${documentId}.`);
  }
  const announcedAt = Date.parse(observation.announcedAt);
  const until = Date.parse(`${identity.untilDate}T23:59:59-03:00`);
  if (!Number.isFinite(announcedAt) || announcedAt > until) {
    throw new Error(`Data de anúncio recuperada inválida para ${documentId}.`);
  }
  for (const [field, value] of Object.entries({
    informationDate: observation.informationDate,
    baseDate: observation.baseDate,
    paymentDate: observation.paymentDate,
    receivedAt: observation.receivedAt,
    excerpt: observation.excerpt,
    sourceVersion: observation.sourceVersion,
  })) {
    if (!String(value || "").trim()) throw new Error(`Campo ${field} ausente em ${documentId}.`);
  }
  if (!observation.sourceUrl.includes(`id=${documentId}`)) {
    throw new Error(`URL de origem inválida para ${documentId}.`);
  }
  if (!observation.protocolUrl.includes(`idDocumento=${documentId}`)) {
    throw new Error(`URL de protocolo inválida para ${documentId}.`);
  }
  if (!/^[a-f0-9]{64}$/.test(observation.sourceHash) || !/^[a-f0-9]{64}$/.test(observation.protocolHash)) {
    throw new Error(`Hashes oficiais inválidos para ${documentId}.`);
  }
  if (!Number.isInteger(observation.protocolVersion) || observation.protocolVersion < 1) {
    throw new Error(`Versão de protocolo inválida para ${documentId}.`);
  }
  if (observation.protocolEvidenceType !== "official_manager_metadata") {
    throw new Error(`Tipo de evidência de protocolo inválido para ${documentId}.`);
  }
}

function isTransientFailure(message: string) {
  return /(aborted|abortad[ao]|timeout|timed out|tempo limite)/i.test(message);
}

function sourceUrl(documentId: string) {
  return `https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=${documentId}`;
}

export class FrozenDividendCheckpointReconciler {
  reconcile(input: FrozenDividendCheckpointReconciliationInput): FrozenDividendCheckpointReconciliationResult {
    const { identity } = input;
    const checkpoint = structuredClone(input.checkpoint);
    if (
      checkpoint.ticker !== identity.ticker
      || checkpoint.cnpj !== identity.cnpj
      || checkpoint.fromDate !== identity.fromDate
      || checkpoint.untilDate !== identity.untilDate
    ) {
      throw new Error("Checkpoint não pertence à identidade informada.");
    }

    const baselineCheckpointHash = stableHash(checkpoint);
    const pendingIds = checkpoint.discoveredDocumentIds
      .filter((documentId) => !checkpoint.completedDocumentIds.includes(documentId));
    assertExactIds(
      pendingIds,
      input.recoveryEvidence.map((item) => item.documentId),
      "Evidências de recuperação",
    );

    const recoveryIds = input.recoveryEvidence.map((item) => item.documentId);
    if (new Set(recoveryIds).size !== recoveryIds.length) {
      throw new Error("Evidências de recuperação duplicadas.");
    }

    const recoveries: FrozenDividendRecoveryAudit[] = [];
    for (const evidence of input.recoveryEvidence) {
      const { documentId } = evidence;
      assertArtifact(evidence, documentId);
      const failure = checkpoint.failuresByDocumentId[documentId];
      if (!failure || stableHash(failure) !== stableHash(evidence.failure)) {
        throw new Error(`Falha original divergente para ${documentId}.`);
      }
      if (!failure.retryable || !isTransientFailure(failure.message)) {
        throw new Error(`Falha não transitória não pode ser recuperada para ${documentId}.`);
      }
      assertObservation(identity, documentId, evidence.observation);
      if (checkpoint.observationsByDocumentId[documentId]) {
        throw new Error(`Documento ${documentId} já possui observação no checkpoint.`);
      }

      checkpoint.observationsByDocumentId[documentId] = structuredClone(evidence.observation);
      checkpoint.completedDocumentIds.push(documentId);
      delete checkpoint.failuresByDocumentId[documentId];

      const observationHash = stableHash(evidence.observation);
      const withoutEvidenceHash = {
        documentId,
        classification: "recovered_transient_failure" as const,
        competenceMonth: evidence.observation.competenceMonth,
        amountPerShare: evidence.observation.amountPerShare,
        sourceUrl: sourceUrl(documentId),
        artifactId: evidence.artifactId,
        artifactDigest: evidence.artifactDigest,
        priorFailure: evidence.failure,
        observationHash,
      };
      recoveries.push({ ...withoutEvidenceHash, evidenceHash: stableHash(withoutEvidenceHash) });
    }

    checkpoint.completedDocumentIds = sortedUnique(checkpoint.completedDocumentIds);
    const completedWithoutObservation = checkpoint.completedDocumentIds
      .filter((documentId) => !checkpoint.observationsByDocumentId[documentId]);
    assertExactIds(
      completedWithoutObservation,
      input.secondaryClassEvidence.map((item) => item.documentId),
      "Evidências de classes secundárias",
    );

    const secondaryIds = input.secondaryClassEvidence.map((item) => item.documentId);
    if (new Set(secondaryIds).size !== secondaryIds.length) {
      throw new Error("Evidências de classes secundárias duplicadas.");
    }

    const secondaryShareClasses: FrozenDividendSecondaryClassAudit[] = [];
    for (const evidence of input.secondaryClassEvidence) {
      const { documentId } = evidence;
      assertArtifact(evidence, documentId);
      if (evidence.failure.documentId !== documentId || evidence.failure.retryable) {
        throw new Error(`Falha de classe secundária inválida para ${documentId}.`);
      }
      const tickerMatch = evidence.failure.message.match(/Ticker FNET inválido:\s*([A-Z]{4}\d{2})/i);
      const parsedTicker = tickerMatch?.[1]?.toUpperCase();
      if (
        !parsedTicker
        || parsedTicker === identity.ticker
        || parsedTicker.slice(0, 4) !== identity.ticker.slice(0, 4)
      ) {
        throw new Error(`Evidência não comprova classe secundária para ${documentId}.`);
      }
      const withoutEvidenceHash = {
        documentId,
        classification: "secondary_share_class" as const,
        parsedTicker,
        sourceUrl: sourceUrl(documentId),
        artifactId: evidence.artifactId,
        artifactDigest: evidence.artifactDigest,
        evidenceMessage: evidence.failure.message,
      };
      secondaryShareClasses.push({
        ...withoutEvidenceHash,
        evidenceHash: stableHash({ ...withoutEvidenceHash, failure: evidence.failure }),
      });
    }

    if (Object.keys(checkpoint.failuresByDocumentId).length > 0) {
      throw new Error("Checkpoint reconciliado ainda possui falhas.");
    }
    if (checkpoint.discoveredDocumentIds.some((documentId) => !checkpoint.completedDocumentIds.includes(documentId))) {
      throw new Error("Checkpoint reconciliado ainda possui documentos pendentes.");
    }

    recoveries.sort((left, right) => left.documentId.localeCompare(right.documentId));
    secondaryShareClasses.sort((left, right) => left.documentId.localeCompare(right.documentId));
    const reconciledCheckpointHash = stableHash(checkpoint);
    const reconciliationWithoutHash = {
      identity,
      baselineCheckpointHash,
      reconciledCheckpointHash,
      recoveries,
      secondaryShareClasses,
    };
    return {
      checkpoint,
      baselineCheckpointHash,
      reconciledCheckpointHash,
      recoveries,
      secondaryShareClasses,
      reconciliationHash: stableHash(reconciliationWithoutHash),
    };
  }
}
