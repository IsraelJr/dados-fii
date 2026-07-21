import { writeFile } from "node:fs/promises";

const ORIGIN = "https://fnet.bmfbovespa.com.br";
const CNPJ_DIGITS = "16706958000132";
const CNPJ_FORMATTED = "16.706.958/0001-32";
const INTERNAL_FUND_ID = "20031";
const TIMEOUT_MS = 30_000;

function rowsFrom(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.aaData)) return payload.aaData;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return Array.isArray(payload) ? payload : [];
}

async function fetchJson(name, overrides) {
  const parameters = {
    paginaCertificados: "false",
    tipoFundo: "1",
    administrador: "",
    idFundo: "",
    idCategoriaDocumento: "0",
    idTipoDocumento: "0",
    idEspecieDocumento: "0",
    situacao: "",
    cnpj: "",
    dataReferencia: "",
    ultimaDataReferencia: "false",
    dataInicial: "01/01/2022",
    dataFinal: "31/12/2025",
    idModalidade: "",
    palavraChave: "",
    d: "1",
    s: "0",
    l: "100",
    ...overrides,
  };
  const url = new URL("/fnet/publico/pesquisarGerenciadorDocumentosDados", ORIGIN);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, String(value));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json,text/plain;q=0.9,*/*;q=0.1",
        Referer: `${ORIGIN}/fnet/publico/pesquisarGerenciadorDocumentosCVM?paginaCertificados=false&tipoFundo=1`,
        "User-Agent": "DadosFII-RiskLab-Probe/1.3",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    const text = await response.text();
    let payload = null;
    try { payload = JSON.parse(text); } catch { /* diagnóstico abaixo */ }
    const rows = rowsFrom(payload);
    return {
      name,
      url: url.toString(),
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
      bodyBytes: Buffer.byteLength(text, "utf8"),
      parsed: payload !== null,
      topLevelKeys: payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload) : [],
      recordsTotal: payload?.recordsTotal ?? payload?.iTotalRecords ?? payload?.total ?? null,
      recordsFiltered: payload?.recordsFiltered ?? payload?.iTotalDisplayRecords ?? null,
      rowCount: rows.length,
      firstRowKeys: rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0]) ? Object.keys(rows[0]) : [],
      sampleRows: rows.slice(0, 15),
      textSample: payload === null ? text.slice(0, 3000) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

const specifications = [
  ["formatted_cnpj", { cnpj: CNPJ_FORMATTED }],
  ["digits_cnpj", { cnpj: CNPJ_DIGITS }],
  ["internal_fund_id", { idFundo: INTERNAL_FUND_ID }],
  ["fund_id_and_formatted_cnpj", { idFundo: INTERNAL_FUND_ID, cnpj: CNPJ_FORMATTED }],
];

const probes = [];
for (const [name, overrides] of specifications) {
  try {
    probes.push(await fetchJson(name, overrides));
  } catch (error) {
    probes.push({ name, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
  }
}

const result = {
  schemaVersion: 4,
  generatedAt: new Date().toISOString(),
  source: "Fundos.NET público",
  cnpjProbe: CNPJ_FORMATTED,
  internalFundIdProbe: INTERNAL_FUND_ID,
  probes,
};

await writeFile("fnet-discovery-probe.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!probes.some((item) => item.parsed && item.rowCount > 0)) process.exitCode = 1;
