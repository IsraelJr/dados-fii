import { writeFile } from "node:fs/promises";

const ORIGIN = "https://fnet.bmfbovespa.com.br";
const CNPJ = "11026627000138";
const TIMEOUT_MS = 20_000;

function summarizeRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  return Object.fromEntries(Object.entries(record).slice(0, 40));
}

function rowsFrom(parsed) {
  if (Array.isArray(parsed?.data)) return parsed.data;
  if (Array.isArray(parsed?.aaData)) return parsed.aaData;
  if (Array.isArray(parsed?.rows)) return parsed.rows;
  return Array.isArray(parsed) ? parsed : [];
}

async function requestText(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      ...init,
      headers: {
        Accept: "application/json,text/plain;q=0.9,text/html;q=0.8,*/*;q=0.1",
        Referer: `${ORIGIN}/fnet/publico/pesquisarGerenciadorDocumentosCVM?paginaCertificados=false&tipoFundo=1`,
        "User-Agent": "DadosFII-RiskLab-Probe/1.1",
        "X-Requested-With": "XMLHttpRequest",
        ...(init.headers || {}),
      },
    });
    return { response, text: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

function parsePayload(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function summarize(name, method, url, response, text) {
  const parsed = parsePayload(text);
  const rows = rowsFrom(parsed);
  return {
    name,
    method,
    url: url.toString(),
    httpStatus: response.status,
    redirected: response.redirected,
    finalUrl: response.url,
    contentType: response.headers.get("content-type"),
    bodyBytes: Buffer.byteLength(text, "utf8"),
    parsed: parsed !== null,
    topLevelKeys: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed) : [],
    recordsTotal: parsed?.recordsTotal ?? parsed?.iTotalRecords ?? parsed?.total ?? null,
    recordsFiltered: parsed?.recordsFiltered ?? parsed?.iTotalDisplayRecords ?? null,
    rowCount: rows.length,
    firstRowKeys: rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0]) ? Object.keys(rows[0]) : [],
    sampleRows: rows.slice(0, 10).map(summarizeRecord),
    textSample: parsed === null ? text.slice(0, 2500) : null,
  };
}

const common = {
  paginaCertificados: "false",
  tipoFundo: "1",
  administrador: "",
  idFundo: "",
  cnpjFundo: CNPJ,
  idCategoriaDocumento: "0",
  idTipoDocumento: "0",
  idEspecieDocumento: "0",
  situacao: "0",
  dataReferencia: "",
  ultimaDataReferencia: "false",
  dataEntregaDe: "",
  dataEntregaAte: "",
  modalidadeEnvio: "0",
  palavraChave: "",
  d: "1",
  s: "0",
  l: "50",
  draw: "1",
  start: "0",
  length: "50",
};

async function probeGet(name, params) {
  const url = new URL("/fnet/publico/pesquisarGerenciadorDocumentosDados", ORIGIN);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const { response, text } = await requestText(url);
  return summarize(name, "GET", url, response, text);
}

async function probePost(name, params) {
  const url = new URL("/fnet/publico/pesquisarGerenciadorDocumentosDados", ORIGIN);
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) body.set(key, String(value));
  const { response, text } = await requestText(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
  });
  return summarize(name, "POST", url, response, text);
}

async function probeManagerHtml() {
  const url = new URL("/fnet/publico/pesquisarGerenciadorDocumentosCVM", ORIGIN);
  url.searchParams.set("paginaCertificados", "false");
  url.searchParams.set("tipoFundo", "1");
  url.searchParams.set("cnpjFundo", CNPJ);
  const { response, text } = await requestText(url, {
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  return {
    name: "manager_html",
    method: "GET",
    url: url.toString(),
    httpStatus: response.status,
    contentType: response.headers.get("content-type"),
    bodyBytes: Buffer.byteLength(text, "utf8"),
    scriptSources: [...text.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]).slice(-30),
    containsDataEndpoint: text.includes("pesquisarGerenciadorDocumentosDados"),
    endpointContext: text.includes("pesquisarGerenciadorDocumentosDados")
      ? text.slice(Math.max(0, text.indexOf("pesquisarGerenciadorDocumentosDados") - 1000), text.indexOf("pesquisarGerenciadorDocumentosDados") + 2500)
      : null,
  };
}

const probes = [];
for (const specification of [
  { name: "get_complete_contract", run: () => probeGet("get_complete_contract", common) },
  { name: "post_complete_contract", run: () => probePost("post_complete_contract", common) },
  { name: "get_legacy_category", run: () => probeGet("get_legacy_category", { ...common, idCategoriaDocumento: "6", idTipoDocumento: "45" }) },
  { name: "manager_html", run: probeManagerHtml },
]) {
  try {
    probes.push(await specification.run());
  } catch (error) {
    probes.push({
      name: specification.name,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
}

const result = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  source: "Fundos.NET público",
  cnpjProbe: CNPJ,
  probes,
};

await writeFile("fnet-discovery-probe.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));

if (!probes.some((item) => item.parsed && item.rowCount > 0)) process.exitCode = 1;
