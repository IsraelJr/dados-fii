import { createHash } from "crypto";
import { strFromU8, unzipSync } from "fflate";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

const CVM_CKAN_BASE = "https://dados.cvm.gov.br/api/3/action/package_show?id=";
const MONTHLY_DATASET = "fii-doc-inf_mensal";
const EVENTUAL_DATASET = "fi-doc-eventual";
const DEFAULT_DOCUMENT_LIMIT = 30;

export type FiiIngestionInput = {
  runId: string;
  ticker: string;
  cnpj?: string;
  year?: number;
  delayMinutes?: number;
};

export type CvmResource = {
  name?: string;
  description?: string;
  format?: string;
  url: string;
  last_modified?: string | null;
};

type CvmDatasetResponse = {
  success?: boolean;
  result?: {
    metadata_modified?: string;
    resources?: CvmResource[];
  };
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeTicker(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeCnpj(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 14 ? digits : "";
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function removeUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => removeUndefined(item)) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [key, removeUndefined(fieldValue)])
    ) as T;
  }
  return value;
}

function numberOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const numeric = text.replace(/[^0-9,.-]/g, "");
  if (!numeric) return undefined;
  const normalized = numeric.includes(",")
    ? numeric.replace(/\./g, "").replace(",", ".")
    : numeric;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstText(row: Record<string, string>, candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeKey);
  for (const [key, raw] of Object.entries(row)) {
    const normalized = normalizeKey(key);
    if (!normalizedCandidates.some((candidate) => normalized === candidate || normalized.includes(candidate))) continue;
    const value = String(raw || "").trim();
    if (value) return value;
  }
  return undefined;
}

function firstNumber(row: Record<string, string>, candidates: string[]) {
  const value = firstText(row, candidates);
  return numberOf(value);
}

function detectDelimiter(line: string) {
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

export function parseDelimitedLine(line: string, delimiter: string) {
  const fields: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      fields.push(field);
      field = "";
      continue;
    }

    field += char;
  }

  fields.push(field);
  return fields.map((value) => value.trim());
}

function rowFromLine(headers: string[], line: string, delimiter: string) {
  const values = parseDelimitedLine(line, delimiter);
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
}

function rowsFromDelimitedText(text: string, cnpj: string, maxRows = 500) {
  const normalizedCnpj = normalizeCnpj(cnpj);
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter);
  const rows: Record<string, string>[] = [];

  for (let index = 1; index < lines.length && rows.length < maxRows; index += 1) {
    const line = lines[index];
    if (!line.replace(/\D/g, "").includes(normalizedCnpj)) continue;
    rows.push(rowFromLine(headers, line, delimiter));
  }

  return rows;
}

async function rowsFromCsvResponse(response: Response, cnpj: string, maxRows = DEFAULT_DOCUMENT_LIMIT) {
  if (!response.body) return rowsFromDelimitedText(await response.text(), cnpj, maxRows);

  const normalizedCnpj = normalizeCnpj(cnpj);
  const reader = response.body.getReader();
  const decoder = new TextDecoder("latin1");
  let buffer = "";
  let headers: string[] = [];
  let delimiter = ";";
  const rows: Record<string, string>[] = [];

  while (rows.length < maxRows) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.replace(/^\uFEFF/, "");
      if (!line) continue;
      if (!headers.length) {
        delimiter = detectDelimiter(line);
        headers = parseDelimitedLine(line, delimiter);
        continue;
      }
      if (!line.replace(/\D/g, "").includes(normalizedCnpj)) continue;
      rows.push(rowFromLine(headers, line, delimiter));
      if (rows.length >= maxRows) break;
    }

    if (done) break;
  }

  if (rows.length >= maxRows) await reader.cancel().catch(() => undefined);
  return rows;
}

