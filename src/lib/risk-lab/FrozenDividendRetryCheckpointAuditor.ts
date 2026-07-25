import { sha256Text } from "@/lib/risk-lab/FrozenDividendDatasetIntegrity";
import type { SingleFrozenDividendIdentity } from "@/lib/risk-lab/SingleFrozenDividendCaseFinalizer";
import type {
  FrozenDividendCaseCheckpoint,
  FrozenDividendNoticeFailure,
  FrozenDividendNoticeObservation,
} from "@/types/riskLabFrozenDividendDataset";

export interface FrozenDividendRetryArtifactReference {
  artifactId: number;
  artifactDigest: string;
}

export interface FrozenDividendRetryCheckpointAuditInput {
  identity: SingleFrozenDividendIdentity;
  baselineCheckpoint: FrozenDividendCaseCheckpoint;
  retriedCheckpoint: FrozenDividendCaseCheckpoint;
  baselineArtifact: FrozenDividendRetryArtifactReference;
  retryArtifact: FrozenDividendRetryArtifactReference;
}

export interface FrozenDividendRetryRecoveryAudit {
  documentId: string;
  classification: "recovered_transient_failure";
  competenceMonth: string;
  amountPerShare: number;
  baselineFailure: FrozenDividendNoticeFailure;
  observationHash: string;
  sourceUrl: string;
  baselineArtifactId: number;
  baselineArtifactDigest: string;
  retryArtifactId: number;
  retryArtifactDigest: string;
  evidenceHash: string;
}

export interface FrozenDividendRetrySecondaryClassAudit {
  documentId: string;
  classification: "secondary_share_class";
  parsedTicker: string;
  baselineFailure: FrozenDividendNoticeFailure;
  sourceUrl: string;
  baselineArtifactId: number;
  baselineArtifactDigest: string;
  retryArtifactId: number;
  retryArtifactDigest: string;
  evidenceHash: string;
}

