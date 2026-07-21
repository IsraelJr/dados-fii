import { writeFile } from "node:fs/promises";
import { AutomaticDividendSeriesService } from "../src/lib/risk-lab/AutomaticDividendSeriesService";
import { mapFnetDividendRows } from "../src/lib/risk-lab/FnetDividendDocumentDiscovery";

const CNPJ = "16706958000132";
const TICKER = "KNCR11";
const ORIGIN = "https://fnet.bmfbovespa.com.br";
const OUTPUT = "risk-lab-fnet-parser-diagnostic.json";

function errorRecord(error: unknown) {
  return {
    name: error instanceof Error ? error.name : null,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  };
}

async function fetchJson(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75_000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json,text/plain;q=0.9,*/*;q=0.1",
        Referer: `${ORIGIN}/fnet/publico/abrirGerenciadorDocumentosCVM?paginaCertificados=false&tipoFundo=1`,
        "User-Agent": "Mozilla/5.0 (compatible; DadosFII-RiskLab-Diagnostic/2.0)",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    if (!response.ok) throw new Error(`Fundos.NET respondeu HTTP ${response.status}.`);
    return JSON.parse(await response.text()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

const result: Record<string, unknown> = {
  schemaVersion: 11,
  generatedAt: new Date().toISOString(),
  ticker: TICKER,
  cnpj: CNPJ,
  stage: "collection",
};

try {
  const url = new URL("/fnet/publico/pesquisarGerenciadorDocumentosDados", ORIGIN);
  const parameters = {
    paginaCertificados: "false",
    tipoFundo: "1",
    administrador: "",
    idFundo: "",
    idCategoriaDocumento: "0",
    idTipoDocumento: "0",
    idEspecieDocumento: "0",
    situacao: "",
    cnpj: "16.706.958/0001-32",
    cnpjFundo: CNPJ,
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
  };
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const payload = await fetchJson(url);
  const rows = Array.isArray(payload.data) ? payload.data as Record<string, unknown>[] : [];
  const documents = mapFnetDividendRows(rows, "2022-01-01", "2025-12-31");
  const selected = documents.slice(-4);
  if (selected.length !== 4) throw new Error(`A primeira página trouxe somente ${selected.length} aviso(s) estruturado(s).`);

  result.stage = "parser";
  result.collection = {
    recordsTotal: payload.recordsTotal || null,
    recordsFiltered: payload.recordsFiltered || null,
    rowCount: rows.length,
    structuredDocumentCount: documents.length,
    selected,
  };

  const series = await new AutomaticDividendSeriesService().build(TICKER, selected);
  result.stage = "completed";
  result.series = {
    status: series.status,
    observationCount: series.observations.length,
    longestContiguousSequence: series.longestContiguousSequence,
    conflicts: series.conflicts,
    sources: series.sources,
    observations: series.observations,
  };
  if (series.observations.length !== 4) {
    throw new Error(`O parser validou ${series.observations.length}/4 avisos reais.`);
  }
} catch (error) {
  result.stage = `${String(result.stage)}_failed`;
  result.error = errorRecord(error);
}

await writeFile(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
