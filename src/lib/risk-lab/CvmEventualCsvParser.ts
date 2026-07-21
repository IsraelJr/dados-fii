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

type RejectionReason =
  | "unbalanced_record"
  | "invalid_document_id"
  | "missing_document_type"
  | "invalid_received_at"
  | "invalid_official_link";

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

function validDate(value: string) {
  return Number.isFinite(Date.parse(value));
}

function normalizeTimezone(value: string) {
  if (value === "Z") return value;
  return value.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");
}

function parseDate(value: string, includeTime: boolean) {
  const normalized = value.trim();
  if (!normalized) return null;

  const iso = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/i,
  );
  if (iso) {
    const [, year, month, day, hour, minute, second, fraction, timezone] = iso;
    if (!includeTime && !hour) return `${year}-${month}-${day}`;
    const candidate = `${year}-${month}-${day}T${hour || "00"}:${minute || "00"}:${second || "00"}${fraction || ""}${timezone ? normalizeTimezone(timezone.toUpperCase()) : "-03:00"}`;
    return validDate(candidate) ? candidate : null;
  }

  const br = normalized.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?)?$/,
  );
  if (br) {
    const [, day, month, year, hour, minute, second, fraction] = br;
    if (!includeTime && !hour) return `${year}-${month}-${day}`;
    const candidate = `${year}-${month}-${day}T${hour || "00"}:${minute || "00"}:${second || "00"}${fraction || ""}-03:00`;
    return validDate(candidate) ? candidate : null;
  }

  return null;
}

function normalizeOfficialLink(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (!OFFICIAL_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))) {
      return null;
    }
    // Catálogos históricos ainda podem carregar HTTP, embora os hosts oficiais já
    // atendam em HTTPS. Persistimos somente a forma segura e canônica.
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeDocumentId(value: string, link: string | null) {
  const trimmed = value.trim();
  if (/^\d{1,20}$/.test(trimmed)) return trimmed;
  const decimal = trimmed.match(/^(\d{1,20})\.0+$/);
  if (decimal) return decimal[1];
  if (!link) return null;
  try {
    const url = new URL(link);
    const candidate = url.searchParams.get("id") || url.searchParams.get("idDocumento") || "";
    return /^\d{1,20}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function fileNameFromLink(link: string | null, documentId: string) {
  if (!link) return `documento-${documentId}`;
  try {
    const pathname = new URL(link).pathname;
    const name = pathname.split("/").filter(Boolean).at(-1);
    return name && name.includes(".") ? name : `documento-${documentId}`;
  } catch {
    return `documento-${documentId}`;
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

function rejectionIssue(reason: RejectionReason, count: number, year: number): AutomaticValidationIssue {
  const labels: Record<RejectionReason, string> = {
    unbalanced_record: "registro CSV com aspas desbalanceadas",
    invalid_document_id: "ID regulatório ausente ou inválido",
    missing_document_type: "tipo de documento ausente",
    invalid_received_at: "data de recebimento inválida",
    invalid_official_link: "link regulatório ausente ou fora dos hosts oficiais",
  };
  return {
    code: `rejected_${reason}`,
    severity: "warning",
    message: `${count} registro(s) de ${year} rejeitado(s): ${labels[reason]}.`,
  };
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
    // TP_FUNDO_CLASSE passou a representar fundo/classe/subclasse sob a RCVM 175.
    // O campo é mantido para compatibilidade de schema, mas o CNPJ resolvido no
    // catálogo do Dados FII é a identidade determinante do registro.
    fundType: headerIndex(headers, ["TP_FUNDO_CLASSE", "TP_FUNDO"]),
    competence: headerIndex(headers, ["DT_COMPTC"]),
    received: headerIndex(headers, ["DT_RECEB"]),
    documentType: headerIndex(headers, ["TP_DOC"]),
    fileName: headerIndex(headers, ["NM_ARQ"]),
    documentId: headerIndex(headers, ["ID_DOC"]),
    link: headerIndex(headers, ["LINK_ARQ"]),
    audit: headerIndex(headers, ["RESULTADO_AUDITORIA"]),
  };
  const required = Object.entries(indexes)
    .filter(([key, index]) => key !== "audit" && key !== "fundType" && index < 0)
    .map(([key]) => key);
  if (required.length) {
    return { documents: [], matchingRows: 0, rejectedRows: 0, issues: [{ code: "schema_mismatch", severity: "error", message: `Fonte CVM ${year} sem colunas obrigatórias: ${required.join(", ")}.` }] };
  }

  const expected = digits(expectedCnpj);
  const documents = new Map<string, AutomaticDocumentEvidence>();
  const rejectedByReason = new Map<RejectionReason, number>();
  let matchingRows = 0;
  let rejectedRows = 0;

  const reject = (reason: RejectionReason) => {
    rejectedRows += 1;
    rejectedByReason.set(reason, (rejectedByReason.get(reason) || 0) + 1);
  };

  for (const record of records.slice(1)) {
    const parsed = parseSemicolonRecord(record);
    if (!parsed.balanced) {
      reject("unbalanced_record");
      continue;
    }
    const values = parsed.values;
    if (digits(field(values, indexes.cnpj)) !== expected) continue;
    matchingRows += 1;

    const documentType = field(values, indexes.documentType);
    const normalizedLink = normalizeOfficialLink(field(values, indexes.link));
    const documentId = normalizeDocumentId(field(values, indexes.documentId), normalizedLink);
    const receivedAt = parseDate(field(values, indexes.received), true);
    const competenceDate = parseDate(field(values, indexes.competence), false);
    const auditResult = field(values, indexes.audit) || null;

    if (!documentId) {
      reject("invalid_document_id");
      continue;
    }
    if (!documentType) {
      reject("missing_document_type");
      continue;
    }
    if (!receivedAt) {
      reject("invalid_received_at");
      continue;
    }
    if (!normalizedLink) {
      reject("invalid_official_link");
      continue;
    }

    const fileName = field(values, indexes.fileName) || fileNameFromLink(normalizedLink, documentId);
    documents.set(documentId, {
      documentId,
      documentType,
      fileName,
      competenceDate,
      receivedAt,
      link: normalizedLink,
      sourceYear: year,
      auditResult,
      confidence: auditResult && /erro|reprov|inval/i.test(auditResult) ? 90 : 99,
    });
  }

  const issues: AutomaticValidationIssue[] = [];
  if (matchingRows > 0 && documents.size === 0) {
    const breakdown = [...rejectedByReason.entries()].map(([reason, count]) => `${reason}=${count}`).join(", ");
    issues.push({
      code: "all_rows_rejected",
      severity: "error",
      message: `Registros de ${year} foram encontrados, mas nenhum passou nas validações automáticas${breakdown ? ` (${breakdown})` : ""}.`,
    });
  }
  for (const [reason, count] of rejectedByReason) issues.push(rejectionIssue(reason, count, year));

  return {
    documents: Array.from(documents.values()).sort((a, b) => priority(a.documentType) - priority(b.documentType) || Date.parse(b.receivedAt) - Date.parse(a.receivedAt)),
    matchingRows,
    rejectedRows,
    issues,
  };
}
