import type { AutomaticDocumentEvidence } from "@/types/riskLabAutomatic";

const FNET_ORIGIN = "https://fnet.bmfbovespa.com.br";
const PAGE_SIZE = 100;
const MAX_RECORDS = 5_000;
const TIMEOUT_MS = 45_000;
const FETCH_ATTEMPTS = 2;

interface FnetManagerRow {
  id?: unknown;
  categoriaDocumento?: unknown;
  tipoDocumento?: unknown;
  dataReferencia?: unknown;
  dataEntrega?: unknown;
  descricaoStatus?: unknown;
  descricaoModalidade?: unknown;
  situacaoDocumento?: unknown;
  versao?: unknown;
}

interface FnetManagerPayload {
  data?: FnetManagerRow[];
  draw?: number;
  recordsFiltered?: number;
  recordsTotal?: number;
}

export interface FnetDividendDocumentDiscoveryResult {
  internalFundId: string;
  documents: AutomaticDocumentEvidence[];
  recordsInspected: number;
  sourceUrl: string;
}

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function formatCnpj(value: string) {
  const normalized = digits(value);
  if (normalized.length !== 14) throw new Error("CNPJ inválido para descoberta Fundos.NET.");
  return normalized.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function brDate(value: string) {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) throw new Error(`Data inválida para consulta Fundos.NET: ${value}.`);
  return `${match[1]}/${match[2]}/${match[3]}`;
}

function isoToBr(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Janela ISO inválida para consulta Fundos.NET: ${value}.`);
  return brDate(`${match[3]}/${match[2]}/${match[1]}`);
}

function parseReferenceDate(value: unknown): string | null {
  const text = String(value || "").trim();
  const full = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+\d{2}:\d{2})?$/);
  if (full) return `${full[3]}-${full[2]}-${full[1]}`;
  const month = text.match(/^(\d{2})\/(\d{4})$/);
  if (month) return `${month[2]}-${month[1]}-01`;
  return null;
}

function parseDeliveryDate(value: unknown): string | null {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:${match[6] || "00"}-03:00`;
}

function attributes(source: string) {
  const result = new Map<string, string>();
  for (const match of source.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) {
    result.set(match[1].toLowerCase(), match[2]);
  }
  return result;
}

export function resolveFnetInternalFundId(html: string) {
  const candidates = [...html.matchAll(/<input\b([^>]*)>/gi)]
    .map((match) => attributes(match[1]))
    .filter((item) => normalize(item.get("type")) === "HIDDEN")
    .map((item) => String(item.get("id") || ""))
    .filter((id) => /^\d{2,12}$/.test(id));
  const unique = [...new Set(candidates)];
  if (unique.length !== 1) {
    throw new Error(`Fundos.NET não resolveu um idFundo único para o CNPJ consultado (${unique.length} candidato(s)).`);
  }
  return unique[0];
}

function isDividendRow(row: FnetManagerRow) {
  return normalize(row.categoriaDocumento) === "AVISO AOS COTISTAS - ESTRUTURADO"
    && normalize(row.tipoDocumento) === "RENDIMENTOS E AMORTIZACOES";
}

function acceptedStatus(row: FnetManagerRow) {
  const status = normalize(row.situacaoDocumento);
  return !status || status === "A" || status === "I";
}

export function mapFnetDividendRows(
  rows: FnetManagerRow[],
  fromDate: string,
  untilDate: string,
): AutomaticDocumentEvidence[] {
  const from = Date.parse(`${fromDate}T00:00:00-03:00`);
  const until = Date.parse(`${untilDate}T23:59:59-03:00`);
  const documents = new Map<string, AutomaticDocumentEvidence>();

  for (const row of rows) {
    if (!isDividendRow(row) || !acceptedStatus(row)) continue;
    const documentId = String(row.id || "").trim();
    const receivedAt = parseDeliveryDate(row.dataEntrega);
    if (!/^\d{1,20}$/.test(documentId) || !receivedAt) continue;
    const receivedTime = Date.parse(receivedAt);
    if (!Number.isFinite(receivedTime) || receivedTime < from || receivedTime > until) continue;
    const competenceDate = parseReferenceDate(row.dataReferencia);
    const sourceYear = Number((competenceDate || receivedAt).slice(0, 4));
    const version = Number(row.versao);
    documents.set(documentId, {
      documentId,
      documentType: "Aviso aos Cotistas - Estruturado - Rendimentos e Amortizações",
      fileName: `fnet-rendimentos-${documentId}.html`,
      competenceDate,
      receivedAt,
      link: `${FNET_ORIGIN}/fnet/publico/exibirDocumento?cvm=true&id=${documentId}`,
      sourceYear,
      auditResult: [
        String(row.descricaoStatus || "").trim(),
        String(row.descricaoModalidade || "").trim(),
        Number.isInteger(version) ? `versão ${version}` : "",
      ].filter(Boolean).join("; ") || null,
      confidence: normalize(row.situacaoDocumento) === "A" ? 99 : 96,
    });
  }

  return [...documents.values()].sort((left, right) => Date.parse(left.receivedAt) - Date.parse(right.receivedAt));
}

