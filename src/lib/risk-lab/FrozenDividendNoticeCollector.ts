import {
  FnetDividendDocumentDiscovery,
  type FnetDividendDocumentDiscoveryResult,
} from "@/lib/risk-lab/FnetDividendDocumentDiscovery";
import {
  parseFnetDividendNoticeHtml,
  parseFnetProtocolHtml,
} from "@/lib/risk-lab/FnetDividendNoticeParser";
import {
  hashFrozenDividendCase,
  hashFrozenDividendDataset,
  sha256Text,
} from "@/lib/risk-lab/FrozenDividendDatasetIntegrity";
import type { AutomaticDocumentEvidence } from "@/types/riskLabAutomatic";
import type {
  FrozenDividendCaseCheckpoint,
  FrozenDividendCollectionCheckpoint,
  FrozenDividendNoticeCase,
  FrozenDividendNoticeDataset,
  FrozenDividendNoticeFailure,
  FrozenDividendNoticeObservation,
} from "@/types/riskLabFrozenDividendDataset";

const FNET_ORIGIN = "https://fnet.bmfbovespa.com.br";
const MAX_HTML_BYTES = 2_000_000;
const DEFAULT_ATTEMPTS = 4;
const DEFAULT_TIMEOUT_MS = 45_000;
const COLLECTOR_VERSION = "1.0.0";

export interface FrozenDividendCohortIdentity {
  ticker: string;
  cnpj: string;
  role: "severe_deterioration" | "healthy_control" | "reversible_stress";
  fromDate: string;
  untilDate: string;
}

export interface FrozenDividendNoticeCollectorDependencies {
  discovery?: Pick<FnetDividendDocumentDiscovery, "discover">;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
  attempts?: number;
  timeoutMs?: number;
}

export type PersistFrozenDividendCheckpoint = (
  checkpoint: FrozenDividendCollectionCheckpoint,
) => Promise<void>;

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

function canonicalUrl(path: string, id: string) {
  const url = new URL(path, FNET_ORIGIN);
  url.searchParams.set(path.includes("Protocolo") ? "idDocumento" : "id", id);
  if (path.includes("exibirDocumento")) url.searchParams.set("cvm", "true");
  return url.toString();
}

function retryable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /AbortError|HTTP (408|425|429|5\d\d)|network|fetch failed|socket|timed out/i.test(message)
    || (error instanceof Error && error.name === "AbortError");
}

function checkpointFor(
  identity: FrozenDividendCohortIdentity,
  current: FrozenDividendCaseCheckpoint | undefined,
  now: string,
): FrozenDividendCaseCheckpoint {
  if (
    current
    && current.cnpj === identity.cnpj
    && current.fromDate === identity.fromDate
    && current.untilDate === identity.untilDate
  ) return current;
  return {
    ticker: identity.ticker,
    cnpj: identity.cnpj,
    fromDate: identity.fromDate,
    untilDate: identity.untilDate,
    discoveredDocumentIds: [],
    completedDocumentIds: [],
    observationsByDocumentId: {},
    failuresByDocumentId: {},
    updatedAt: now,
  };
}

function validateIdentity(identity: FrozenDividendCohortIdentity) {
  if (!/^[A-Z]{4}11$/.test(identity.ticker)) throw new Error(`Ticker inválido: ${identity.ticker}.`);
  if (!/^\d{14}$/.test(identity.cnpj)) throw new Error(`CNPJ inválido para ${identity.ticker}.`);
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(identity.fromDate) || !/^20\d{2}-\d{2}-\d{2}$/.test(identity.untilDate)) {
    throw new Error(`Janela inválida para ${identity.ticker}.`);
  }
  if (Date.parse(identity.fromDate) > Date.parse(identity.untilDate)) {
    throw new Error(`Janela invertida para ${identity.ticker}.`);
  }
}

