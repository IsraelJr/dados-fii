import { createHash } from "node:crypto";
import {
  parseFnetDividendNoticeHtml,
  parseFnetProtocolHtml,
} from "@/lib/risk-lab/FnetDividendNoticeParser";
import { dividendStressWindowEngine } from "@/lib/risk-lab/DividendStressWindowEngine";
import type {
  AutomaticDocumentEvidence,
  AutomaticMonthlySeries,
  AutomaticMonthlySourceSummary,
} from "@/types/riskLabAutomatic";
import type { VerifiedDividendNotice } from "@/types/riskLabDividendStress";

const FNET_ORIGIN = "https://fnet.bmfbovespa.com.br";
const MAX_HTML_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 25_000;
const MAX_DOCUMENTS_PER_YEAR = 18;
const MAX_TOTAL_DOCUMENTS = 108;
const CONCURRENCY = 2;
const FETCH_ATTEMPTS = 3;
const PIPELINE = "risk-lab-fnet-automatic-v0.1.0";

interface ValidatedNotice {
  observation: VerifiedDividendNotice;
  version: number;
  sourceYear: number;
  sourceHash: string;
  protocolHash: string;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function isDividendDocument(document: AutomaticDocumentEvidence) {
  const text = normalize(`${document.documentType} ${document.fileName}`);
  return text.includes("RENDIMENTO")
    || text.includes("AMORTIZACAO")
    || text.includes("PAGAMENTO DE PROVENTO")
    || text.includes("INFORMACOES SOBRE PAGAMENTO DE PROVENTOS")
    || (text.includes("AVISO AOS COTISTAS") && text.includes("PROVENTO"));
}

function selectCandidates(documents: AutomaticDocumentEvidence[]) {
  const byYear = new Map<number, AutomaticDocumentEvidence[]>();
  for (const document of documents.filter(isDividendDocument)) {
    byYear.set(document.sourceYear, [...(byYear.get(document.sourceYear) || []), document]);
  }
  return [...byYear.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([, entries]) => entries
      .sort((left, right) => Date.parse(right.receivedAt) - Date.parse(left.receivedAt))
      .slice(0, MAX_DOCUMENTS_PER_YEAR))
    .slice(0, MAX_TOTAL_DOCUMENTS);
}

function monthIndex(value: string) {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
}

function monthFromIndex(value: number) {
  const year = Math.floor(value / 12);
  const month = value % 12 + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function coverage(months: string[]) {
  if (!months.length) return { missingMonths: [] as string[], longest: 0 };
  const indexes = months.map(monthIndex).sort((a, b) => a - b);
  const existing = new Set(indexes);
  const missingMonths: string[] = [];
  for (let index = indexes[0]; index <= indexes[indexes.length - 1]; index += 1) {
    if (!existing.has(index)) missingMonths.push(monthFromIndex(index));
  }
  let longest = 1;
  let current = 1;
  for (let index = 1; index < indexes.length; index += 1) {
    if (indexes[index] === indexes[index - 1] + 1) current += 1;
    else current = 1;
    longest = Math.max(longest, current);
  }
  return { missingMonths, longest };
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function retryable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /AbortError|aborted|HTTP (408|425|429|5\d\d)|network|fetch failed|socket|ECONNRESET|ETIMEDOUT/i.test(message)
    || (error instanceof Error && error.name === "AbortError");
}

async function fetchHtmlOnce(fetchImpl: typeof fetch, url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "DadosFII-RiskLab/0.3 (+automatic-regulatory-validation)",
      },
    });
    if (!response.ok) throw new Error(`FNET respondeu HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error(`Conteúdo FNET inesperado: ${contentType || "sem content-type"}.`);
    }
    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      throw new Error("Documento FNET excede o limite seguro de 2 MB.");
    }
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHtml(fetchImpl: typeof fetch, url: string) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await fetchHtmlOnce(fetchImpl, url);
    } catch (error) {
      lastError = error;
      if (attempt === FETCH_ATTEMPTS || !retryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha desconhecida ao consultar o FNET.");
}

async function validateDocument(
  fetchImpl: typeof fetch,
  ticker: string,
  document: AutomaticDocumentEvidence,
  reviewedAt: string,
): Promise<ValidatedNotice> {
  const id = document.documentId;
  if (!/^\d{1,20}$/.test(id)) throw new Error("ID regulatório inválido.");
  const sourceUrl = `${FNET_ORIGIN}/fnet/publico/exibirDocumento?cvm=true&id=${id}`;
  const protocolUrl = `${FNET_ORIGIN}/fnet/publico/visualizarProtocoloDocumentoCVM?idDocumento=${id}`;
  const noticeHtml = await fetchHtml(fetchImpl, sourceUrl);
  const protocolHtml = await fetchHtml(fetchImpl, protocolUrl);
  const notice = parseFnetDividendNoticeHtml(noticeHtml);
  const protocol = parseFnetProtocolHtml(protocolHtml);
  if (notice.ticker !== ticker) throw new Error(`Ticker divergente: ${notice.ticker}.`);
  if (protocol.referenceDate !== notice.informationDate && protocol.referenceDate !== notice.baseDate) {
    throw new Error("Data de referência do protocolo diverge do aviso.");
  }
  if (Date.parse(protocol.deliveredAt) < Date.parse(`${notice.informationDate}T00:00:00-03:00`)) {
    throw new Error("Protocolo anterior à data informada no aviso.");
  }
  const receivedDifference = Math.abs(Date.parse(protocol.deliveredAt) - Date.parse(document.receivedAt));
  if (Number.isFinite(receivedDifference) && receivedDifference > 36 * 60 * 60 * 1000) {
    throw new Error("Horário do protocolo diverge do catálogo CVM.");
  }
  const sourceHash = sha256(noticeHtml);
  const protocolHash = sha256(protocolHtml);
  const source: VerifiedDividendNotice["source"] = {
    documentId: id,
    sourceUrl,
    sourceType: "primary_regulatory",
    reviewMethod: "automatic_regulatory_validation",
    reviewedBy: PIPELINE,
    reviewedAt,
    page: 1,
    excerpt: `Aviso FNET validado automaticamente; competência ${notice.competenceMonth}; valor R$ ${notice.amountPerShare}; protocolo ${protocol.deliveredAt}; versão ${protocol.version}.`,
    sourceHash,
    protocolHash,
    protocolVersion: protocol.version,
  };
  return {
    observation: { ticker, competenceMonth: notice.competenceMonth, amountPerShare: notice.amountPerShare, announcedAt: protocol.deliveredAt, source },
    version: protocol.version,
    sourceYear: document.sourceYear,
    sourceHash,
    protocolHash,
  };
}

function deduplicate(validated: ValidatedNotice[]) {
  const grouped = new Map<string, ValidatedNotice[]>();
  for (const item of validated) grouped.set(item.observation.competenceMonth, [...(grouped.get(item.observation.competenceMonth) || []), item]);
  const observations: VerifiedDividendNotice[] = [];
  const conflicts: string[] = [];
  for (const [month, items] of grouped) {
    items.sort((a, b) => b.version - a.version || Date.parse(b.observation.announcedAt) - Date.parse(a.observation.announcedAt));
    const topVersion = items[0].version;
    const top = items.filter((item) => item.version === topVersion);
    if (top.some((item) => Math.abs(item.observation.amountPerShare - top[0].observation.amountPerShare) > 1e-8)) {
      conflicts.push(`Valores conflitantes na competência ${month}, versão ${topVersion}.`);
      continue;
    }
    observations.push(top[0].observation);
  }
  observations.sort((a, b) => monthIndex(a.competenceMonth) - monthIndex(b.competenceMonth));
  return { observations, conflicts };
}

export interface AutomaticDividendSeriesDependencies { fetchImpl?: typeof fetch; now?: () => Date; }

export class AutomaticDividendSeriesService {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  constructor(dependencies: AutomaticDividendSeriesDependencies = {}) {
    this.fetchImpl = dependencies.fetchImpl || fetch;
    this.now = dependencies.now || (() => new Date());
  }
  async build(ticker: string, documents: AutomaticDocumentEvidence[]): Promise<AutomaticMonthlySeries> {
    const candidates = selectCandidates(documents);
    const reviewedAt = this.now().toISOString();
    const validated: ValidatedNotice[] = [];
    const failures: string[] = [];
    for (let start = 0; start < candidates.length; start += CONCURRENCY) {
      const batch = candidates.slice(start, start + CONCURRENCY);
      const results = await Promise.allSettled(batch.map((document) => validateDocument(this.fetchImpl, ticker, document, reviewedAt)));
      results.forEach((result, index) => {
        if (result.status === "fulfilled") validated.push(result.value);
        else failures.push(`${batch[index].documentId}: ${result.reason instanceof Error ? result.reason.message : "falha desconhecida"}`);
      });
    }
    const { observations, conflicts } = deduplicate(validated);
    const { missingMonths, longest } = coverage(observations.map((item) => item.competenceMonth));
    const years = Array.from(new Set(candidates.map((item) => item.sourceYear))).sort((a, b) => b - a);
    const sources: AutomaticMonthlySourceSummary[] = years.map((year) => {
      const inspected = candidates.filter((item) => item.sourceYear === year);
      const accepted = validated.filter((item) => item.sourceYear === year);
      const combinedHash = accepted.length ? sha256(accepted.map((item) => `${item.sourceHash}:${item.protocolHash}`).sort().join("|")) : null;
      return {
        year,
        sourceUrl: `${FNET_ORIGIN}/fnet/publico/abrirGerenciadorDocumentosCVM`,
        sourceHash: combinedHash,
        fetched: inspected.length > 0,
        documentsInspected: inspected.length,
        matchingRows: inspected.length,
        acceptedMonths: new Set(accepted.map((item) => item.observation.competenceMonth)).size,
        error: inspected.length > 0 && accepted.length === 0 ? "Nenhum aviso do ano passou na validação automática." : null,
      };
    });
    const blocked = conflicts.length > 0 || (candidates.length > 0 && observations.length === 0);
    const ready = !blocked && longest >= 9;
    return {
      status: blocked ? "blocked" : ready ? "ready" : "incomplete",
      observations,
      sources,
      missingMonths,
      conflicts: [...conflicts, ...failures.slice(0, 40)],
      longestContiguousSequence: longest,
      method: observations.length ? "direct_declared_per_share" : "unavailable",
      detectorResult: ready ? dividendStressWindowEngine.detect(observations) : null,
      detectorExecuted: ready,
      classificationFinal: false,
      limitation: ready ? "material_credit_events_not_automatically_validated" : "insufficient_structured_series",
    };
  }
}

export const automaticDividendSeriesService = new AutomaticDividendSeriesService();
