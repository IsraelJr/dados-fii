import { parseFnetDividendNoticeHtml } from "@/lib/risk-lab/FnetDividendNoticeParser";
import { hashFrozenDividendCase, sha256Text } from "@/lib/risk-lab/FrozenDividendDatasetIntegrity";
import type { FrozenDividendCaseCheckpoint, FrozenDividendNoticeCase, FrozenDividendNoticeFailure, FrozenDividendNoticeObservation } from "@/types/riskLabFrozenDividendDataset";

const FNET_ORIGIN = "https://fnet.bmfbovespa.com.br";
const MAX_HTML_BYTES = 2_000_000;

export interface SingleFrozenDividendIdentity {
  ticker: string;
  cnpj: string;
  role: "severe_deterioration" | "healthy_control" | "reversible_stress";
  fromDate: string;
  untilDate: string;
}

export interface SingleFrozenDividendInput {
  schemaVersion: 1;
  phase: string;
  sourceArtifact: Record<string, unknown>;
  identity: SingleFrozenDividendIdentity;
  checkpoint: FrozenDividendCaseCheckpoint;
  pendingDocumentIds: string[];
}

export interface SingleFrozenDividendExclusion {
  documentId: string;
  classification: "outside_cohort_window" | "secondary_share_class";
  parsedTicker: string;
  competenceMonth: string;
  sourceUrl: string;
  sourceHash: string;
}

export interface SingleFrozenDividendAudit {
  schemaVersion: 1;
  phase: string;
  sourceArtifact: Record<string, unknown>;
  identity: SingleFrozenDividendIdentity;
  inputCheckpointHash: string;
  exclusions: SingleFrozenDividendExclusion[];
  finalCaseHash: string;
  documentsDiscovered: number;
  documentsProcessed: number;
  observations: number;
  pendingDocuments: number;
  auditHash: string;
}