export async function discoverCvmResource(datasetId: string, year: number, format?: "ZIP" | "CSV") {
  const response = await fetch(`${CVM_CKAN_BASE}${encodeURIComponent(datasetId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Falha ao consultar catálogo CVM (${datasetId}): ${response.status}`);
  const payload = await response.json() as CvmDatasetResponse;
  if (!payload?.success) throw new Error(`Catálogo CVM indisponível para ${datasetId}.`);

  const resources = Array.isArray(payload.result?.resources) ? payload.result?.resources : [];
  const resource = resources.find((item) => {
    const name = `${item.name || ""} ${item.description || ""} ${item.url || ""}`;
    const matchesYear = name.includes(String(year));
    const matchesFormat = format ? String(item.format || "").toUpperCase() === format : true;
    return matchesYear && matchesFormat && /^https:\/\//i.test(item.url || "");
  });

  if (!resource?.url) throw new Error(`Recurso ${datasetId}/${year} não encontrado no catálogo CVM.`);
  return { resource, metadataModified: payload.result?.metadata_modified || null };
}

export async function resolvePilotCnpj(ticker: string, provided?: string) {
  const direct = normalizeCnpj(provided);
  if (direct) return direct;

  const normalizedTicker = normalizeTicker(ticker);
  const collection = adminDb.collection("Fiis");
  const directDoc = await collection.doc(normalizedTicker).get();
  const directData = directDoc.data() || {};
  const fromDirect = normalizeCnpj(directData.cnpj || directData.CNPJ || directData.cnpjFundo || directData.cnpj_fundo);
  if (fromDirect) return fromDirect;

  const query = await collection.where("code", "==", normalizedTicker).limit(1).get();
  const queryData = query.docs[0]?.data() || {};
  const fromQuery = normalizeCnpj(queryData.cnpj || queryData.CNPJ || queryData.cnpjFundo || queryData.cnpj_fundo);
  if (fromQuery) return fromQuery;

  const environmentFallback = normalizeCnpj(process.env.TGAR11_CNPJ);
  if (normalizedTicker === "TGAR11" && environmentFallback) return environmentFallback;

  throw new Error(`CNPJ não encontrado para ${normalizedTicker}. Informe no disparo, no documento Fiis/${normalizedTicker} ou em TGAR11_CNPJ.`);
}

function buildMonthlySnapshot(row: Record<string, string>, sourceUrl: string) {
  const referenceDate = firstText(row, ["DT_COMPTC", "DT_REFER", "DT_REFERENCIA", "DATA_REFERENCIA", "COMPETENCIA"]);
  const netWorth = firstNumber(row, ["VL_PATRIM_LIQ", "VL_PATRIMONIO_LIQUIDO", "PATRIMONIOLIQUIDO"]);
  const shares = firstNumber(row, ["NR_COTAS_EMITIDAS", "QT_COTAS_EMITIDAS", "QTD_COTAS", "COTASEMITIDAS"]);
  const shareholders = firstNumber(row, ["NR_COTISTAS", "QT_COTISTAS", "NUMEROCOTISTAS"]);
  const vpCota = firstNumber(row, ["VL_COTA", "VL_PATRIM_COTA", "VALORPATRIMONIALPORCOTA"])
    ?? (netWorth && shares ? netWorth / shares : undefined);

  return removeUndefined({
    referenceDate,
    cnpj: normalizeCnpj(firstText(row, ["CNPJ_FUNDO_CLASSE", "CNPJ_FUNDO", "CNPJ"])),
    fundName: firstText(row, ["DENOM_SOCIAL", "DENOMINACAO_SOCIAL", "NM_FUNDO", "NOME_FUNDO"]),
    netWorth,
    sharesOutstanding: shares,
    numberShareholders: shareholders,
    vpCota,
    cash: firstNumber(row, ["DISPONIBILIDADES", "VL_DISPONIBILIDADES", "CAIXA"]),
    receivables: firstNumber(row, ["CONTAS_RECEBER", "VL_CONTAS_RECEBER"]),
    obligations: firstNumber(row, ["OBRIGACOES", "VL_OBRIGACOES", "PASSIVO"]),
    source: {
      dataset: MONTHLY_DATASET,
      url: sourceUrl,
      importedAt: new Date().toISOString(),
    },
    raw: row,
  });
}

