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
let sessionCookie = "";

function errorRecord(error: unknown) {
  return {
    name: error instanceof Error ? error.name : null,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
    cause: error instanceof Error && error.cause ? String(error.cause) : null,
  };
}

function cookieFrom(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [response.headers.get("set-cookie") || ""];
  return values
    .flatMap((value) => value.split(/,(?=[^;,]+=)/))
    .map((value) => value.split(";", 1)[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function request(
  url: URL,
  accept = "application/json,text/plain;q=0.9,*/*;q=0.1",
  timeoutMs = 75_000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: accept,
        Referer: `${ORIGIN}/fnet/publico/abrirGerenciadorDocumentosCVM?paginaCertificados=false&tipoFundo=1`,
        "User-Agent": "Mozilla/5.0 (compatible; DadosFII-RiskLab-Diagnostic/1.5)",
        "X-Requested-With": "XMLHttpRequest",
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      },
    });
    const discoveredCookie = cookieFrom(response);
    if (discoveredCookie) sessionCookie = discoveredCookie;
    const text = await response.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* diagnóstico abaixo */ }
    return {
      requestedUrl: url.toString(),
      httpStatus: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
      bytes: Buffer.byteLength(text, "utf8"),
      hasSessionCookie: Boolean(sessionCookie),
      json,
      textSample: json === null ? text.slice(0, 1800) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function payloadRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function rowsFrom(value: unknown) {
  const payload = payloadRecord(value);
  return Array.isArray(payload.data) ? payload.data as Record<string, unknown>[] : [];
}

function documentUrl(parameters: Record<string, string>) {
  const url = new URL("/fnet/publico/pesquisarGerenciadorDocumentosDados", ORIGIN);
  const common = {
    paginaCertificados: "false",
    tipoFundo: "1",
    administrador: "",
    idFundo: "",
    idCategoriaDocumento: "0",
    idTipoDocumento: "0",
    idEspecieDocumento: "0",
    situacao: "",
    dataReferencia: "",
    ultimaDataReferencia: "false",
    dataInicial: "01/01/2022",
    dataFinal: "31/12/2025",
    idModalidade: "",
    palavraChave: "",
    isSession: "false",
    d: "1",
    s: "0",
    l: "500",
    ...parameters,
  };
  for (const [key, value] of Object.entries(common)) url.searchParams.set(key, value);
  return url;
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
  return request(url, "text/html,application/xhtml+xml,*/*;q=0.1", 45_000);
}

let result: Record<string, unknown> = {
  schemaVersion: 6,
  generatedAt: new Date().toISOString(),
  ticker: TICKER,
  cnpj: CNPJ,
  stage: "bootstrap",
};

try {
  const manager = new URL("/fnet/publico/abrirGerenciadorDocumentosCVM", ORIGIN);
  manager.searchParams.set("paginaCertificados", "false");
  manager.searchParams.set("tipoFundo", "1");
  manager.searchParams.set("cnpjFundo", CNPJ_FORMATTED);
  let bootstrap: unknown = null;
  try {
    bootstrap = await request(manager, "text/html,application/xhtml+xml", 90_000);
  } catch (error) {
    bootstrap = { error: errorRecord(error) };
  }

  result = { ...result, stage: "direct-filters", bootstrap };
  const specifications = [
    { name: "cnpjFundo_digits", params: { cnpjFundo: CNPJ } },
    { name: "cnpjFundo_formatted", params: { cnpjFundo: CNPJ_FORMATTED } },
    { name: "both_formatted", params: { cnpj: CNPJ_FORMATTED, cnpjFundo: CNPJ_FORMATTED } },
    { name: "both_digits", params: { cnpj: CNPJ, cnpjFundo: CNPJ } },
    { name: "keyword_ticker", params: { cnpjFundo: CNPJ, palavraChave: TICKER } },
  ];
  const probes = await Promise.all(specifications.map(async (specification) => {
    try {
      const response = await request(documentUrl(specification.params), undefined, 90_000);
      const payload = payloadRecord(response.json);
      const rows = rowsFrom(response.json);
      const fundNames = [...new Set(rows.map((row) => String(row.descricaoFundo || "").trim()).filter(Boolean))];
      const tradeNames = [...new Set(rows.map((row) => String(row.nomePregao || "").trim()).filter(Boolean))];
      return {
        name: specification.name,
        response: {
          requestedUrl: response.requestedUrl,
          httpStatus: response.httpStatus,
          contentType: response.contentType,
          recordsTotal: Number(payload.recordsTotal ?? 0),
          recordsFiltered: Number(payload.recordsFiltered ?? 0),
          rowCount: rows.length,
          fundNames: fundNames.slice(0, 10),
          tradeNames: tradeNames.slice(0, 10),
        },
        rows,
      };
    } catch (error) {
      return { name: specification.name, error: errorRecord(error), rows: [] as Record<string, unknown>[] };
    }
  }));

  const selected = probes.find((probe) => {
    const response = "response" in probe ? probe.response : null;
    if (!response || response.recordsFiltered < 1 || response.recordsFiltered > 5_000) return false;
    return probe.rows.some((row) => {
      const searchable = `${row.nomePregao || ""} ${row.informacoesAdicionais || ""} ${row.descricaoFundo || ""}`.toUpperCase();
      return searchable.includes("KINEA RENDIMENTOS") || searchable.includes("FII KINEA RI");
    });
  });
  if (!selected) throw new Error("Nenhuma combinação direta de CNPJ restringiu a consulta ao KNCR11.");

  const documents = mapFnetDividendRows(selected.rows, FROM, UNTIL);
  if (!documents.length) throw new Error(`Filtro ${selected.name} retornou linhas do fundo, mas nenhum aviso estruturado válido.`);
  const latest = documents.slice(-4);
  result = {
    ...result,
    stage: "series",
    probes: probes.map((probe) => ({ ...probe, rows: undefined })),
    selectedFilter: selected.name,
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
