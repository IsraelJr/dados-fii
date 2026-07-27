import { createHash } from "node:crypto";
import {
  parseFnetDividendNoticeHtml,
  parseFnetProtocolHtml,
} from "@/lib/risk-lab/FnetDividendNoticeParser";
import type {
  FnetDividendNoticePreview,
  FnetNoticeCandidateRepository,
  FnetNoticeImportResult,
} from "@/types/riskLabFnetNotice";

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
  if (!value || /\s/.test(value) || value.length > 254) {
    throw new Error("Responsável administrativo inválido.");
  }
}

function assertValidDate(value: string, label: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${label} inválida.`);
  return timestamp;
}

export function validateAutomaticFnetNotice(input: {
  ticker: string;
  informationDate: string;
  announcedAt: string;
  baseDate: string;
  paymentDate: string;
  competenceMonth: string;
  amountPerShare: number;
  sourceHash: string;
  protocolHash: string;
  protocolVersion: number;
}) {
  const reasons: string[] = [];
  if (!/^[A-Z]{4}11$/.test(input.ticker)) reasons.push("ticker_invalid");
  if (!/^\d{4}-\d{2}$/.test(input.competenceMonth)) reasons.push("competence_invalid");
  if (!Number.isFinite(input.amountPerShare) || input.amountPerShare <= 0 || input.amountPerShare > 100) {
    reasons.push("amount_out_of_range");
  }
  if (!/^[a-f0-9]{64}$/.test(input.sourceHash)) reasons.push("source_hash_invalid");
  if (!/^[a-f0-9]{64}$/.test(input.protocolHash)) reasons.push("protocol_hash_invalid");
  if (!Number.isInteger(input.protocolVersion) || input.protocolVersion < 1) reasons.push("protocol_version_invalid");
  const informationAt = assertValidDate(input.informationDate, "Data da informação");
  const announcedAt = assertValidDate(input.announcedAt, "Data de anúncio");
  const baseAt = assertValidDate(input.baseDate, "Data-base");
  const paymentAt = assertValidDate(input.paymentDate, "Data de pagamento");
  if (announcedAt < informationAt) reasons.push("announcement_before_information");
  if (paymentAt < baseAt) reasons.push("payment_before_base_date");
  return {
    valid: reasons.length === 0,
    reasons,
    validationVersion: "fnet-notice-validation-v1" as const,
    validationHash: sha256(JSON.stringify({
      ...input,
      validationVersion: "fnet-notice-validation-v1",
    })),
  };
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
  repository: FnetNoticeCandidateRepository;
  now?: () => Date;
}

export class FnetDividendNoticeImportService {
  private readonly fetchImpl: typeof fetch;
  private readonly repository: FnetNoticeCandidateRepository;
  private readonly now: () => Date;

  constructor(dependencies: FnetDividendNoticeImportDependencies) {
    this.fetchImpl = dependencies.fetchImpl || fetch;
    this.repository = dependencies.repository;
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

    if (protocol.referenceDate !== notice.informationDate && protocol.referenceDate !== notice.baseDate) {
      throw new Error("Data de referência do protocolo diverge do aviso estruturado.");
    }
    if (Date.parse(protocol.deliveredAt) < Date.parse(`${notice.informationDate}T00:00:00-03:00`)) {
      throw new Error("Horário do protocolo é anterior à data informada no aviso.");
    }

    const importedAt = this.now().toISOString();
    const sourceHash = sha256(noticeHtml);
    const protocolHash = sha256(protocolHtml);
    const validation = validateAutomaticFnetNotice({
      ticker: notice.ticker,
      informationDate: notice.informationDate,
      announcedAt: protocol.deliveredAt,
      baseDate: notice.baseDate,
      paymentDate: notice.paymentDate,
      competenceMonth: notice.competenceMonth,
      amountPerShare: notice.amountPerShare,
      sourceHash,
      protocolHash,
      protocolVersion: protocol.version,
    });
    if (!validation.valid) {
      throw new Error(`Aviso FNET reprovado pela validação automática: ${validation.reasons.join(", ")}.`);
    }
    const candidate: FnetDividendNoticePreview = {
      candidateId: `${notice.ticker}_${notice.competenceMonth}_${normalizedId}`,
      documentId: normalizedId,
      sourceUrl,
      sourceHash,
      protocolUrl,
      protocolHash,
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
      reviewStatus: "verified_automatic",
      validationVersion: validation.validationVersion,
      validationHash: validation.validationHash,
      validationReasons: validation.reasons,
      importedBy: actor,
      importedAt,
      reviewedBy: actor,
      reviewedAt: importedAt,
      rejectionReason: null,
    };

    return this.repository.saveImported(candidate);
  }

  async listRecent(limit = 30) {
    return this.repository.listRecent(limit);
  }

  async reject(candidateId: string, actor: string, reason: string) {
    assertActor(actor);
    return this.repository.reject(candidateId.trim(), actor, reason);
  }
}
