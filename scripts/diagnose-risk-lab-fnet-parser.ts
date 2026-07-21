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

function structure(html: string) {
  const cells = [...html.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map((match) => clean(match[1]))
    .filter(Boolean);
  const inputValues = [...html.matchAll(/<(?:input|textarea|select)\b([^>]*)>/gi)]
    .map((match) => match[1])
    .map((attrs) => ({
      name: attrs.match(/\bname=["']([^"']*)["']/i)?.[1] || null,
      id: attrs.match(/\bid=["']([^"']*)["']/i)?.[1] || null,
      value: attrs.match(/\bvalue=["']([^"']*)["']/i)?.[1] || null,
      placeholder: attrs.match(/\bplaceholder=["']([^"']*)["']/i)?.[1] || null,
    }))
    .filter((item) => item.name || item.id || item.value);
  return {
    bytes: Buffer.byteLength(html, "utf8"),
    cells,
    inputValues: inputValues.slice(0, 250),
    visibleSample: clean(html).slice(0, 10000),
  };
}

async function fetchNotice() {
  const url = new URL("/fnet/publico/exibirDocumento", ORIGIN);
  url.searchParams.set("cvm", "true");
  url.searchParams.set("id", DOCUMENT_ID);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 75_000);
    try {
      const response = await fetch(url, {
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": `Mozilla/5.0 (compatible; DadosFII-RiskLab-Diagnostic/2.1; attempt-${attempt})`,
        },
      });
      if (!response.ok) throw new Error(`Fundos.NET respondeu HTTP ${response.status}.`);
      const html = await response.text();
      return {
        attempt,
        requestedUrl: url.toString(),
        finalUrl: response.url,
        contentType: response.headers.get("content-type"),
        structure: structure(html),
      };
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha desconhecida ao obter aviso.");
}

const result: Record<string, unknown> = {
  schemaVersion: 12,
  generatedAt: new Date().toISOString(),
  documentId: DOCUMENT_ID,
};

try {
  result.notice = await fetchNotice();
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
