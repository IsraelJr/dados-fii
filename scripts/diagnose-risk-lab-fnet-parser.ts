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
  };
}

async function request(url: URL, accept = "application/json,text/plain;q=0.9,*/*;q=0.1") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75_000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: accept,
        Referer: `${ORIGIN}/fnet/publico/abrirGerenciadorDocumentosCVM?paginaCertificados=false&tipoFundo=1`,
        "User-Agent": "Mozilla/5.0 (compatible; DadosFII-RiskLab-Diagnostic/1.7)",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    const text = await response.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* exposto no resultado */ }
    return {
      requestedUrl: url.toString(),
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
      json,
      textSample: json === null ? text.slice(0, 1000) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function payload(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function rows(value: unknown) {
  const record = payload(value);
  return Array.isArray(record.data) ? record.data as Record<string, unknown>[] : [];
}

function query(parameters: Record<string, string>) {
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
    l: "100",
    ...parameters,
  };
  for (const [key, value] of Object.entries(common)) url.searchParams.set(key, value);
  return url;
}

const result: Record<string, unknown> = {
  schemaVersion: 8,
  generatedAt: new Date().toISOString(),
  ticker: TICKER,
  cnpj: CNPJ,
  stage: "direct-filters",
};

try {
  const specs = [
    { name: "legacy_digits_category", params: { cnpjFundo: CNPJ, idCategoriaDocumento: "6", idTipoDocumento: "45" } },
    { name: "cnpjFundo_digits", params: { cnpjFundo: CNPJ } },
    { name: "cnpjFundo_formatted", params: { cnpjFundo: CNPJ_FORMATTED } },
    { name: "both_formatted", params: { cnpj: CNPJ_FORMATTED, cnpjFundo: CNPJ_FORMATTED } },
  ];
  const probes = await Promise.all(specs.map(async (spec) => {
    try {
      const response = await request(query(spec.params));
      const record = payload(response.json);
      const items = rows(response.json);
      return {
        name: spec.name,
        response: {
          requestedUrl: response.requestedUrl,
          httpStatus: response.httpStatus,
          contentType: response.contentType,
          recordsTotal: Number(record.recordsTotal ?? 0),
          recordsFiltered: Number(record.recordsFiltered ?? 0),
          rowCount: items.length,
          fundNames: [...new Set(items.map((item) => String(item.descricaoFundo || "")).filter(Boolean))].slice(0, 10),
          tradeNames: [...new Set(items.map((item) => String(item.nomePregao || "")).filter(Boolean))].slice(0, 10),
          textSample: response.textSample,
        },
        items,
      };
    } catch (error) {
      return { name: spec.name, error: errorRecord(error), items: [] as Record<string, unknown>[] };
    }
  }));

  result.probes = probes.map((probe) => ({ ...probe, items: undefined }));
  const selected = probes.find((probe) => {
    if (!("response" in probe) || probe.response.recordsFiltered < 1 || probe.response.recordsFiltered > 5_000) return false;
    return probe.items.every((item) => String(item.descricaoFundo || "").toUpperCase().includes("KINEA RENDIMENTOS"));
  });
  if (!selected) throw new Error("Nenhum filtro por CNPJ restringiu a consulta ao KNCR11 com paginação válida.");

  const documents = mapFnetDividendRows(selected.items, FROM, UNTIL);
  result.selectedFilter = selected.name;
  result.documentCountOnFirstPage = documents.length;
  result.latestDocuments = documents.slice(-4);
  if (!documents.length) throw new Error("O filtro correto não retornou avisos estruturados na primeira página.");

  const series = await new AutomaticDividendSeriesService().build(TICKER, documents.slice(-4));
  result.stage = "completed";
  result.series = {
    status: series.status,
    observationCount: series.observations.length,
    conflicts: series.conflicts,
    sources: series.sources,
    observations: series.observations,
  };
} catch (error) {
  result.stage = `${String(result.stage)}_failed`;
  result.error = errorRecord(error);
}

await writeFile(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