async function fetchText(fetchImpl: typeof fetch, url: URL, accept: string) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: accept,
          Referer: `${FNET_ORIGIN}/fnet/publico/pesquisarGerenciadorDocumentosCVM?paginaCertificados=false&tipoFundo=1`,
          "User-Agent": "DadosFII-RiskLab/0.3 (+automatic-primary-dividend-discovery)",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!response.ok) throw new Error(`Fundos.NET respondeu HTTP ${response.status}.`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt === FETCH_ATTEMPTS) throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha ao consultar o Fundos.NET.");
}

export interface FnetDividendDocumentDiscoveryDependencies {
  fetchImpl?: typeof fetch;
}

export class FnetDividendDocumentDiscovery {
  private readonly fetchImpl: typeof fetch;

  constructor(dependencies: FnetDividendDocumentDiscoveryDependencies = {}) {
    this.fetchImpl = dependencies.fetchImpl || fetch;
  }

  private async resolveFundId(cnpj: string) {
    const manager = new URL("/fnet/publico/pesquisarGerenciadorDocumentosCVM", FNET_ORIGIN);
    manager.searchParams.set("paginaCertificados", "false");
    manager.searchParams.set("tipoFundo", "1");
    manager.searchParams.set("cnpjFundo", digits(cnpj));
    const html = await fetchText(this.fetchImpl, manager, "text/html,application/xhtml+xml");
    return resolveFnetInternalFundId(html);
  }

  async discover(cnpj: string, fromDate: string, untilDate: string): Promise<FnetDividendDocumentDiscoveryResult> {
    const formattedCnpj = formatCnpj(cnpj);
    const internalFundId = await this.resolveFundId(cnpj);
    const allRows: FnetManagerRow[] = [];
    let start = 0;
    let total = 0;
    let draw = 1;
    let sourceUrl = "";

    do {
      const url = new URL("/fnet/publico/pesquisarGerenciadorDocumentosDados", FNET_ORIGIN);
      const parameters = {
        paginaCertificados: "false",
        tipoFundo: "1",
        administrador: "",
        idFundo: internalFundId,
        idCategoriaDocumento: "0",
        idTipoDocumento: "0",
        idEspecieDocumento: "0",
        situacao: "",
        cnpj: formattedCnpj,
        dataReferencia: "",
        ultimaDataReferencia: "false",
        dataInicial: isoToBr(fromDate),
        dataFinal: isoToBr(untilDate),
        idModalidade: "",
        palavraChave: "",
        d: String(draw),
        s: String(start),
        l: String(PAGE_SIZE),
      };
      for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
      sourceUrl = url.toString();
      const text = await fetchText(this.fetchImpl, url, "application/json,text/plain;q=0.9,*/*;q=0.1");
      let payload: FnetManagerPayload;
      try {
        payload = JSON.parse(text) as FnetManagerPayload;
      } catch {
        throw new Error("Fundos.NET retornou JSON inválido na descoberta de rendimentos.");
      }
      const rows = Array.isArray(payload.data) ? payload.data : [];
      total = Number(payload.recordsFiltered ?? payload.recordsTotal ?? rows.length);
      if (!Number.isFinite(total) || total < 0 || total > MAX_RECORDS) {
        throw new Error(`Consulta Fundos.NET não ficou restrita ao fundo (${total} registros).`);
      }
      allRows.push(...rows);
      start += rows.length;
      draw += 1;
      if (!rows.length) break;
    } while (start < total);

    return {
      internalFundId,
      documents: mapFnetDividendRows(allRows, fromDate, untilDate),
      recordsInspected: allRows.length,
      sourceUrl,
    };
  }
}

export const fnetDividendDocumentDiscovery = new FnetDividendDocumentDiscovery();
