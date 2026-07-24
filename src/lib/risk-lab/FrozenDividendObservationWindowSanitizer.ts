import { sha256Text } from "@/lib/risk-lab/FrozenDividendDatasetIntegrity";
import type { SingleFrozenDividendIdentity } from "@/lib/risk-lab/SingleFrozenDividendCaseFinalizer";
import type {
  FrozenDividendCaseCheckpoint,
  FrozenDividendNoticeObservation,
} from "@/types/riskLabFrozenDividendDataset";

export interface FrozenDividendObservationWindowEvidence {
  artifactId: number;
  artifactDigest: string;
  documentId: string;
  observation: FrozenDividendNoticeObservation;
}

export interface FrozenDividendObservationWindowExclusion {
  documentId: string;
  classification: "outside_cohort_window_year_rollover_metadata_drift";
  reportedCompetenceMonth: string;
  correctedCompetenceMonth: string;
  sourceUrl: string;
  artifactId: number;
  artifactDigest: string;
  observationHash: string;
  evidenceHash: string;
}

export interface FrozenDividendObservationWindowSanitizationInput {
  identity: SingleFrozenDividendIdentity;
  checkpoint: FrozenDividendCaseCheckpoint;
  evidence: FrozenDividendObservationWindowEvidence[];
}

export interface FrozenDividendObservationWindowSanitizationResult {
  checkpoint: FrozenDividendCaseCheckpoint;
  inputCheckpointHash: string;
  sanitizedCheckpointHash: string;
  exclusions: FrozenDividendObservationWindowExclusion[];
  sanitizationHash: string;
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

function monthIndex(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error(`Competência inválida: ${value}.`);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`Competência inválida: ${value}.`);
  return Number(match[1]) * 12 + month - 1;
}

function monthFromIndex(value: number) {
  const year = Math.floor(value / 12);
  const month = value % 12 + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseInformationDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Data de informação inválida: ${value}.`);
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`Data de informação inválida: ${value}.`);
  }
  return { month: value.slice(0, 7), timestamp };
}

function previousCalendarMonth(informationDate: string) {
  const { month } = parseInformationDate(informationDate);
  return monthFromIndex(monthIndex(month) - 1);
}

function sourceUrl(documentId: string) {
  return `https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=${documentId}`;
}

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function assertExactIds(actual: string[], expected: string[]) {
  if (JSON.stringify(sortedUnique(actual)) !== JSON.stringify(sortedUnique(expected))) {
    throw new Error(`Evidências temporais divergem: ${sortedUnique(actual).join(", ")}.`);
  }
}

function assertArtifact(evidence: FrozenDividendObservationWindowEvidence) {
  if (!Number.isInteger(evidence.artifactId) || evidence.artifactId <= 0) {
    throw new Error(`Artifact ID inválido para ${evidence.documentId}.`);
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(evidence.artifactDigest)) {
    throw new Error(`Digest do artefato inválido para ${evidence.documentId}.`);
  }
}

function rolloverCandidate(observation: FrozenDividendNoticeObservation) {
  const { month: informationMonth } = parseInformationDate(observation.informationDate);
  const correctedCompetenceMonth = previousCalendarMonth(observation.informationDate);
  const reported = observation.competenceMonth;
  monthIndex(reported);

  if (
    reported.slice(0, 4) === informationMonth.slice(0, 4)
    && reported.slice(5) === correctedCompetenceMonth.slice(5)
    && monthIndex(reported) > monthIndex(informationMonth)
  ) {
    return correctedCompetenceMonth;
  }
  return null;
}

function classify(
  identity: SingleFrozenDividendIdentity,
  documentId: string,
  observation: FrozenDividendNoticeObservation,
) {
  if (observation.documentId !== documentId || observation.ticker !== identity.ticker) {
    throw new Error(`Observação temporal não pertence a ${documentId}.`);
  }
  const correctedCompetenceMonth = rolloverCandidate(observation);
  if (!correctedCompetenceMonth) {
    throw new Error(`Observação ${documentId} não comprova deriva de virada de ano.`);
  }
  if (observation.announcedAt.slice(0, 10) !== observation.informationDate) {
    throw new Error(`Anúncio e data de informação divergem em ${documentId}.`);
  }
  if (observation.baseDate !== observation.informationDate) {
    throw new Error(`Data-base e data de informação divergem em ${documentId}.`);
  }
  const information = parseInformationDate(observation.informationDate).timestamp;
  const payment = Date.parse(`${observation.paymentDate}T00:00:00Z`);
  if (!Number.isFinite(payment) || payment < information || payment - information > 40 * 86_400_000) {
    throw new Error(`Data de pagamento incompatível em ${documentId}.`);
  }
  const corrected = monthIndex(correctedCompetenceMonth);
  const firstMonth = monthIndex(identity.fromDate.slice(0, 7));
  const lastMonth = monthIndex(identity.untilDate.slice(0, 7));
  if (corrected >= firstMonth && corrected <= lastMonth) {
    throw new Error(`Competência corrigida ${correctedCompetenceMonth} pertence à janela da coorte.`);
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
  return correctedCompetenceMonth;
}

export class FrozenDividendObservationWindowSanitizer {
  sanitize(
    input: FrozenDividendObservationWindowSanitizationInput,
  ): FrozenDividendObservationWindowSanitizationResult {
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

    const inputCheckpointHash = stableHash(checkpoint);
    const candidateIds = Object.entries(checkpoint.observationsByDocumentId)
      .filter(([, observation]) => rolloverCandidate(observation) !== null)
      .map(([documentId]) => documentId);
    assertExactIds(candidateIds, input.evidence.map((item) => item.documentId));

    const evidenceIds = input.evidence.map((item) => item.documentId);
    if (new Set(evidenceIds).size !== evidenceIds.length) {
      throw new Error("Evidências temporais duplicadas.");
    }

    const exclusions: FrozenDividendObservationWindowExclusion[] = [];
    for (const evidence of input.evidence) {
      assertArtifact(evidence);
      const observation = checkpoint.observationsByDocumentId[evidence.documentId];
      if (!observation || stableHash(observation) !== stableHash(evidence.observation)) {
        throw new Error(`Observação original divergente para ${evidence.documentId}.`);
      }
      if (!checkpoint.completedDocumentIds.includes(evidence.documentId)) {
        throw new Error(`Documento temporal não está concluído: ${evidence.documentId}.`);
      }
      const correctedCompetenceMonth = classify(identity, evidence.documentId, observation);
      const withoutEvidenceHash = {
        documentId: evidence.documentId,
        classification: "outside_cohort_window_year_rollover_metadata_drift" as const,
        reportedCompetenceMonth: observation.competenceMonth,
        correctedCompetenceMonth,
        sourceUrl: sourceUrl(evidence.documentId),
        artifactId: evidence.artifactId,
        artifactDigest: evidence.artifactDigest,
        observationHash: stableHash(observation),
      };
      exclusions.push({
        ...withoutEvidenceHash,
        evidenceHash: stableHash({ ...withoutEvidenceHash, evidence }),
      });
      delete checkpoint.observationsByDocumentId[evidence.documentId];
    }

    exclusions.sort((left, right) => left.documentId.localeCompare(right.documentId));
    const sanitizedCheckpointHash = stableHash(checkpoint);
    const withoutSanitizationHash = {
      identity,
      inputCheckpointHash,
      sanitizedCheckpointHash,
      exclusions,
    };
    return {
      checkpoint,
      ...withoutSanitizationHash,
      sanitizationHash: stableHash(withoutSanitizationHash),
    };
  }
}
