import { writeFile } from "node:fs/promises";

const ORIGIN = "https://fnet.bmfbovespa.com.br";
const DOCUMENT_ID = "515681";
const OUTPUT = "risk-lab-fnet-parser-diagnostic.json";

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function clean(value: string) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extract(html: string) {
  const cells = [...html.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map((match) => clean(match[1]))
    .filter(Boolean);
  const labels = [...html.matchAll(/<(?:label|span|div|p|strong|b)\b[^>]*>([\s\S]*?)<\/(?:label|span|div|p|strong|b)>/gi)]
    .map((match) => clean(match[1]))
    .filter((value) => value && value.length <= 180)
    .filter((value, index, all) => all.indexOf(value) === index);
  const visible = clean(html);
  const contexts = ["Data da Informação", "Data de Referência", "Data-base", "Período de referência", "Código de negociação"]
    .map((needle) => {
      const index = visible.toLowerCase().indexOf(needle.toLowerCase());
      return { needle, context: index >= 0 ? visible.slice(Math.max(0, index - 250), index + 650) : null };
    });
  return {
    bytes: Buffer.byteLength(html, "utf8"),
    cells,
    labels: labels.slice(0, 250),
    contexts,
    visibleSample: visible.slice(0, 6000),
  };
}

async function fetchHtml(path: string, params: Record<string, string>) {
  const url = new URL(path, ORIGIN);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; DadosFII-RiskLab-Diagnostic/1.9)",
      },
    });
    return {
      requestedUrl: url.toString(),
      httpStatus: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
      structure: extract(await response.text()),
    };
  } finally {
    clearTimeout(timer);
  }
}

const result: Record<string, unknown> = {
  schemaVersion: 10,
  generatedAt: new Date().toISOString(),
  documentId: DOCUMENT_ID,
};

try {
  result.notice = await fetchHtml("/fnet/publico/exibirDocumento", { cvm: "true", id: DOCUMENT_ID });
  result.protocol = await fetchHtml("/fnet/publico/visualizarProtocoloDocumentoCVM", { idDocumento: DOCUMENT_ID });
  result.status = "completed";
} catch (error) {
  result.status = "failed";
  result.error = {
    name: error instanceof Error ? error.name : null,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  };
}

await writeFile(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
