import { writeFile } from "node:fs/promises";

const ORIGIN = "https://fnet.bmfbovespa.com.br";
const CNPJ = "16706958000132"; // KNCR11, fundo ativo com histórico estruturado público.
const TIMEOUT_MS = 20_000;

function summarizeRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  return Object.fromEntries(Object.entries(record).slice(0, 50));
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
        "User-Agent": "DadosFII-RiskLab-Probe/1.2",
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
  dataEntregaDe: "01/01/2022",
  dataEntregaAte: "31/12/2025",
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

function inputSnapshot(html) {
  return [...html.matchAll(/<input\b([^>]*)>/gi)].map((match) => {
    const attrs = match[1];
    const read = (name) => attrs.match(new RegExp(`${name}=["']([^"']*)["']`, "i"))?.[1] || null;
    return { id: read("id"), name: read("name"), value: read("value"), type: read("type") };
  }).filter((item) => item.id || item.name).slice(0, 80);
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
    inputs: inputSnapshot(text),
    cnpjContext: text.includes(CNPJ) ? text.slice(Math.max(0, text.indexOf(CNPJ) - 1000), text.indexOf(CNPJ) + 1500) : null,
  };
}

async function probeManagerScript() {
  const url = new URL("/fnet/resources/js/paginas/publico/gerenciador-documentos-cvm.js", ORIGIN);
  const { response, text } = await requestText(url, {
    headers: { Accept: "application/javascript,text/javascript,*/*;q=0.1" },
  });
  const needles = ["pesquisarGerenciadorDocumentosDados", "ajax", "cnpjFundo", "idFundo", "serverSide"];
  return {
    name: "manager_javascript",
    method: "GET",
    url: url.toString(),
    httpStatus: response.status,
    contentType: response.headers.get("content-type"),
    bodyBytes: Buffer.byteLength(text, "utf8"),
    contexts: Object.fromEntries(needles.map((needle) => {
      const index = text.indexOf(needle);
      return [needle, index >= 0 ? text.slice(Math.max(0, index - 1800), index + 4500) : null];
    })),
  };
}

const probes = [];
for (const specification of [
  { name: "manager_html", run: probeManagerHtml },
  { name: "manager_javascript", run: probeManagerScript },
  { name: "get_complete_contract", run: () => probeGet("get_complete_contract", common) },
  { name: "post_complete_contract", run: () => probePost("post_complete_contract", common) },
  { name: "get_legacy_category", run: () => probeGet("get_legacy_category", { ...common, idCategoriaDocumento: "6", idTipoDocumento: "45" }) },
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
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  source: "Fundos.NET público",
  cnpjProbe: CNPJ,
  probes,
};

await writeFile("fnet-discovery-probe.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));

if (!probes.some((item) => item.parsed && item.rowCount > 0)) process.exitCode = 1;
