import { hashFrozenDividendCase, sha256Text } from "@/lib/risk-lab/FrozenDividendDatasetIntegrity";
import type {
  FrozenDividendCaseCheckpoint,
  FrozenDividendNoticeCase,
  FrozenDividendNoticeFailure,
  FrozenDividendNoticeObservation,
} from "@/types/riskLabFrozenDividendDataset";

export interface SingleFrozenDividendIdentity {
  ticker: string;
  cnpj: string;
  role: "severe_deterioration" | "healthy_control" | "reversible_stress";
  fromDate: string;
  untilDate: string;
}

export interface FrozenDividendDiagnosticEvidence {
  artifactId: number;
  artifactDigest: string;
  documentId: string;
  failure: FrozenDividendNoticeFailure;
}

export interface SingleFrozenDividendInput {
  schemaVersion: 1;
  phase: string;
  sourceArtifacts: Record<string, unknown>;
  identity: SingleFrozenDividendIdentity;
  checkpoint: FrozenDividendCaseCheckpoint;
  diagnosticEvidence: FrozenDividendDiagnosticEvidence[];
}

export interface SingleFrozenDividendExclusion {
  documentId: string;
  classification: "outside_cohort_window" | "secondary_share_class";
  parsedTicker: string | null;
  competenceMonth: string | null;
  sourceUrl: string;
  evidenceArtifactId: number;
  evidenceArtifactDigest: string;
  evidenceMessage: string;
  evidenceHash: string;
}

