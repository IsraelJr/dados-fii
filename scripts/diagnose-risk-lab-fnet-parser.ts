import { writeFile } from "node:fs/promises";
import { AutomaticDividendSeriesService } from "../src/lib/risk-lab/AutomaticDividendSeriesService";
import { FnetDividendDocumentDiscovery } from "../src/lib/risk-lab/FnetDividendDocumentDiscovery";

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

function attrs(source: string) {
  const values: Record<string, string> = {};
  for (const match of source.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) values[match[1].toLowerCase()] = match[2];
  return values;
}

async function fetchText(url: string, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/javascript,*/*;q=0.1",
        "User-Agent": "DadosFII-RiskLab-Diagnostic/1.2",
      },
    });
    return { response, text: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

async function inspectUrl(url: string) {
  try {
    const { response, text } = await fetchText(url, 30_000);
    return {
      requestedUrl: url,
      httpStatus: response.status,
      redirected: response.redirected,
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
      bytes: Buffer.byteLength(text, "utf8"),
      title: text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || null,
      bodySample: text.slice(0, 1600),
    };
  } catch (error) {
    return { requestedUrl: url, error: errorRecord(error) };
  }
}

async function inspectManager(url: string) {
  try {
    const { response, text } = await fetchText(url);
    const inputs = [...text.matchAll(/<input\b([^>]*)>/gi)].map((match) => attrs(match[1]));
    const numericHiddenIds = inputs
      .filter((item) => String(item.type || "").toLowerCase() === "hidden")
      .map((item) => item.id || "")
      .filter((id) => /^\d{2,12}$/.test(id));
    return {
      requestedUrl: url,
      httpStatus: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
      bytes: Buffer.byteLength(text, "utf8"),
      numericHiddenIds,
      inputs: inputs.map((item) => ({ id: item.id || null, name: item.name || null, value: item.value || null, type: item.type || null })).slice(0, 100),
      scriptSources: [...text.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]),
      containsCnpjDigits: text.includes(CNPJ),
      containsCnpjFormatted: text.includes(CNPJ_FORMATTED),
      bodySample: text.slice(0, 2200),
    };
  } catch (error) {
    return { requestedUrl: url, error: errorRecord(error) };
  }
}

async function inspectManagerScript() {
  const url = `${ORIGIN}/fnet/resources/js/paginas/publico/gerenciador-documentos-cvm.js`;
  try {
    const { response, text } = await fetchText(url, 90_000);
    const needles = ["idFundo", "cnpjFundo", "autocomplete", "pesquisarGerenciadorDocumentosDados", "listarFundo", "buscarFundo"];
    return {
      requestedUrl: url,
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
      bytes: Buffer.byteLength(text, "utf8"),
      contexts: Object.fromEntries(needles.map((needle) => {
        const index = text.indexOf(needle);
        return [needle, index >= 0 ? text.slice(Math.max(0, index - 1800), index + 4500) : null];
      })),
    };
  } catch (error) {
    return { requestedUrl: url, error: errorRecord(error) };
  }
}

let result: Record<string, unknown> = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  ticker: TICKER,
  cnpj: CNPJ,
  stage: "discovery",
};

try {
  const discovery = await new FnetDividendDocumentDiscovery().discover(CNPJ, FROM, UNTIL);
  const latest = discovery.documents.slice(-4);
  result = {
    ...result,
    stage: "series",
    discovery: {
      internalFundId: discovery.internalFundId,
      recordsInspected: discovery.recordsInspected,
      documentCount: discovery.documents.length,
      sourceUrl: discovery.sourceUrl,
      latestDocuments: latest,
    },
  };

  const series = await new AutomaticDividendSeriesService().build(TICKER, latest);
  const endpoints = [];
  for (const document of latest.slice(-2)) {
    endpoints.push({
      documentId: document.documentId,
      notice: await inspectUrl(`${ORIGIN}/fnet/publico/exibirDocumento?cvm=true&id=${document.documentId}`),
      protocol: await inspectUrl(`${ORIGIN}/fnet/publico/visualizarProtocoloDocumentoCVM?idDocumento=${document.documentId}`),
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
  const managerUrls = [
    `${ORIGIN}/fnet/publico/pesquisarGerenciadorDocumentosCVM?paginaCertificados=false&tipoFundo=1&cnpjFundo=${CNPJ}`,
    `${ORIGIN}/fnet/publico/pesquisarGerenciadorDocumentosCVM?paginaCertificados=false&tipoFundo=1&cnpjFundo=${encodeURIComponent(CNPJ_FORMATTED)}`,
    `${ORIGIN}/fnet/publico/abrirGerenciadorDocumentosCVM?paginaCertificados=false&tipoFundo=1&cnpjFundo=${CNPJ}`,
    `${ORIGIN}/fnet/publico/abrirGerenciadorDocumentosCVM?paginaCertificados=false&tipoFundo=1&cnpjFundo=${encodeURIComponent(CNPJ_FORMATTED)}`,
  ];
  result = {
    ...result,
    stage: `${String(result.stage)}_failed`,
    error: errorRecord(error),
    managerPages: await Promise.all(managerUrls.map(inspectManager)),
    managerScript: await inspectManagerScript(),
  };
}

await writeFile(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
