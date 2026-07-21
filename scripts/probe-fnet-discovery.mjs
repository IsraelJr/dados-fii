import { writeFile } from "node:fs/promises";

const ORIGIN = "https://fnet.bmfbovespa.com.br";
const CNPJ = "11026627000138";

function summarizeRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  return Object.fromEntries(Object.entries(record).slice(0, 30));
}

async function probe(name, params) {
  const url = new URL("/fnet/publico/pesquisarGerenciadorDocumentosDados", ORIGIN);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept: "application/json,text/plain;q=0.9,*/*;q=0.1",
      "User-Agent": "DadosFII-RiskLab-Probe/1.0",
    },
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // A amostra textual abaixo permite diagnosticar mudança de contrato sem ocultar a resposta.
  }
  const rows = Array.isArray(parsed?.data)
    ? parsed.data
    : Array.isArray(parsed?.aaData)
      ? parsed.aaData
      : Array.isArray(parsed)
        ? parsed
        : [];
  return {
    name,
    url: url.toString(),
    httpStatus: response.status,
    contentType: response.headers.get("content-type"),
    bodyBytes: Buffer.byteLength(text, "utf8"),
    parsed: parsed !== null,
    topLevelKeys: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed) : [],
    recordsTotal: parsed?.recordsTotal ?? parsed?.iTotalRecords ?? null,
    recordsFiltered: parsed?.recordsFiltered ?? parsed?.iTotalDisplayRecords ?? null,
    rowCount: rows.length,
    firstRowKeys: rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0]) ? Object.keys(rows[0]) : [],
    sampleRows: rows.slice(0, 10).map(summarizeRecord),
    textSample: parsed === null ? text.slice(0, 1500) : null,
  };
}

const probes = [];
for (const specification of [
  {
    name: "all_documents",
    params: { d: 0, s: 0, l: 50, cnpjFundo: CNPJ, idCategoriaDocumento: 0, idTipoDocumento: 0 },
  },
  {
    name: "legacy_category_6_type_45",
    params: { d: 0, s: 0, l: 50, cnpjFundo: CNPJ, idCategoriaDocumento: 6, idTipoDocumento: 45 },
  },
]) {
  try {
    probes.push(await probe(specification.name, specification.params));
  } catch (error) {
    probes.push({
      name: specification.name,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
}

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: "Fundos.NET público",
  cnpjProbe: CNPJ,
  probes,
};

await writeFile("fnet-discovery-probe.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));

if (!probes.some((item) => item.parsed && item.rowCount > 0)) {
  process.exitCode = 1;
}
