import { writeFile } from "node:fs/promises";
import { AutomaticDividendSeriesService } from "../src/lib/risk-lab/AutomaticDividendSeriesService";
import { FnetDividendDocumentDiscovery } from "../src/lib/risk-lab/FnetDividendDocumentDiscovery";

const CNPJ = "16706958000132";
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
        "User-Agent": "DadosFII-RiskLab-Diagnostic/1.1",
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
    return { requestedUrl: url, error: errorRecord(error) };
  } finally {
    clearTimeout(timer);
  }
}

let result: Record<string, unknown> = {
  schemaVersion: 2,
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
  result = { ...result, stage: `${String(result.stage)}_failed`, error: errorRecord(error) };
}

await writeFile(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
