import type {
  AutomaticCreditAmbiguousDocument,
  AutomaticCreditEventMatch,
  AutomaticCreditEventScreen,
  AutomaticDocumentEvidence,
  AutomaticSourceSummary,
} from "@/types/riskLabAutomatic";
import type { VerifiedMaterialCreditEvent } from "@/types/riskLabDividendStress";

const PIPELINE = "risk-lab-credit-screen-v0.1.0";
const MAX_HTML_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_DOCUMENTS = 40;
const ALLOWED_HOSTS = new Set([
  "dados.cvm.gov.br",
  "fnet.bmfbovespa.com.br",
  "www.mauacapital.com.br",
  "mauacapital.com.br",
  "www.rbrasset.com.br",
  "rbrasset.com.br",
]);

const EVENT_PATTERNS: Array<{
  type: VerifiedMaterialCreditEvent["type"];
  terms: string[];
}> = [
  {
    type: "judicial_recovery",
    terms: ["RECUPERACAO JUDICIAL", "RECUPERACAO EXTRAJUDICIAL", "PEDIDO DE FALENCIA", "DECRETO DE FALENCIA"],
  },
  {
    type: "default",
    terms: ["INADIMPLENCIA", "VENCIMENTO ANTECIPADO", "NAO PAGAMENTO", "DEFAULT", "MORA MATERIAL", "CREDITO INADIMPLENTE"],
  },
  {
    type: "impairment",
    terms: ["IMPAIRMENT", "PROVISAO PARA PERDA", "PERDA ESPERADA", "AJUSTE AO VALOR RECUPERAVEL", "PERDA DE CREDITO"],
  },
  {
    type: "material_restructuring",
    terms: ["REESTRUTURACAO", "RENEGOCIACAO", "REPERFILAMENTO", "WAIVER DE COVENANT", "CARACTERISTICAS DA DIVIDA ALTERADAS"],
  },
];

const POTENTIALLY_RELEVANT = [
  "FATO RELEVANTE",
  "COMUNICADO AO MERCADO",
  "OUTROS COMUNICADOS",
  "RELATORIO GERENCIAL",
  "RELATORIO MENSAL",
  "RELATORIO DE RATING",
  "RELATORIO DE CLASSIFICACAO DE RISCO",
];

const CRITICAL_DOCUMENTS = [
  "FATO RELEVANTE",
  "COMUNICADO AO MERCADO",
  "OUTROS COMUNICADOS",
  "RELATORIO DE RATING",
  "RELATORIO DE CLASSIFICACAO DE RISCO",
];

const EXCLUDED_DOCUMENTS = [
  "RENDIMENTO",
  "AMORTIZACAO",
  "ASSEMBLEIA",
  "EDITAL",
  "ATA DE",
  "INFORME MENSAL",
  "INFORME TRIMESTRAL",
  "INFORME ANUAL",
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function textFromHtml(value: string) {
  return normalize(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;|&apos;/gi, "'"),
  );
}

function findEvent(value: string) {
  const normalized = normalize(value);
  for (const pattern of EVENT_PATTERNS) {
    const matchedTerm = pattern.terms.find((term) => normalized.includes(term));
    if (matchedTerm) return { type: pattern.type, matchedTerm };
  }
  return null;
}

function officialUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Fonte oficial não autorizada: ${parsed.hostname}`);
  }
  return parsed;
}

function documentText(document: AutomaticDocumentEvidence) {
  return normalize(`${document.documentType} ${document.fileName} ${document.auditResult || ""}`);
}

function isPotentiallyRelevant(document: AutomaticDocumentEvidence) {
  const text = documentText(document);
  if (EXCLUDED_DOCUMENTS.some((term) => text.includes(term))) return false;
  return POTENTIALLY_RELEVANT.some((term) => text.includes(term)) || Boolean(findEvent(text));
}

function isCriticalDocument(document: AutomaticDocumentEvidence) {
  const text = documentText(document);
  return Boolean(findEvent(text)) || CRITICAL_DOCUMENTS.some((term) => text.includes(term));
}

function inInterval(document: AutomaticDocumentEvidence, from: string, until: string) {
  const value = Date.parse(document.receivedAt);
  return Number.isFinite(value) && value >= Date.parse(from) && value <= Date.parse(until);
}

function civilYear(value: string) {
  const match = /^(\d{4})-/.exec(value);
  const year = match ? Number(match[1]) : Number.NaN;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Ano civil inválido na triagem de crédito: ${value}`);
  }
  return year;
}

function requiredYears(from: string, until: string) {
  const first = civilYear(from);
  const last = civilYear(until);
  const years: number[] = [];
  for (let year = first; year <= last; year += 1) years.push(year);
  return years;
}

async function fetchOfficialText(fetchImpl: typeof fetch, sourceUrl: string) {
  const url = officialUrl(sourceUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/pdf",
        "User-Agent": "DadosFII-RiskLab/0.2 (+automatic-credit-screen)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return { text: null, reason: `Formato ${contentType || "não informado"} ainda não possui extração textual determinística.` };
    }
    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      return { text: null, reason: "Documento HTML excede o limite seguro de 1 MB." };
    }
    return { text: textFromHtml(html), reason: null };
  } finally {
    clearTimeout(timeout);
  }
}

function matchToVerifiedEvent(
  ticker: string,
  document: AutomaticDocumentEvidence,
  match: AutomaticCreditEventMatch,
  reviewedAt: string,
): VerifiedMaterialCreditEvent {
  return {
    ticker,
    knownAt: document.receivedAt,
    type: match.eventType,
    documentId: document.documentId,
    sourceUrl: document.link,
    reviewedBy: PIPELINE,
    reviewedAt,
  };
}