export interface SingleFrozenDividendAudit {
  schemaVersion: 1;
  phase: string;
  sourceArtifacts: Record<string, unknown>;
  identity: SingleFrozenDividendIdentity;
  inputCheckpointHash: string;
  exclusions: SingleFrozenDividendExclusion[];
  finalCaseHash: string;
  documentsDiscovered: number;
  documentsProcessed: number;
  observations: number;
  pendingDocuments: number;
  conflicts: number;
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

function seriesCoverage(months: string[]) {
  if (!months.length) return { missingMonths: [] as string[], longestContiguousSequence: 0 };
  const indexes = [...new Set(months.map(monthIndex))].sort((left, right) => left - right);
  const existing = new Set(indexes);
  const missingMonths: string[] = [];
  for (let index = indexes[0]; index <= indexes.at(-1)!; index += 1) {
    if (!existing.has(index)) missingMonths.push(monthFromIndex(index));
  }
  let longestContiguousSequence = 1;
  let current = 1;
  for (let index = 1; index < indexes.length; index += 1) {
    current = indexes[index] === indexes[index - 1] + 1 ? current + 1 : 1;
    longestContiguousSequence = Math.max(longestContiguousSequence, current);
  }
  return { missingMonths, longestContiguousSequence };
}

function noticeEventKey(observation: FrozenDividendNoticeObservation) {
  return [
    observation.ticker,
    observation.informationDate,
    observation.baseDate,
    observation.paymentDate,
  ].join("|");
}

function selectKnownVersions(observations: FrozenDividendNoticeObservation[], untilDate: string) {
  const until = Date.parse(`${untilDate}T23:59:59-03:00`);
  const events = new Map<string, FrozenDividendNoticeObservation[]>();
  for (const observation of observations) {
    if (Date.parse(observation.announcedAt) > until) continue;
    const key = noticeEventKey(observation);
    events.set(key, [...(events.get(key) || []), observation]);
  }

  const conflicts: string[] = [];
  const currentEvents: FrozenDividendNoticeObservation[] = [];
  for (const [eventKey, items] of events) {
    items.sort((left, right) =>
      right.protocolVersion - left.protocolVersion
      || Date.parse(right.announcedAt) - Date.parse(left.announcedAt)
      || right.documentId.localeCompare(left.documentId));
    const highestVersion = items[0].protocolVersion;
    const candidates = items.filter((item) => item.protocolVersion === highestVersion);
    const signatures = new Set(candidates.map((item) => [
      item.competenceMonth,
      item.amountPerShare.toFixed(8),
    ].join("|")));
    if (signatures.size > 1) {
      conflicts.push(`Reapresentações conflitantes no evento ${eventKey}, versão ${highestVersion}.`);
      continue;
    }
    currentEvents.push(candidates[0]);
  }

  const grouped = new Map<string, FrozenDividendNoticeObservation[]>();
  for (const observation of currentEvents) {
    grouped.set(observation.competenceMonth, [
      ...(grouped.get(observation.competenceMonth) || []),
      observation,
    ]);
  }

  const selected: FrozenDividendNoticeObservation[] = [];
  for (const [competenceMonth, items] of grouped) {
    items.sort((left, right) =>
      right.protocolVersion - left.protocolVersion
      || Date.parse(right.announcedAt) - Date.parse(left.announcedAt)
      || right.documentId.localeCompare(left.documentId));
    const highestVersion = items[0].protocolVersion;
    const candidates = items.filter((item) => item.protocolVersion === highestVersion);
    const amounts = new Set(candidates.map((item) => item.amountPerShare.toFixed(8)));
    if (amounts.size > 1) {
      conflicts.push(`Valores conflitantes em ${competenceMonth}, versão ${highestVersion}.`);
      continue;
    }
    selected.push(candidates[0]);
  }
  selected.sort((left, right) => monthIndex(left.competenceMonth) - monthIndex(right.competenceMonth));
  return { selected, conflicts };
}

function buildCase(
  identity: SingleFrozenDividendIdentity,
  checkpoint: FrozenDividendCaseCheckpoint,
): FrozenDividendNoticeCase {
  const completed = new Set(checkpoint.completedDocumentIds);
  const pendingDocumentIds = checkpoint.discoveredDocumentIds.filter((id) => !completed.has(id));
  const { selected, conflicts } = selectKnownVersions(
    Object.values(checkpoint.observationsByDocumentId),
    identity.untilDate,
  );
  const coverage = seriesCoverage(selected.map((item) => item.competenceMonth));
  const status = conflicts.length > 0
    ? "blocked"
    : pendingDocumentIds.length > 0 || selected.length === 0
      ? "incomplete"
      : "complete";
  const failures = pendingDocumentIds
    .map((id) => checkpoint.failuresByDocumentId[id])
    .filter((item): item is FrozenDividendNoticeFailure => Boolean(item));
  const withoutHash: Omit<FrozenDividendNoticeCase, "caseHash"> = {
    ticker: identity.ticker,
    cnpj: identity.cnpj,
    role: identity.role,
    fromDate: identity.fromDate,
    untilDate: identity.untilDate,
    status,
    documentsDiscovered: checkpoint.discoveredDocumentIds.length,
    documentsProcessed: checkpoint.completedDocumentIds.length,
    pendingDocumentIds,
    failures,
    conflicts,
    missingMonths: coverage.missingMonths,
    longestContiguousSequence: coverage.longestContiguousSequence,
    observations: selected,
  };
  return { ...withoutHash, caseHash: hashFrozenDividendCase(withoutHash) };
}

function sourceUrl(documentId: string) {
  return `https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=${documentId}`;
}

function classifyEvidence(identity: SingleFrozenDividendIdentity, evidence: FrozenDividendDiagnosticEvidence) {
  const message = evidence.failure.message;
  const tickerMatch = message.match(/Ticker FNET inválido:\s*([A-Z]{4}\d{2})/i);
  if (tickerMatch) {
    const parsedTicker = tickerMatch[1].toUpperCase();
    if (parsedTicker !== identity.ticker && parsedTicker.slice(0, 4) === identity.ticker.slice(0, 4)) {
      return {
        classification: "secondary_share_class" as const,
        parsedTicker,
        competenceMonth: null,
      };
    }
    throw new Error(`Evidência de ticker não justifica exclusão de ${evidence.documentId}: ${parsedTicker}.`);
  }

  const periodMatch = message.match(/Período de referência FNET inválido:\s*(0?[1-9]|1[0-2])\s*[-\/.]\s*(\d{2})/i);
  if (periodMatch) {
    const competenceMonth = `20${periodMatch[2]}-${String(Number(periodMatch[1])).padStart(2, "0")}`;
    const competence = monthIndex(competenceMonth);
    const firstMonth = monthIndex(identity.fromDate.slice(0, 7));
    const lastMonth = monthIndex(identity.untilDate.slice(0, 7));
    if (competence < firstMonth || competence > lastMonth) {
      return {
        classification: "outside_cohort_window" as const,
        parsedTicker: identity.ticker,
        competenceMonth,
      };
    }
    throw new Error(`Período histórico ${competenceMonth} pertence à janela da coorte.`);
  }

  throw new Error(`Evidência insuficiente para classificar ${evidence.documentId}: ${message}`);
}

export class SingleFrozenDividendCaseFinalizer {
  finalize(input: SingleFrozenDividendInput) {
    if (input.schemaVersion !== 1) throw new Error("Entrada da fase com schema incompatível.");
    const { identity } = input;
    if (!/^[A-Z]{4}11$/.test(identity.ticker) || !/^\d{14}$/.test(identity.cnpj)) {
      throw new Error("Identidade inválida.");
    }
    const checkpoint = structuredClone(input.checkpoint);
    if (
      checkpoint.ticker !== identity.ticker
      || checkpoint.cnpj !== identity.cnpj
      || checkpoint.fromDate !== identity.fromDate
      || checkpoint.untilDate !== identity.untilDate
    ) {
      throw new Error("Checkpoint não pertence à identidade informada.");
    }

    const completed = new Set(checkpoint.completedDocumentIds);
    const actualPending = checkpoint.discoveredDocumentIds
      .filter((id) => !completed.has(id))
      .sort();
    const evidenceById = new Map(input.diagnosticEvidence.map((item) => [item.documentId, item]));
    const evidenceIds = [...evidenceById.keys()].sort();
    if (JSON.stringify(actualPending) !== JSON.stringify(evidenceIds)) {
      throw new Error(`Evidências divergem das pendências do checkpoint: ${actualPending.join(", ")}.`);
    }

    const exclusions: SingleFrozenDividendExclusion[] = [];
    for (const documentId of actualPending) {
      const evidence = evidenceById.get(documentId);
      if (!evidence) throw new Error(`Evidência ausente para ${documentId}.`);
      if (evidence.failure.documentId !== documentId) {
        throw new Error(`Evidência associada ao documento incorreto: ${documentId}.`);
      }
      if (!/^sha256:[a-f0-9]{64}$/.test(evidence.artifactDigest)) {
        throw new Error(`Digest do artefato diagnóstico inválido para ${documentId}.`);
      }
      const classification = classifyEvidence(identity, evidence);
      exclusions.push({
        documentId,
        ...classification,
        sourceUrl: sourceUrl(documentId),
        evidenceArtifactId: evidence.artifactId,
        evidenceArtifactDigest: evidence.artifactDigest,
        evidenceMessage: evidence.failure.message,
        evidenceHash: stableHash(evidence),
      });
      completed.add(documentId);
      delete checkpoint.failuresByDocumentId[documentId];
    }

    checkpoint.completedDocumentIds = [...completed].sort((left, right) => left.localeCompare(right));
    checkpoint.updatedAt = input.checkpoint.updatedAt;
    const finalCase = buildCase(identity, checkpoint);
    if (
      finalCase.status !== "complete"
      || finalCase.pendingDocumentIds.length > 0
      || finalCase.conflicts.length > 0
    ) {
      throw new Error(`Caso ${identity.ticker} não ficou completo após a finalização.`);
    }

    const auditWithoutHash: Omit<SingleFrozenDividendAudit, "auditHash"> = {
      schemaVersion: 1,
      phase: input.phase,
      sourceArtifacts: input.sourceArtifacts,
      identity,
      inputCheckpointHash: stableHash(input.checkpoint),
      exclusions: exclusions.sort((left, right) => left.documentId.localeCompare(right.documentId)),
      finalCaseHash: finalCase.caseHash,
      documentsDiscovered: finalCase.documentsDiscovered,
      documentsProcessed: finalCase.documentsProcessed,
      observations: finalCase.observations.length,
      pendingDocuments: finalCase.pendingDocumentIds.length,
      conflicts: finalCase.conflicts.length,
    };
    const audit: SingleFrozenDividendAudit = {
      ...auditWithoutHash,
      auditHash: stableHash(auditWithoutHash),
    };
    return { case: finalCase, checkpoint, audit };
  }
}
