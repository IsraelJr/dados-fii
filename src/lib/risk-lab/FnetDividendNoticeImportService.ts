import { createHash } from "node:crypto";
import {
  parseFnetDividendNoticeHtml,
  parseFnetProtocolHtml,
} from "@/lib/risk-lab/FnetDividendNoticeParser";
import { fnetNoticeCandidateStore } from "@/lib/risk-lab/FnetNoticeCandidateStore";
import type {
  FnetDividendNoticePreview,
  FnetNoticeCandidateRepository,
  FnetNoticeImportResult,
} from "@/types/riskLabFnetNotice";

const SUPPORTED_TICKERS = new Set(["MCCI11", "RBRY11"]);
const FNET_ORIGIN = "https://fnet.bmfbovespa.com.br";
const MAX_HTML_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 15_000;

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function assertDocumentId(value: string) {
  if (!/^\d{1,12}$/.test(value)) throw new Error("ID de documento FNET inválido.");
}

function assertActor(value: string) {
  if (!value || !value.includes("@") || value.length > 254) {
    throw new Error("Responsável administrativo inválido.");
  }
}

async function fetchHtml(fetchImpl: typeof fetch, url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "DadosFII-RiskLab/0.1 (+admin-primary-source-import)",
      },
      cache: "no-store",
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
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Tempo limite ao consultar o FNET.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export interface FnetDividendNoticeImportDependencies {
  fetchImpl?: typeof fetch;
  repository?: FnetNoticeCandidateRepository;
  now?: () => Date;
}

export class FnetDividendNoticeImportService {
  private readonly fetchImpl: typeof fetch;
  private readonly repository: FnetNoticeCandidateRepository;
  private readonly now: () => Date;

  constructor(dependencies: FnetDividendNoticeImportDependencies = {}) {
    this.fetchImpl = dependencies.fetchImpl || fetch;
    this.repository = dependencies.repository || fnetNoticeCandidateStore;
    this.now = dependencies.now || (() => new Date());
  }

  async importByDocumentId(documentId: string, actor: string): Promise<FnetNoticeImportResult> {
    const normalizedId = documentId.trim();
    assertDocumentId(normalizedId);
    assertActor(actor);

    const sourceUrl = `${FNET_ORIGIN}/fnet/publico/exibirDocumento?cvm=true&id=${normalizedId}`;
    const protocolUrl = `${FNET_ORIGIN}/fnet/publico/visualizarProtocoloDocumentoCVM?idDocumento=${normalizedId}`;
    const [noticeHtml, protocolHtml] = await Promise.all([
      fetchHtml(this.fetchImpl, sourceUrl),
      fetchHtml(this.fetchImpl, protocolUrl),
    ]);

    const notice = parseFnetDividendNoticeHtml(noticeHtml);
    const protocol = parseFnetProtocolHtml(protocolHtml);

    if (!SUPPORTED_TICKERS.has(notice.ticker)) {
      throw new Error(`Ticker ${notice.ticker} não pertence à coorte MCCI11/RBRY11.`);
    }
    if (protocol.referenceDate !== notice.informationDate && protocol.referenceDate !== notice.baseDate) {
      throw new Error("Data de referência do protocolo diverge do aviso estruturado.");
    }
    if (Date.parse(protocol.deliveredAt) < Date.parse(`${notice.informationDate}T00:00:00-03:00`)) {
      throw new Error("Horário do protocolo é anterior à data informada no aviso.");
    }

    const importedAt = this.now().toISOString();
    const candidate: FnetDividendNoticePreview = {
      candidateId: `${notice.ticker}_${notice.competenceMonth}_${normalizedId}`,
      documentId: normalizedId,
      sourceUrl,
      sourceHash: sha256(noticeHtml),
      protocolUrl,
      protocolHash: sha256(protocolHtml),
      protocolVersion: protocol.version,
      ticker: notice.ticker,
      fundName: notice.fundName,
      informationDate: notice.informationDate,
      announcedAt: protocol.deliveredAt,
      baseDate: notice.baseDate,
      paymentDate: notice.paymentDate,
      competenceMonth: notice.competenceMonth,
      periodReferenceRaw: notice.periodReferenceRaw,
      amountPerShare: notice.amountPerShare,
      incomeTaxExempt: notice.incomeTaxExempt,
      reviewStatus: "pending_manual_review",
      importedBy: actor,
      importedAt,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
    };

    return this.repository.saveImported(candidate);
  }

  async listRecent(limit = 30) {
    return this.repository.listRecent(limit);
  }

  async approve(candidateId: string, actor: string) {
    assertActor(actor);
    return this.repository.approve(candidateId.trim(), actor);
  }

  async reject(candidateId: string, actor: string, reason: string) {
    assertActor(actor);
    return this.repository.reject(candidateId.trim(), actor, reason);
  }
}

export const fnetDividendNoticeImportService = new FnetDividendNoticeImportService();