function selectKnownVersions(
  observations: FrozenDividendNoticeObservation[],
  untilDate: string,
) {
  const until = Date.parse(`${untilDate}T23:59:59-03:00`);
  const grouped = new Map<string, FrozenDividendNoticeObservation[]>();
  for (const observation of observations) {
    if (Date.parse(observation.announcedAt) > until) continue;
    grouped.set(observation.competenceMonth, [
      ...(grouped.get(observation.competenceMonth) || []),
      observation,
    ]);
  }

  const selected: FrozenDividendNoticeObservation[] = [];
  const conflicts: string[] = [];
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

export class FrozenDividendNoticeCollector {
  private readonly discovery: Pick<FnetDividendDocumentDiscovery, "discover">;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => Date;
  private readonly attempts: number;
  private readonly timeoutMs: number;

  constructor(dependencies: FrozenDividendNoticeCollectorDependencies = {}) {
    this.discovery = dependencies.discovery || new FnetDividendDocumentDiscovery();
    this.fetchImpl = dependencies.fetchImpl || fetch;
    this.sleep = dependencies.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = dependencies.now || (() => new Date());
    this.attempts = Math.max(1, Math.min(8, dependencies.attempts || DEFAULT_ATTEMPTS));
    this.timeoutMs = Math.max(1_000, dependencies.timeoutMs || DEFAULT_TIMEOUT_MS);
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === this.attempts || !retryable(error)) throw error;
        await this.sleep(Math.min(30_000, 500 * 2 ** (attempt - 1)));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Falha desconhecida após retentativas.");
  }

  private async fetchHtml(url: string) {
    return this.withRetry(async () => {
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
            "User-Agent": "DadosFII-RiskLab/1.0 (+frozen-primary-dividend-collector)",
          },
        });
        if (!response.ok) throw new Error(`Fundos.NET respondeu HTTP ${response.status}.`);
        const html = await response.text();
        if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
          throw new Error("Documento Fundos.NET excede o limite seguro de 2 MB.");
        }
        return html;
      } finally {
        clearTimeout(timer);
      }
    });
  }

  private async discover(identity: FrozenDividendCohortIdentity): Promise<FnetDividendDocumentDiscoveryResult> {
    return this.withRetry(() => this.discovery.discover(identity.cnpj, identity.fromDate, identity.untilDate));
  }

  private async collectDocument(
    identity: FrozenDividendCohortIdentity,
    document: AutomaticDocumentEvidence,
  ): Promise<FrozenDividendNoticeObservation | null> {
    const sourceUrl = canonicalUrl("/fnet/publico/exibirDocumento", document.documentId);
    const protocolUrl = canonicalUrl("/fnet/publico/visualizarProtocoloDocumentoCVM", document.documentId);

    // A coleta é deliberadamente sequencial: aviso primeiro, protocolo depois.
    const noticeHtml = await this.fetchHtml(sourceUrl);
    const protocolHtml = await this.fetchHtml(protocolUrl);
    const notice = parseFnetDividendNoticeHtml(noticeHtml);
    const protocol = parseFnetProtocolHtml(protocolHtml);

    if (notice.ticker !== identity.ticker) {
      throw new Error(`Ticker divergente no aviso ${document.documentId}: ${notice.ticker}.`);
    }
    if (!(notice.amountPerShare > 0)) {
      throw new Error(`Valor anunciado não positivo no aviso ${document.documentId}.`);
    }
    if (protocol.referenceDate !== notice.informationDate && protocol.referenceDate !== notice.baseDate) {
      throw new Error(`Aviso e protocolo divergem na data de referência (${document.documentId}).`);
    }
    const announcedAt = Date.parse(protocol.deliveredAt);
    const lowerBound = Date.parse(`${identity.fromDate}T00:00:00-03:00`);
    const upperBound = Date.parse(`${identity.untilDate}T23:59:59-03:00`);
    if (!Number.isFinite(announcedAt) || announcedAt < lowerBound || announcedAt > upperBound) {
      throw new Error(`Documento ${document.documentId} fora da janela conhecida.`);
    }
    if (announcedAt < Date.parse(`${notice.informationDate}T00:00:00-03:00`)) {
      throw new Error(`Protocolo anterior à informação do aviso ${document.documentId}.`);
    }
    const catalogDifference = Math.abs(announcedAt - Date.parse(document.receivedAt));
    if (!Number.isFinite(catalogDifference) || catalogDifference > 36 * 60 * 60 * 1000) {
      throw new Error(`Entrega do protocolo diverge do catálogo (${document.documentId}).`);
    }

    const competence = monthIndex(notice.competenceMonth);
    const firstMonth = monthIndex(identity.fromDate.slice(0, 7));
    const lastMonth = monthIndex(identity.untilDate.slice(0, 7));
    if (competence < firstMonth || competence > lastMonth) return null;

    return {
      ticker: identity.ticker,
      competenceMonth: notice.competenceMonth,
      amountPerShare: notice.amountPerShare,
      announcedAt: protocol.deliveredAt,
      informationDate: notice.informationDate,
      baseDate: notice.baseDate,
      paymentDate: notice.paymentDate,
      documentId: document.documentId,
      receivedAt: document.receivedAt,
      sourceUrl,
      protocolUrl,
      page: 1,
      excerpt: `Aviso estruturado validado; competência ${notice.competenceMonth}; valor R$ ${notice.amountPerShare}; entrega ${protocol.deliveredAt}; versão ${protocol.version}.`,
      sourceHash: sha256Text(noticeHtml),
      protocolHash: sha256Text(protocolHtml),
      protocolVersion: protocol.version,
      sourceVersion: `fnet-notice-protocol-v${protocol.version}`,
    };
  }

  private buildCase(
    identity: FrozenDividendCohortIdentity,
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

  async collect(
    identities: FrozenDividendCohortIdentity[],
    releaseCommit: string,
    existingCheckpoint: FrozenDividendCollectionCheckpoint | null,
    persistCheckpoint: PersistFrozenDividendCheckpoint,
  ): Promise<{ dataset: FrozenDividendNoticeDataset; checkpoint: FrozenDividendCollectionCheckpoint }> {
    if (!/^[a-f0-9]{40}$/.test(releaseCommit)) throw new Error("Commit de Produção inválido para congelamento.");
    if (identities.length !== 6 || new Set(identities.map((item) => item.ticker)).size !== 6) {
      throw new Error("A coleta congelada exige seis identidades únicas.");
    }
    identities.forEach(validateIdentity);

    const startedAt = this.now().toISOString();
    const checkpoint: FrozenDividendCollectionCheckpoint = existingCheckpoint?.releaseCommit === releaseCommit
      ? existingCheckpoint
      : {
        schemaVersion: 1,
        datasetId: "risk-lab-fnet-dividend-notices-v0.1",
        releaseCommit,
        cases: {},
        updatedAt: startedAt,
      };

    for (const identity of identities) {
      const caseCheckpoint = checkpointFor(identity, checkpoint.cases[identity.ticker], this.now().toISOString());
      checkpoint.cases[identity.ticker] = caseCheckpoint;
      let discovery: FnetDividendDocumentDiscoveryResult;
      try {
        discovery = await this.discover(identity);
        delete caseCheckpoint.failuresByDocumentId.DISCOVERY;
      } catch (error) {
        const previous = caseCheckpoint.failuresByDocumentId.DISCOVERY;
        caseCheckpoint.discoveredDocumentIds = ["DISCOVERY"];
        caseCheckpoint.failuresByDocumentId.DISCOVERY = {
          documentId: "DISCOVERY",
          message: error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida na descoberta.",
          attempts: (previous?.attempts || 0) + 1,
          retryable: retryable(error),
          lastAttemptAt: this.now().toISOString(),
        };
        caseCheckpoint.updatedAt = this.now().toISOString();
        checkpoint.updatedAt = caseCheckpoint.updatedAt;
        await persistCheckpoint(checkpoint);
        continue;
      }
      const documents = [...discovery.documents].sort((left, right) =>
        Date.parse(left.receivedAt) - Date.parse(right.receivedAt)
        || left.documentId.localeCompare(right.documentId));
      caseCheckpoint.discoveredDocumentIds = [...new Set(documents.map((item) => item.documentId))];
      const completed = new Set(caseCheckpoint.completedDocumentIds);

      for (const document of documents) {
        if (completed.has(document.documentId)) continue;
        try {
          const observation = await this.collectDocument(identity, document);
          if (observation) caseCheckpoint.observationsByDocumentId[document.documentId] = observation;
          delete caseCheckpoint.failuresByDocumentId[document.documentId];
          completed.add(document.documentId);
          caseCheckpoint.completedDocumentIds = [...completed].sort((left, right) => left.localeCompare(right));
        } catch (error) {
          const previous = caseCheckpoint.failuresByDocumentId[document.documentId];
          caseCheckpoint.failuresByDocumentId[document.documentId] = {
            documentId: document.documentId,
            message: error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida.",
            attempts: (previous?.attempts || 0) + 1,
            retryable: retryable(error),
            lastAttemptAt: this.now().toISOString(),
          };
        }
        caseCheckpoint.updatedAt = this.now().toISOString();
        checkpoint.updatedAt = caseCheckpoint.updatedAt;
        await persistCheckpoint(checkpoint);
      }
    }

    const cases = identities.map((identity) => this.buildCase(identity, checkpoint.cases[identity.ticker]));
    const status = cases.some((item) => item.status === "blocked")
      ? "blocked"
      : cases.every((item) => item.status === "complete")
        ? "complete"
        : "pending";
    const withoutHash: Omit<FrozenDividendNoticeDataset, "datasetHash"> = {
      schemaVersion: 1,
      datasetId: "risk-lab-fnet-dividend-notices-v0.1",
      datasetVersion: "0.1.0",
      collectorVersion: COLLECTOR_VERSION,
      status,
      generatedAt: this.now().toISOString(),
      releaseCommit,
      cohortId: "risk-lab-credit-oos-v0.1",
      cohortVersion: "0.1.0",
      rulesetVersion: "0.1.0",
      cases,
    };
    const dataset: FrozenDividendNoticeDataset = {
      ...withoutHash,
      datasetHash: hashFrozenDividendDataset(withoutHash),
    };
    checkpoint.updatedAt = this.now().toISOString();
    await persistCheckpoint(checkpoint);
    return { dataset, checkpoint };
  }
}