function buildDocument(row: Record<string, string>, sourceUrl: string) {
  const documentUrl = firstText(row, ["LINK_ARQ", "LINK_DOC", "URL_DOC", "URL", "LINK_DOWNLOAD"]);
  return removeUndefined({
    cnpj: normalizeCnpj(firstText(row, ["CNPJ_FUNDO_CLASSE", "CNPJ_FUNDO", "CNPJ"])),
    fundName: firstText(row, ["DENOM_SOCIAL", "DENOMINACAO_SOCIAL", "NM_FUNDO", "NOME_FUNDO"]),
    documentType: firstText(row, ["TP_DOC", "TIPO_DOC", "CATEG_DOC", "CATEGORIA_DOC"]),
    documentName: firstText(row, ["NM_DOC", "NOME_DOC", "ASSUNTO", "ESPECIE"]),
    referenceDate: firstText(row, ["DT_REFER", "DT_REFERENCIA", "DATA_REFERENCIA"]),
    deliveryDate: firstText(row, ["DT_ENTREGA", "DATA_ENTREGA", "DT_RECEB"]),
    version: firstText(row, ["VERSAO", "VERSAO_DOC"]),
    documentUrl,
    source: {
      dataset: EVENTUAL_DATASET,
      url: sourceUrl,
      importedAt: new Date().toISOString(),
    },
    raw: row,
  });
}

