import { writeFile } from "node:fs/promises";
import { AutomaticDividendSeriesService } from "../src/lib/risk-lab/AutomaticDividendSeriesService";
import { FnetDividendDocumentDiscovery } from "../src/lib/risk-lab/FnetDividendDocumentDiscovery";

const CNPJ = "16706958000132";
const TICKER = "KNCR11";
const FROM = "2022-01-01";
const UNTIL = "2025-12-31";
const ORIGIN = "https://fnet.bmfbovespa.com.br";

async function inspectUrl(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*;q=0.1",
        "User-Agent": "DadosFII-RiskLab-Diagnostic/1.0",
      },
    });
    const text = await response.text();
    return {
      requestedUrl: url,
      httpStatus: response.status,
      redirected: response.redirected,
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
      bytes: Buffer.byteLength(text, "utf8"),
      title: text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || null,
      bodySample: text.slice(0, 1200),
    };
  } catch (error) {
    return {
      requestedUrl: url,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

const discovery = await new FnetDividendDocumentDiscovery().discover(CNPJ, FROM, UNTIL);
const latest = discovery.documents.slice(-4);
const series = await new AutomaticDividendSeriesService().build(TICKER, latest);
const endpoints = [];
for (const document of latest.slice(-2)) {
  endpoints.push({
    documentId: document.documentId,
    notice: await inspectUrl(`${ORIGIN}/fnet/publico/exibirDocumento?cvm=true&id=${document.documentId}`),
    protocol: await inspectUrl(`${ORIGIN}/fnet/publico/visualizarProtocoloDocumentoCVM?idDocumento=${document.documentId}`),
  });
}

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  ticker: TICKER,
  cnpj: CNPJ,
  discovery: {
    internalFundId: discovery.internalFundId,
    recordsInspected: discovery.recordsInspected,
    documentCount: discovery.documents.length,
    sourceUrl: discovery.sourceUrl,
    latestDocuments: latest,
  },
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

await writeFile("risk-lab-fnet-parser-diagnostic.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