function ambiguity(document: AutomaticDocumentEvidence, reason: string): AutomaticCreditAmbiguousDocument {
  return {
    documentId: document.documentId,
    documentType: document.documentType,
    fileName: document.fileName,
    receivedAt: document.receivedAt,
    sourceUrl: document.link,
    reason,
  };
}

export interface AutomaticCreditEventScreeningDependencies {
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export class AutomaticCreditEventScreeningService {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(dependencies: AutomaticCreditEventScreeningDependencies = {}) {
    this.fetchImpl = dependencies.fetchImpl || fetch;
    this.now = dependencies.now || (() => new Date());
  }

  async screen(
    ticker: string,
    documents: AutomaticDocumentEvidence[],
    sources: AutomaticSourceSummary[],
    relevantFrom: string,
    relevantUntil: string,
  ): Promise<AutomaticCreditEventScreen> {
    if (!Number.isFinite(Date.parse(relevantFrom)) || !Number.isFinite(Date.parse(relevantUntil))) {
      throw new Error("Intervalo de triagem de crédito inválido.");
    }
    if (Date.parse(relevantFrom) > Date.parse(relevantUntil)) {
      throw new Error("Início da triagem de crédito posterior ao fim.");
    }

    const reviewedAt = this.now().toISOString();
    const years = requiredYears(relevantFrom, relevantUntil);
    const sourceCoverageComplete = years.every((year) => sources.some((source) => source.year === year && source.fetched && Boolean(source.sourceHash)));
    const relevant = documents
      .filter((document) => inInterval(document, relevantFrom, relevantUntil) && isPotentiallyRelevant(document))
      .slice(0, MAX_DOCUMENTS);
    const matches: AutomaticCreditEventMatch[] = [];
    const verifiedEvents: VerifiedMaterialCreditEvent[] = [];
    const ambiguousDocuments: AutomaticCreditAmbiguousDocument[] = [];

    for (const document of relevant) {
      const critical = isCriticalDocument(document);
      try {
        officialUrl(document.link);
        const metadataMatch = findEvent(documentText(document));
        if (metadataMatch) {
          const match: AutomaticCreditEventMatch = {
            documentId: document.documentId,
            sourceUrl: document.link,
            knownAt: document.receivedAt,
            eventType: metadataMatch.type,
            matchedTerm: metadataMatch.matchedTerm,
            matchedIn: "metadata",
            confidence: 99,
          };
          matches.push(match);
          verifiedEvents.push(matchToVerifiedEvent(ticker, document, match, reviewedAt));
          continue;
        }

        const fetched = await fetchOfficialText(this.fetchImpl, document.link);
        if (!fetched.text) {
          if (critical) ambiguousDocuments.push(ambiguity(document, fetched.reason || "Conteúdo oficial crítico não pôde ser analisado automaticamente."));
          continue;
        }

        const bodyMatch = findEvent(fetched.text);
        if (!bodyMatch) {
          if (critical) ambiguousDocuments.push(ambiguity(document, "Documento crítico sem evento objetivo identificável pelas regras congeladas."));
          continue;
        }

        const match: AutomaticCreditEventMatch = {
          documentId: document.documentId,
          sourceUrl: document.link,
          knownAt: document.receivedAt,
          eventType: bodyMatch.type,
          matchedTerm: bodyMatch.matchedTerm,
          matchedIn: "official_html",
          confidence: 97,
        };
        matches.push(match);
        verifiedEvents.push(matchToVerifiedEvent(ticker, document, match, reviewedAt));
      } catch (error) {
        if (critical) {
          ambiguousDocuments.push(ambiguity(
            document,
            error instanceof Error ? error.message : "Falha desconhecida na triagem automática.",
          ));
        }
      }
    }

    const deduplicatedEvents = verifiedEvents.filter((event, index, all) =>
      all.findIndex((candidate) => candidate.documentId === event.documentId && candidate.type === event.type) === index,
    );

    if (deduplicatedEvents.length > 0) {
      return {
        status: "material_event_confirmed",
        relevantFrom,
        relevantUntil,
        inspectedDocuments: relevant.length,
        sourceCoverageComplete,
        matches,
        verifiedEvents: deduplicatedEvents,
        ambiguousDocuments,
        summary: `${deduplicatedEvents.length} evento(s) material(is) de crédito confirmado(s) automaticamente em fonte oficial.`,
        classificationFinal: true,
      };
    }

    if (!sourceCoverageComplete || ambiguousDocuments.length > 0) {
      return {
        status: "inconclusive",
        relevantFrom,
        relevantUntil,
        inspectedDocuments: relevant.length,
        sourceCoverageComplete,
        matches: [],
        verifiedEvents: [],
        ambiguousDocuments,
        summary: "A triagem automática não encontrou evento explícito, mas há lacuna de fonte ou documento crítico não analisado.",
        classificationFinal: false,
      };
    }

    return {
      status: "no_explicit_event_found",
      relevantFrom,
      relevantUntil,
      inspectedDocuments: relevant.length,
      sourceCoverageComplete,
      matches: [],
      verifiedEvents: [],
      ambiguousDocuments: [],
      summary: "Nenhum evento material explícito foi localizado nos metadados e documentos críticos oficiais do intervalo; isso não equivale a uma certificação de ausência, e relatórios genéricos sem termos objetivos não bloqueiam a triagem.",
      classificationFinal: false,
    };
  }
}

export const automaticCreditEventScreeningService = new AutomaticCreditEventScreeningService();