export async function importMonthlyCvmData(input: { runId: string; ticker: string; cnpj: string; year: number }) {
  const { resource, metadataModified } = await discoverCvmResource(MONTHLY_DATASET, input.year, "ZIP");
  const response = await fetch(resource.url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Falha ao baixar informe mensal CVM: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const files = unzipSync(bytes);
  const snapshots: ReturnType<typeof buildMonthlySnapshot>[] = [];
  const filesRead: string[] = [];

  for (const [filename, content] of Object.entries(files)) {
    if (!/\.csv$/i.test(filename)) continue;
    filesRead.push(filename);
    const text = strFromU8(content);
    const rows = rowsFromDelimitedText(text, input.cnpj, 1000);
    rows.forEach((row) => snapshots.push(buildMonthlySnapshot(row, resource.url)));
  }

  const unique = new Map<string, ReturnType<typeof buildMonthlySnapshot>>();
  snapshots.forEach((snapshot, index) => {
    const key = `${snapshot.referenceDate || "unknown"}:${index}`;
    unique.set(key, snapshot);
  });

  const stagingCollection = adminDb.collection("FiiIngestionStaging").doc(input.runId).collection("MonthlySnapshots");
  let batch = adminDb.batch();
  let operations = 0;
  for (const [key, snapshot] of unique.entries()) {
    const id = sha256(`${input.ticker}:${key}`).slice(0, 40);
    batch.set(stagingCollection.doc(id), { ticker: input.ticker, runId: input.runId, ...snapshot }, { merge: true });
    operations += 1;
    if (operations >= 400) {
      await batch.commit();
      batch = adminDb.batch();
      operations = 0;
    }
  }
  if (operations) await batch.commit();

  return {
    dataset: MONTHLY_DATASET,
    resourceUrl: resource.url,
    resourceName: resource.name || null,
    metadataModified,
    zipBytes: bytes.byteLength,
    filesRead,
    matchedRows: snapshots.length,
    snapshotsSaved: unique.size,
  };
}

export async function importEventualDocuments(input: { runId: string; ticker: string; cnpj: string; year: number; limit?: number }) {
  const { resource, metadataModified } = await discoverCvmResource(EVENTUAL_DATASET, input.year, "CSV");
  const response = await fetch(resource.url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Falha ao baixar catálogo de documentos CVM: ${response.status}`);
  const rows = await rowsFromCsvResponse(response, input.cnpj, input.limit || DEFAULT_DOCUMENT_LIMIT);
  const documents = rows.map((row) => buildDocument(row, resource.url));
  const collection = adminDb.collection("FiiIngestionStaging").doc(input.runId).collection("Documents");
  const batch = adminDb.batch();
  documents.forEach((document, index) => {
    const id = sha256(`${input.ticker}:${document.documentUrl || document.deliveryDate || index}`).slice(0, 40);
    batch.set(collection.doc(id), { ticker: input.ticker, runId: input.runId, ...document }, { merge: true });
  });
  if (documents.length) await batch.commit();

  return {
    dataset: EVENTUAL_DATASET,
    resourceUrl: resource.url,
    resourceName: resource.name || null,
    metadataModified,
    matchedRows: rows.length,
    documentsSaved: documents.length,
    documents: documents.map((document) => ({
      documentType: document.documentType || null,
      documentName: document.documentName || null,
      referenceDate: document.referenceDate || null,
      deliveryDate: document.deliveryDate || null,
      documentUrl: document.documentUrl || null,
    })),
  };
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const texts = payload?.output
    ?.flatMap((item: any) => item?.content || [])
    ?.map((content: any) => content?.text)
    ?.filter(Boolean);
  return Array.isArray(texts) ? texts.join("\n") : "";
}

export async function extractPilotInsights(input: { runId: string; ticker: string; documents: Array<Record<string, unknown>> }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { status: "skipped", reason: "OPENAI_API_KEY ausente" };

  const documentLines = input.documents
    .filter((document) => document.documentUrl)
    .slice(0, 8)
    .map((document, index) => `${index + 1}. ${document.documentType || document.documentName || "Documento"}: ${document.documentUrl}`)
    .join("\n");

  if (!documentLines) return { status: "skipped", reason: "Nenhum documento oficial com URL encontrado" };

  const prompt = `
Você é um extrator de dados de fundos imobiliários brasileiros.
Analise somente fontes oficiais e os documentos listados para ${input.ticker}.
Use busca web para abrir ou localizar versões oficiais acessíveis desses documentos.
Não invente valores. Quando não encontrar, use null e explique em warnings.

Documentos:
${documentLines}

Retorne somente JSON válido com este formato:
{
  "ticker": "${input.ticker}",
  "summary": "resumo objetivo do que foi possível extrair",
  "dividendSustainability": {
    "currentResultPerShare": null,
    "currentDividendPerShare": null,
    "coverageRatio": null,
    "reserves": null,
    "notes": []
  },
  "development": {
    "projects": [],
    "sales": null,
    "inventory": null,
    "receivables": null,
    "remainingInvestment": null
  },
  "credit": {
    "operations": [],
    "delinquencies": [],
    "renegotiations": []
  },
  "risks": [],
  "managementComments": [],
  "warnings": [],
  "sourceUrls": []
}
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt,
      temperature: 0.1,
      tools: [{ type: "web_search", search_context_size: "high" }],
      tool_choice: "required",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha na extração por IA: ${response.status} ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  const parsed = safeJsonParse(extractOutputText(payload));
  if (!parsed) throw new Error("A extração por IA não retornou JSON válido.");

  await adminDb.collection("FiiIngestionStaging").doc(input.runId).set({
    aiExtraction: parsed,
    aiExtractionUpdatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });

  return { status: "completed", extraction: parsed };
}

export async function validatePilotRun(input: { runId: string; ticker: string; cnpj: string; monthly: any; documents: any; ai: any }) {
  const latestSnapshots = await adminDb
    .collection("FiiIngestionStaging")
    .doc(input.runId)
    .collection("MonthlySnapshots")
    .limit(1000)
    .get();

  const snapshots = latestSnapshots.docs.map((doc) => doc.data());
  const fieldNames = ["referenceDate", "netWorth", "sharesOutstanding", "numberShareholders", "vpCota"];
  const coverage = Object.fromEntries(fieldNames.map((field) => [
    field,
    snapshots.length ? Number(((snapshots.filter((item) => item[field] !== undefined && item[field] !== null).length / snapshots.length) * 100).toFixed(1)) : 0,
  ]));
  const warnings: string[] = [];
  if (!snapshots.length) warnings.push("Nenhum registro mensal foi encontrado para o CNPJ informado.");
  if (!input.documents?.documentsSaved) warnings.push("Nenhum documento eventual foi indexado.");
  if (input.ai?.status !== "completed") warnings.push(`Extração por IA não concluída: ${input.ai?.reason || input.ai?.status || "desconhecido"}.`);

  const result = {
    ticker: input.ticker,
    cnpj: input.cnpj,
    readyForReview: snapshots.length > 0,
    publishToOfficialBase: false,
    monthlyRows: snapshots.length,
    documents: Number(input.documents?.documentsSaved || 0),
    coverage,
    warnings,
  };

  await adminDb.collection("FiiIngestionStaging").doc(input.runId).set({
    runId: input.runId,
    ticker: input.ticker,
    cnpj: input.cnpj,
    validation: result,
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });

  return result;
}
