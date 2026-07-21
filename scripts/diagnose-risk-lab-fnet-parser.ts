import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CNPJ = "16706958000132";
const YEAR = 2023;
const OUTPUT = "risk-lab-fnet-parser-diagnostic.json";
const DATA_URL = `https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_${YEAR}.zip`;
const META_URL = "https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/META/meta_inf_mensal_fii.zip";

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function parseDelimitedLine(line: string, delimiter = ";") {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current);
      current = "";
    } else current += char;
  }
  values.push(current);
  return values;
}

async function fetchBinary(url: string) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(url, {
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/zip,application/octet-stream,*/*;q=0.1",
          "User-Agent": `DadosFII-RiskLab-CVM-Bulk-Diagnostic/1.0 attempt-${attempt}`,
        },
      });
      if (!response.ok) throw new Error(`CVM respondeu HTTP ${response.status} para ${url}.`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 100) throw new Error(`ZIP CVM vazio ou incompleto: ${url}.`);
      return {
        buffer,
        contentType: response.headers.get("content-type"),
        finalUrl: response.url,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Falha desconhecida ao obter ${url}.`);
}

async function extractZip(buffer: Buffer, prefix: string) {
  const root = await mkdtemp(join(tmpdir(), `${prefix}-`));
  const zipPath = join(root, `${prefix}.zip`);
  const extractPath = join(root, "files");
  await writeFile(zipPath, buffer);
  execFileSync("mkdir", ["-p", extractPath]);
  execFileSync("unzip", ["-q", zipPath, "-d", extractPath], { timeout: 60_000 });
  const files = (await readdir(extractPath, { recursive: true }))
    .map((entry) => String(entry))
    .filter((entry) => /\.(csv|txt)$/i.test(entry));
  return { root, extractPath, files };
}

function interestingHeader(header: string[]) {
  return header.filter((column) => /REND|DISTR|PROVENT|COTA|PAG|AMORT|RESULT/i.test(normalize(column)));
}

async function inspectDataFile(path: string, name: string) {
  const raw = await readFile(path);
  const text = new TextDecoder("windows-1252").decode(raw).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseDelimitedLine(lines[0] || "");
  const cnpjIndexes = header
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => /CNPJ/i.test(column));
  const matchingRows = lines.slice(1).flatMap((line) => {
    if (!line.replace(/\D/g, "").includes(CNPJ)) return [];
    const values = parseDelimitedLine(line);
    const exactCnpj = cnpjIndexes.some(({ index }) => String(values[index] || "").replace(/\D/g, "") === CNPJ);
    if (!exactCnpj) return [];
    return [Object.fromEntries(header.map((column, index) => [column, values[index] ?? ""]))];
  });
  const interesting = interestingHeader(header);
  return {
    name,
    bytes: raw.length,
    sourceHash: sha256(raw),
    rowCount: Math.max(0, lines.length - 1),
    header,
    interestingColumns: interesting,
    matchingRowCount: matchingRows.length,
    matchingRows: matchingRows.slice(0, 24).map((row) => Object.fromEntries(
      Object.entries(row).filter(([key, value]) =>
        interesting.includes(key)
        || /CNPJ|DT_COMPTC|DATA|DENOM|NOME|TICKER/i.test(key)
        || Boolean(String(value).match(/KNCR11/i)),
      ),
    )),
  };
}

async function inspectMetaFile(path: string, name: string) {
  const raw = await readFile(path);
  const text = new TextDecoder("windows-1252").decode(raw).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter(Boolean);
  return {
    name,
    bytes: raw.length,
    sourceHash: sha256(raw),
    matchingLines: lines
      .filter((line) => /REND|DISTR|PROVENT|COTA|PAG|AMORT|RESULT/i.test(normalize(line)))
      .slice(0, 250),
    firstLines: lines.slice(0, 20),
  };
}

const result: Record<string, unknown> = {
  schemaVersion: 15,
  generatedAt: new Date().toISOString(),
  source: "CVM Informe Mensal Estruturado em lote",
  cnpj: CNPJ,
  year: YEAR,
  stage: "download",
};

const roots: string[] = [];
try {
  const [dataDownload, metaDownload] = await Promise.all([
    fetchBinary(DATA_URL),
    fetchBinary(META_URL),
  ]);
  result.downloads = {
    data: {
      url: DATA_URL,
      finalUrl: dataDownload.finalUrl,
      contentType: dataDownload.contentType,
      bytes: dataDownload.buffer.length,
      sourceHash: sha256(dataDownload.buffer),
    },
    metadata: {
      url: META_URL,
      finalUrl: metaDownload.finalUrl,
      contentType: metaDownload.contentType,
      bytes: metaDownload.buffer.length,
      sourceHash: sha256(metaDownload.buffer),
    },
  };

  result.stage = "extract";
  const [dataZip, metaZip] = await Promise.all([
    extractZip(dataDownload.buffer, `inf-mensal-${YEAR}`),
    extractZip(metaDownload.buffer, "meta-inf-mensal"),
  ]);
  roots.push(dataZip.root, metaZip.root);

  result.stage = "inspect";
  const dataFiles = [];
  for (const name of dataZip.files) {
    dataFiles.push(await inspectDataFile(join(dataZip.extractPath, name), name));
  }
  const metaFiles = [];
  for (const name of metaZip.files) {
    metaFiles.push(await inspectMetaFile(join(metaZip.extractPath, name), name));
  }
  result.dataFiles = dataFiles;
  result.metadataFiles = metaFiles;
  result.candidateFiles = dataFiles
    .filter((file) => file.matchingRowCount > 0 && file.interestingColumns.length > 0)
    .map((file) => ({
      name: file.name,
      matchingRowCount: file.matchingRowCount,
      interestingColumns: file.interestingColumns,
    }));
  result.stage = "completed";
} catch (error) {
  result.stage = `${String(result.stage)}_failed`;
  result.error = {
    name: error instanceof Error ? error.name : null,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  };
} finally {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }).catch(() => undefined)));
}

await writeFile(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
