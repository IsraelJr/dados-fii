import { writeFile } from "node:fs/promises";
import { AutomaticDividendSeriesService } from "../src/lib/risk-lab/AutomaticDividendSeriesService";
import { mapFnetDividendRows } from "../src/lib/risk-lab/FnetDividendDocumentDiscovery";

const CNPJ = "16706958000132";
const CNPJ_FORMATTED = "16.706.958/0001-32";
const TICKER = "KNCR11";
const FROM = "2022-01-01";
const UNTIL = "2025-12-31";
const ORIGIN = "https://fnet.bmfbovespa.com.br";
const OUTPUT = "risk-lab-fnet-parser-diagnostic.json";

function errorRecord(error: unknown) {
  return {
    name: error instanceof Error ? error.name : null,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
    cause: error instanceof Error && error.cause ? String(error.cause) : null,
  };
}

async function request(url: URL, accept = "application/json,text/plain;q=0.9,*/*;q=0.1") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: accept,
        Referer: `${ORIGIN}/fnet/publico/abrirGerenciadorDocumentosCVM?paginaCertificados=false&tipoFundo=1`,
        "User-Agent": "DadosFII-RiskLab-Diagnostic/1.3",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    const text = await response.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* exposto no retorno */ }
    return {
      requestedUrl: url.toString(),
      httpStatus: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
      bytes: Buffer.byteLength(text, "utf8"),
      json,
      textSample: json === null ? text.slice(0, 2500) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function optionRows(payload: unknown): Array<{ id: string; text: string }> {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const values = Array.isArray(payload)
    ? payload
    : Array.isArray(record.results)
      ? record.results
      : Array.isArray(record.data)
        ? record.data
        : [];
  return values.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = String(row.id || row.value || "").trim();
    const text = String(row.text || row.label || row.nome || row.descricao || "").trim();
    return /^\d{1,12}$/.test(id) ? [{ id, text }] : [];
  });
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

async function inspectHtml(documentId: string, protocol = false) {
  const url = new URL(
    protocol ? "/fnet/publico/visualizarProtocoloDocumentoCVM" : "/fnet/publico/exibirDocumento",
    ORIGIN,
  );
  if (protocol) url.searchParams.set("idDocumento", documentId);
  else {
    url.searchParams.set("cvm", "true");
    url.searchParams.set("id", documentId);
  }
  return request(url, "text/html,application/xhtml+xml,*/*;q=0.1");
}

let result: Record<string, unknown> = {
  schemaVersion: 4,
  generatedAt: new Date().toISOString(),
  ticker: TICKER,
  cnpj: CNPJ,
  stage: "list-funds",
};

try {
  const searches = [];
  const options = new Map<string, { id: string; text: string }>();
  for (const term of [TICKER, CNPJ, CNPJ_FORMATTED]) {
    const url = new URL("/fnet/publico/listarFundos", ORIGIN);
    for (const [key, value] of Object.entries({
      term,
      page: "1",
      idTipoFundo: "1",
      idAdm: "0",
      paraCerts: "false",
    })) url.searchParams.set(key, value);
    const response = await request(url);
    const rows = optionRows(response.json);
    rows.forEach((row) => options.set(row.id, row));
    searches.push({ term, response, rows });
  }

  const candidates = [...options.values()];
  const selected = candidates.find((item) => normalize(item.text).includes(TICKER))
    || candidates.find((item) => item.text.replace(/\D/g, "").includes(CNPJ));
  if (!selected) throw new Error(`listarFundos não resolveu ${TICKER}/${CNPJ}; ${candidates.length} candidato(s).`);

  result = { ...result, stage: "documents", searches, candidates, selected };
  const url = new URL("/fnet/publico/pesquisarGerenciadorDocumentosDados", ORIGIN);
  const parameters = {
    paginaCertificados: "false",
    tipoFundo: "1",
    administrador: "",
    idFundo: selected.id,
    idCategoriaDocumento: "0",
    idTipoDocumento: "0",
    idEspecieDocumento: "0",
    situacao: "",
    cnpj: CNPJ_FORMATTED,
    cnpjFundo: CNPJ_FORMATTED,
    dataReferencia: "",
    ultimaDataReferencia: "false",
    dataInicial: "01/01/2022",
    dataFinal: "31/12/2025",
    idModalidade: "",
    palavraChave: "",
    paginaCertificadosFlag: "false",
    isSession: "false",
    d: "1",
    s: "0",
    l: "500",
  };
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const documentResponse = await request(url);
  const payload = documentResponse.json && typeof documentResponse.json === "object"
    ? documentResponse.json as Record<string, unknown>
    : {};
  const rows = Array.isArray(payload.data) ? payload.data as Record<string, unknown>[] : [];
  const documents = mapFnetDividendRows(rows, FROM, UNTIL);
  if (!documents.length) throw new Error(`Consulta filtrada retornou ${rows.length} linha(s), mas nenhum aviso de rendimento válido.`);

  const latest = documents.slice(-4);
  result = {
    ...result,
    stage: "series",
    documentResponse: {
      requestedUrl: documentResponse.requestedUrl,
      httpStatus: documentResponse.httpStatus,
      contentType: documentResponse.contentType,
      recordsTotal: payload.recordsTotal || null,
      recordsFiltered: payload.recordsFiltered || null,
      rowCount: rows.length,
    },
    documentCount: documents.length,
    latest,
  };

  const series = await new AutomaticDividendSeriesService().build(TICKER, latest);
  const endpoints = [];
  for (const document of latest.slice(-2)) {
    endpoints.push({
      documentId: document.documentId,
      notice: await inspectHtml(document.documentId),
      protocol: await inspectHtml(document.documentId, true),
    });
  }
  result = {
    ...result,
    stage: "completed",
    series: {
      status: series.status,
      observationCount: series.observations.length,
      longestContiguousSequence: series.longestContiguousSequence,
      conflicts: series.conflicts,
      sources: series.sources,
      observations: series.observations,
    },
    endpoints,
  };
} catch (error) {
  result = { ...result, stage: `${String(result.stage)}_failed`, error: errorRecord(error) };
}

await writeFile(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