export interface SingleFrozenDividendFinalizerDependencies {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  attempts?: number;
  timeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, stableValue(item)]));
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
  return [observation.ticker, observation.informationDate, observation.baseDate, observation.paymentDate].join("|");
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
    items.sort((left, right) => right.protocolVersion - left.protocolVersion
      || Date.parse(right.announcedAt) - Date.parse(left.announcedAt)
      || right.documentId.localeCompare(left.documentId));
    const highestVersion = items[0].protocolVersion;
    const candidates = items.filter((item) => item.protocolVersion === highestVersion);
    const signatures = new Set(candidates.map((item) => `${item.competenceMonth}|${item.amountPerShare.toFixed(8)}`));
    if (signatures.size > 1) {
      conflicts.push(`Reapresentações conflitantes no evento ${eventKey}, versão ${highestVersion}.`);
      continue;
    }
    currentEvents.push(candidates[0]);
  }
  const grouped = new Map<string, FrozenDividendNoticeObservation[]>();
  for (const observation of currentEvents) grouped.set(observation.competenceMonth, [...(grouped.get(observation.competenceMonth) || []), observation]);
  const selected: FrozenDividendNoticeObservation[] = [];
  for (const [competenceMonth, items] of grouped) {
    items.sort((left, right) => right.protocolVersion - left.protocolVersion
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

function buildCase(identity: SingleFrozenDividendIdentity, checkpoint: FrozenDividendCaseCheckpoint): FrozenDividendNoticeCase {
  const completed = new Set(checkpoint.completedDocumentIds);
  const pendingDocumentIds = checkpoint.discoveredDocumentIds.filter((id) => !completed.has(id));
  const { selected, conflicts } = selectKnownVersions(Object.values(checkpoint.observationsByDocumentId), identity.untilDate);
  const coverage = seriesCoverage(selected.map((item) => item.competenceMonth));
  const status = conflicts.length ? "blocked" : pendingDocumentIds.length || !selected.length ? "incomplete" : "complete";
  const failures = pendingDocumentIds.map((id) => checkpoint.failuresByDocumentId[id]).filter((item): item is FrozenDividendNoticeFailure => Boolean(item));
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
  const url = new URL("/fnet/publico/exibirDocumento", FNET_ORIGIN);
  url.searchParams.set("id", documentId);
  url.searchParams.set("cvm", "true");
  return url.toString();
}

function retryable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /AbortError|operation was aborted|HTTP (408|425|429|5\d\d)|network|fetch failed|socket|timed out/i.test(message)
    || (error instanceof Error && error.name === "AbortError");
}

export class SingleFrozenDividendCaseFinalizer {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly attempts: number;
  private readonly timeoutMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(dependencies: SingleFrozenDividendFinalizerDependencies = {}) {
    this.fetchImpl = dependencies.fetchImpl || fetch;
    this.now = dependencies.now || (() => new Date());
    this.attempts = Math.max(1, Math.min(8, dependencies.attempts || 4));
    this.timeoutMs = Math.max(1_000, dependencies.timeoutMs || 45_000);
    this.sleep = dependencies.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  private async fetchHtml(url: string) {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          method: "GET",
          redirect: "follow",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Accept: "text/html,application/xhtml+xml",
            Referer: `${FNET_ORIGIN}/fnet/publico/abrirGerenciadorDocumentosCVM`,
            "User-Agent": "DadosFII-RiskLab/1.0 (+single-frozen-case-finalizer)",
          },
        });
        if (!response.ok) throw new Error(`Fundos.NET respondeu HTTP ${response.status}.`);
        const html = await response.text();
        if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) throw new Error("Documento Fundos.NET excede o limite seguro de 2 MB.");
        return html;
      } catch (error) {
        lastError = error;
        if (attempt === this.attempts || !retryable(error)) throw error;
        await this.sleep(Math.min(30_000, 500 * 2 ** (attempt - 1)));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Falha desconhecida após retentativas.");
  }

  async finalize(input: SingleFrozenDividendInput) {
    if (input.schemaVersion !== 1) throw new Error("Entrada da fase com schema incompatível.");
    const { identity } = input;
    if (!/^[A-Z]{4}11$/.test(identity.ticker) || !/^\d{14}$/.test(identity.cnpj)) throw new Error("Identidade inválida.");
    const checkpoint = structuredClone(input.checkpoint);
    if (checkpoint.ticker !== identity.ticker || checkpoint.cnpj !== identity.cnpj
      || checkpoint.fromDate !== identity.fromDate || checkpoint.untilDate !== identity.untilDate) {
      throw new Error("Checkpoint não pertence à identidade informada.");
    }
    const completed = new Set(checkpoint.completedDocumentIds);
    const actualPending = checkpoint.discoveredDocumentIds.filter((id) => !completed.has(id)).sort();
    const requestedPending = [...new Set(input.pendingDocumentIds)].sort();
    if (JSON.stringify(actualPending) !== JSON.stringify(requestedPending)) {
      throw new Error(`Pendências da entrada divergem do checkpoint: ${actualPending.join(", ")}.`);
    }

    const exclusions: SingleFrozenDividendExclusion[] = [];
    for (const documentId of requestedPending) {
      const url = sourceUrl(documentId);
      const html = await this.fetchHtml(url);
      const notice = parseFnetDividendNoticeHtml(html);
      let classification: SingleFrozenDividendExclusion["classification"] | null = null;
      if (notice.ticker !== identity.ticker) {
        if (notice.ticker.slice(0, 4) === identity.ticker.slice(0, 4)) classification = "secondary_share_class";
        else throw new Error(`Ticker divergente no aviso ${documentId}: ${notice.ticker}.`);
      }
      if (!(notice.amountPerShare > 0)) throw new Error(`Valor anunciado não positivo no aviso ${documentId}.`);
      const competence = monthIndex(notice.competenceMonth);
      const firstMonth = monthIndex(identity.fromDate.slice(0, 7));
      const lastMonth = monthIndex(identity.untilDate.slice(0, 7));
      if (!classification && (competence < firstMonth || competence > lastMonth)) classification = "outside_cohort_window";
      if (!classification) {
        throw new Error(`Documento primário ${documentId} pertence à janela e exige coleta completa com metadados de protocolo.`);
      }
      exclusions.push({ documentId, classification, parsedTicker: notice.ticker, competenceMonth: notice.competenceMonth, sourceUrl: url, sourceHash: sha256Text(html) });
      completed.add(documentId);
      delete checkpoint.failuresByDocumentId[documentId];
    }
    checkpoint.completedDocumentIds = [...completed].sort((left, right) => left.localeCompare(right));
    checkpoint.updatedAt = this.now().toISOString();
    const finalCase = buildCase(identity, checkpoint);
    if (finalCase.status !== "complete" || finalCase.pendingDocumentIds.length || finalCase.conflicts.length) {
      throw new Error(`Caso ${identity.ticker} não ficou completo após a finalização.`);
    }
    const auditWithoutHash: Omit<SingleFrozenDividendAudit, "auditHash"> = {
      schemaVersion: 1,
      phase: input.phase,
      sourceArtifact: input.sourceArtifact,
      identity,
      inputCheckpointHash: stableHash(input.checkpoint),
      exclusions: exclusions.sort((left, right) => left.documentId.localeCompare(right.documentId)),
      finalCaseHash: finalCase.caseHash,
      documentsDiscovered: finalCase.documentsDiscovered,
      documentsProcessed: finalCase.documentsProcessed,
      observations: finalCase.observations.length,
      pendingDocuments: finalCase.pendingDocumentIds.length,
    };
    const audit: SingleFrozenDividendAudit = { ...auditWithoutHash, auditHash: stableHash(auditWithoutHash) };
    return { case: finalCase, checkpoint, audit };
  }
}