export interface FrozenDividendRetryCheckpointAuditResult {
  baselineCheckpointHash: string;
  retriedCheckpointHash: string;
  recoveries: FrozenDividendRetryRecoveryAudit[];
  secondaryShareClasses: FrozenDividendRetrySecondaryClassAudit[];
  auditHash: string;
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

function same(left: unknown, right: unknown) {
  return stableHash(left) === stableHash(right);
}

function sourceUrl(documentId: string) {
  return `https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=${documentId}`;
}

function assertArtifact(reference: FrozenDividendRetryArtifactReference, label: string) {
  if (!Number.isInteger(reference.artifactId) || reference.artifactId <= 0) {
    throw new Error(`Artifact ID inválido para ${label}.`);
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(reference.artifactDigest)) {
    throw new Error(`Digest do artefato inválido para ${label}.`);
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
  if (!(observation.amountPerShare > 0)) {
    throw new Error(`Valor recuperado inválido para ${documentId}.`);
  }
  const competence = monthIndex(observation.competenceMonth);
  const firstMonth = monthIndex(identity.fromDate.slice(0, 7));
  const lastMonth = monthIndex(identity.untilDate.slice(0, 7));
  if (competence < firstMonth || competence > lastMonth) {
    throw new Error(`Competência recuperada fora da janela para ${documentId}.`);
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
    throw new Error(`Versão oficial inválida para ${documentId}.`);
  }
  if (observation.protocolEvidenceType !== "official_manager_metadata") {
    throw new Error(`Tipo de evidência oficial inválido para ${documentId}.`);
  }
}

function transient(failure: FrozenDividendNoticeFailure) {
  return failure.retryable && /(aborted|abortad[ao]|timeout|timed out|tempo limite|fetch failed|network|socket)/i.test(failure.message);
}

function secondaryTicker(identity: SingleFrozenDividendIdentity, failure: FrozenDividendNoticeFailure) {
  if (failure.retryable) return null;
  const match = failure.message.match(/Ticker FNET inválido:\s*([A-Z]{4}\d{2})/i);
  const ticker = match?.[1]?.toUpperCase();
  if (!ticker || ticker === identity.ticker || ticker.slice(0, 4) !== identity.ticker.slice(0, 4)) return null;
  return ticker;
}

function assertIdentity(identity: SingleFrozenDividendIdentity, checkpoint: FrozenDividendCaseCheckpoint, label: string) {
  if (
    checkpoint.ticker !== identity.ticker
    || checkpoint.cnpj !== identity.cnpj
    || checkpoint.fromDate !== identity.fromDate
    || checkpoint.untilDate !== identity.untilDate
  ) throw new Error(`${label} não pertence à identidade informada.`);
}

export class FrozenDividendRetryCheckpointAuditor {
  audit(input: FrozenDividendRetryCheckpointAuditInput): FrozenDividendRetryCheckpointAuditResult {
    const { identity, baselineCheckpoint, retriedCheckpoint } = input;
    assertArtifact(input.baselineArtifact, "checkpoint de origem");
    assertArtifact(input.retryArtifact, "checkpoint de retentativa");
    assertIdentity(identity, baselineCheckpoint, "Checkpoint de origem");
    assertIdentity(identity, retriedCheckpoint, "Checkpoint de retentativa");

    const baselineDiscovered = sortedUnique(baselineCheckpoint.discoveredDocumentIds);
    const retriedDiscovered = sortedUnique(retriedCheckpoint.discoveredDocumentIds);
    if (JSON.stringify(baselineDiscovered) !== JSON.stringify(retriedDiscovered)) {
      throw new Error("A retentativa alterou o universo de documentos descobertos.");
    }

    const baselineCompleted = new Set(baselineCheckpoint.completedDocumentIds);
    const retriedCompleted = new Set(retriedCheckpoint.completedDocumentIds);
    for (const documentId of baselineCompleted) {
      if (!retriedCompleted.has(documentId)) throw new Error(`Documento concluído regrediu: ${documentId}.`);
    }

    for (const [documentId, observation] of Object.entries(baselineCheckpoint.observationsByDocumentId)) {
      const retried = retriedCheckpoint.observationsByDocumentId[documentId];
      if (!retried || !same(observation, retried)) {
        throw new Error(`Observação anterior foi alterada: ${documentId}.`);
      }
    }

    const baselinePending = baselineDiscovered.filter((id) => !baselineCompleted.has(id));
    const retriedPending = retriedDiscovered.filter((id) => !retriedCompleted.has(id));
    if (retriedPending.length > 0) {
      throw new Error(`Retentativa ainda possui pendências: ${retriedPending.join(", ")}.`);
    }

    const allowedNewObservations = new Set(baselinePending);
    for (const documentId of Object.keys(retriedCheckpoint.observationsByDocumentId)) {
      if (!baselineCheckpoint.observationsByDocumentId[documentId] && !allowedNewObservations.has(documentId)) {
        throw new Error(`Retentativa criou observação fora das pendências: ${documentId}.`);
      }
    }

    const recoveries: FrozenDividendRetryRecoveryAudit[] = [];
    const secondaryShareClasses: FrozenDividendRetrySecondaryClassAudit[] = [];
    for (const documentId of baselinePending) {
      const failure = baselineCheckpoint.failuresByDocumentId[documentId];
      if (!failure || failure.documentId !== documentId) {
        throw new Error(`Falha de origem ausente para ${documentId}.`);
      }
      if (retriedCheckpoint.failuresByDocumentId[documentId]) {
        throw new Error(`Falha não foi removida após retentativa: ${documentId}.`);
      }
      const observation = retriedCheckpoint.observationsByDocumentId[documentId];
      if (observation) {
        if (!transient(failure)) throw new Error(`Falha não transitória recebeu observação: ${documentId}.`);
        assertObservation(identity, documentId, observation);
        const withoutEvidenceHash = {
          documentId,
          classification: "recovered_transient_failure" as const,
          competenceMonth: observation.competenceMonth,
          amountPerShare: observation.amountPerShare,
          baselineFailure: failure,
          observationHash: stableHash(observation),
          sourceUrl: sourceUrl(documentId),
          baselineArtifactId: input.baselineArtifact.artifactId,
          baselineArtifactDigest: input.baselineArtifact.artifactDigest,
          retryArtifactId: input.retryArtifact.artifactId,
          retryArtifactDigest: input.retryArtifact.artifactDigest,
        };
        recoveries.push({ ...withoutEvidenceHash, evidenceHash: stableHash(withoutEvidenceHash) });
        continue;
      }

      const parsedTicker = secondaryTicker(identity, failure);
      if (!parsedTicker) throw new Error(`Documento concluído sem observação não é classe secundária: ${documentId}.`);
      const withoutEvidenceHash = {
        documentId,
        classification: "secondary_share_class" as const,
        parsedTicker,
        baselineFailure: failure,
        sourceUrl: sourceUrl(documentId),
        baselineArtifactId: input.baselineArtifact.artifactId,
        baselineArtifactDigest: input.baselineArtifact.artifactDigest,
        retryArtifactId: input.retryArtifact.artifactId,
        retryArtifactDigest: input.retryArtifact.artifactDigest,
      };
      secondaryShareClasses.push({ ...withoutEvidenceHash, evidenceHash: stableHash(withoutEvidenceHash) });
    }

    recoveries.sort((a, b) => a.documentId.localeCompare(b.documentId));
    secondaryShareClasses.sort((a, b) => a.documentId.localeCompare(b.documentId));
    const withoutAuditHash = {
      identity,
      baselineCheckpointHash: stableHash(baselineCheckpoint),
      retriedCheckpointHash: stableHash(retriedCheckpoint),
      baselineArtifact: input.baselineArtifact,
      retryArtifact: input.retryArtifact,
      recoveries,
      secondaryShareClasses,
    };
    return {
      baselineCheckpointHash: withoutAuditHash.baselineCheckpointHash,
      retriedCheckpointHash: withoutAuditHash.retriedCheckpointHash,
      recoveries,
      secondaryShareClasses,
      auditHash: stableHash(withoutAuditHash),
    };
  }
}
