import type { AutomaticDocumentEvidence, AutomaticValidationIssue } from "@/types/riskLabAutomatic";

const OFFICIAL_HOST_SUFFIXES = ["cvm.gov.br", "bmfbovespa.com.br", "b3.com.br"];
const PRIORITY_TYPES = [
  "FATO RELEVANTE",
  "RELATORIO GERENCIAL",
  "DEMONSTRACOES CONTABEIS",
  "RELATORIO DE CLASSIFICACAO DE RISCO",
  "RELATORIO DE RATING",
  "AVISO AO MERCADO",
];

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function parseSemicolonRecord(record: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < record.length; index += 1) {
    const character = record[index];
    if (character === '"') {
      if (quoted && record[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ";" && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return { values, balanced: !quoted };
}

function parseDate(value: string, includeTime: boolean) {
  const normalized = value.trim();
  if (!normalized) return null;
  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (iso) {
    const [, year, month, day, hour, minute, second] = iso;
    if (!includeTime && !hour) return `${year}-${month}-${day}`;
    return `${year}-${month}-${day}T${hour || "00"}:${minute || "00"}:${second || "00"}-03:00`;
  }
  const br = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, day, month, year, hour, minute, second] = br;
    if (!includeTime && !hour) return `${year}-${month}-${day}`;
    return `${year}-${month}-${day}T${hour || "00"}:${minute || "00"}:${second || "00"}-03:00`;
  }
  return null;
}

function officialLink(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    return OFFICIAL_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

function headerIndex(headers: string[], names: string[]) {
  const normalized = headers.map(normalizeText);
  for (const name of names.map(normalizeText)) {
    const index = normalized.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
}

function field(values: string[], index: number) {
  return index >= 0 ? String(values[index] || "").trim() : "";
}

function priority(documentType: string) {
  const normalized = normalizeText(documentType);
  const index = PRIORITY_TYPES.findIndex((item) => normalized.includes(item));
  return index >= 0 ? index : PRIORITY_TYPES.length;
}

export interface CvmEventualParseResult {
  documents: AutomaticDocumentEvidence[];
  matchingRows: number;
  rejectedRows: number;
  issues: AutomaticValidationIssue[];
}

export function parseCvmEventualCsv(csv: string, expectedCnpj: string, year: number): CvmEventualParseResult {
  const records = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!records.length) {
    return { documents: [], matchingRows: 0, rejectedRows: 0, issues: [{ code: "empty_source", severity: "error", message: `Fonte CVM ${year} vazia.` }] };
  }

  const headers = parseSemicolonRecord(records[0]).values;
  const indexes = {
    cnpj: headerIndex(headers, ["CNPJ_FUNDO_CLASSE", "CNPJ_FUNDO"]),
    fundType: headerIndex(headers, ["TP_FUNDO_CLASSE", "TP_FUNDO"]),
    competence: headerIndex(headers, ["DT_COMPTC"]),
    received: headerIndex(headers, ["DT_RECEB"]),
    documentType: headerIndex(headers, ["TP_DOC"]),
    fileName: headerIndex(headers, ["NM_ARQ"]),
    documentId: headerIndex(headers, ["ID_DOC"]),
    link: headerIndex(headers, ["LINK_ARQ"]),
    audit: headerIndex(headers, ["RESULTADO_AUDITORIA"]),
  };
  const required = Object.entries(indexes).filter(([key, index]) => key !== "audit" && index < 0).map(([key]) => key);
  if (required.length) {
    return { documents: [], matchingRows: 0, rejectedRows: 0, issues: [{ code: "schema_mismatch", severity: "error", message: `Fonte CVM ${year} sem colunas obrigatórias: ${required.join(", ")}.` }] };
  }

  const expected = digits(expectedCnpj);
  const documents = new Map<string, AutomaticDocumentEvidence>();
  let matchingRows = 0;
  let rejectedRows = 0;

  for (const record of records.slice(1)) {
    const parsed = parseSemicolonRecord(record);
    if (!parsed.balanced) {
      rejectedRows += 1;
      continue;
    }
    const values = parsed.values;
    if (digits(field(values, indexes.cnpj)) !== expected) continue;
    matchingRows += 1;

    const fundType = normalizeText(field(values, indexes.fundType));
    const documentId = field(values, indexes.documentId);
    const documentType = field(values, indexes.documentType);
    const fileName = field(values, indexes.fileName);
    const link = field(values, indexes.link);
    const receivedAt = parseDate(field(values, indexes.received), true);
    const competenceDate = parseDate(field(values, indexes.competence), false);
    const auditResult = field(values, indexes.audit) || null;

    if ((fundType && !fundType.includes("FII")) || !/^\d{1,20}$/.test(documentId) || !documentType || !fileName || !receivedAt || !officialLink(link)) {
      rejectedRows += 1;
      continue;
    }

    documents.set(documentId, {
      documentId,
      documentType,
      fileName,
      competenceDate,
      receivedAt,
      link,
      sourceYear: year,
      auditResult,
      confidence: auditResult && /erro|reprov|inval/i.test(auditResult) ? 90 : 99,
    });
  }

  const issues: AutomaticValidationIssue[] = [];
  if (matchingRows > 0 && documents.size === 0) issues.push({ code: "all_rows_rejected", severity: "error", message: `Registros de ${year} foram encontrados, mas nenhum passou nas validações automáticas.` });
  if (rejectedRows > 0) issues.push({ code: "rejected_rows", severity: "warning", message: `${rejectedRows} registro(s) de ${year} foram descartados automaticamente.` });

  return {
    documents: Array.from(documents.values()).sort((a, b) => priority(a.documentType) - priority(b.documentType) || Date.parse(b.receivedAt) - Date.parse(a.receivedAt)),
    matchingRows,
    rejectedRows,
    issues,
  };
}
