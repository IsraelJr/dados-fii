import { createHash } from "crypto";
import { unzipSync } from "fflate";
import { adminDb } from "@/lib/firebaseAdmin";
import { normalizeCnpj, parseDelimitedLine } from "@/lib/cvmIngestion";

const FIAGRO_MONTHLY_BASE = "https://dados.cvm.gov.br/dados/FIAGRO/DOC/INF_MENSAL/DADOS";
const FIAGRO_MONTHLY_DATASET = "fiagro-doc-inf_mensal";

type CsvRow = Record<string, string>;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function firstText(row: CsvRow, candidates: string[]) {
  const entries = Object.entries(row);
  const normalizedCandidates = candidates.map(normalizeKey);

  for (const candidate of normalizedCandidates) {
    const exact = entries.find(([key]) => normalizeKey(key) === candidate);
    const value = String(exact?.[1] || "").trim();
    if (value) return value;
  }

  for (const candidate of normalizedCandidates) {
    const partial = entries.find(([key]) => normalizeKey(key).includes(candidate));
    const value = String(partial?.[1] || "").trim();
    if (value) return value;
  }

  return undefined;
}

function numberOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const numeric = text.replace(/[^0-9,.-]/g, "");
  if (!numeric) return undefined;
  const normalized = numeric.includes(",")
    ? numeric.replace(/\./g, "").replace(",", ".")
    : numeric;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstNumber(row: CsvRow, candidates: string[]) {
  return numberOf(firstText(row, candidates));
}

function normalizeReferenceDate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const brazilian = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brazilian) return `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
}

function detectDelimiter(line: string) {
  return (line.match(/;/g) || []).length >= (line.match(/,/g) || []).length ? ";" : ",";
}

function parseRows(text: string, expectedCnpj: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [] as Array<{ row: CsvRow; rowIndex: number }>;

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter);
  const normalizedExpected = normalizeCnpj(expectedCnpj);
  const rows: Array<{ row: CsvRow; rowIndex: number }> = [];

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.replace(/\D/g, "").includes(normalizedExpected)) continue;
    const values = parseDelimitedLine(line, delimiter);
    const row = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
    const rowCnpj = normalizeCnpj(firstText(row, [
      "CNPJ_FUNDO_CLASSE",
      "CNPJ_FUNDO",
      "CNPJ_CLASSE",
      "CNPJ",
    ]));
    if (rowCnpj !== normalizedExpected) continue;
    rows.push({ row, rowIndex: index });
  }

  return rows;
}

function buildSnapshot(input: {
  row: CsvRow;
  ticker: string;
  cnpj: string;
  sourceUrl: string;
  sourceFile: string;
  sourceRowIndex: number;
}) {
  const referenceDate = normalizeReferenceDate(firstText(input.row, [
    "DT_COMPTC",
    "DT_REFERENCIA",
    "DATA_REFERENCIA",
    "COMPETENCIA",
  ]));
  if (!referenceDate) return null;

  const netWorth = firstNumber(input.row, [
    "VL_PATRIM_LIQ",
    "TAB_IV_A_VL_PL",
    "PATRIMONIO_LIQUIDO",
  ]);
  const vpCota = firstNumber(input.row, [
    "VL_QUOTA",
    "VL_COTA",
    "VL_PATRIM_COTA",
  ]);
  const reportedShares = firstNumber(input.row, [
    "QT_COTAS",
    "QTD_COTAS",
    "NR_COTAS",
    "QT_COTAS_EMITIDAS",
  ]);
  const derivedShares = netWorth && vpCota && vpCota > 0 ? netWorth / vpCota : undefined;
  const sharesOutstanding = reportedShares ?? derivedShares;

  return {
    ticker: input.ticker,
    cnpj: input.cnpj,
    referenceDate,
    fundName: firstText(input.row, [
      "DENOM_SOCIAL",
      "DENOM_CLASSE",
      "DENOM_FUNDO",
      "NM_FUNDO",
      "NOME_FUNDO",
    ]),
    netWorth,
    vpCota,
    sharesOutstanding,
    numberShareholders: firstNumber(input.row, [
      "NR_COTST",
      "NR_COTISTAS",
      "QT_COTISTAS",
    ]),
    totalPortfolioValue: firstNumber(input.row, [
      "VL_TOTAL",
      "VL_CARTEIRA_TOTAL",
    ]),
    delinquentCreditValue: firstNumber(input.row, [
      "TAB_VI_B_VL_DIRCRED_INAD",
      "TAB_VI_B_VL_TOTAL",
      "TAB_VI_VL_TOTAL_INAD",
    ]),
    derivedFields: reportedShares === undefined && derivedShares !== undefined
      ? ["sharesOutstanding"]
      : [],
    conflicts: [],
    source: {
      dataset: FIAGRO_MONTHLY_DATASET,
      url: input.sourceUrl,
      importedAt: new Date().toISOString(),
      files: [input.sourceFile],
      kinds: ["fiagro_mensal"],
      fragmentCount: 1,
    },
    rawFragments: [{
      sourceKind: "fiagro_mensal",
      sourceFile: input.sourceFile,
      sourceRowIndex: input.sourceRowIndex,
      raw: input.row,
    }],
  };
}

function monthsForYear(year: number) {
  const now = new Date();
  if (year < now.getFullYear()) return Array.from({ length: 12 }, (_, index) => index + 1);
  if (year > now.getFullYear()) return [];
  return Array.from({ length: now.getMonth() + 1 }, (_, index) => index + 1);
}

export async function importFiagroMonthlyData(input: {
  runId: string;
  ticker: string;
  cnpj: string;
  year: number;
}) {
  const snapshotsByDate = new Map<string, ReturnType<typeof buildSnapshot>>();
  const resourcesRead: string[] = [];
  const missingResources: string[] = [];
  const filesRead: string[] = [];
  let zipBytes = 0;
  let matchedRows = 0;

  for (const month of monthsForYear(input.year)) {
    const period = `${input.year}${String(month).padStart(2, "0")}`;
    const sourceUrl = `${FIAGRO_MONTHLY_BASE}/inf_mensal_fiagro_${period}.zip`;
    const response = await fetch(sourceUrl, { cache: "no-store" });

    if (response.status === 404) {
      missingResources.push(sourceUrl);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Falha ao baixar informe mensal FIAGRO ${period}: ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    zipBytes += bytes.byteLength;
    resourcesRead.push(sourceUrl);
    const files = unzipSync(bytes);

    for (const [filename, content] of Object.entries(files)) {
      if (!/\.csv$/i.test(filename)) continue;
      filesRead.push(filename);
      const text = new TextDecoder("latin1").decode(content);
      const rows = parseRows(text, input.cnpj);
      matchedRows += rows.length;

      for (const { row, rowIndex } of rows) {
        const snapshot = buildSnapshot({
          row,
          ticker: input.ticker,
          cnpj: input.cnpj,
          sourceUrl,
          sourceFile: filename,
          sourceRowIndex: rowIndex,
        });
        if (!snapshot) continue;
        snapshotsByDate.set(snapshot.referenceDate, snapshot);
      }
    }
  }

  const snapshots = [...snapshotsByDate.values()]
    .filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot))
    .sort((left, right) => left.referenceDate.localeCompare(right.referenceDate));
  const stagingCollection = adminDb
    .collection("FiiIngestionStaging")
    .doc(input.runId)
    .collection("MonthlySnapshots");

  let batch = adminDb.batch();
  let operations = 0;
  for (const snapshot of snapshots) {
    const id = sha256(`${input.ticker}:${snapshot.referenceDate}`).slice(0, 40);
    batch.set(
      stagingCollection.doc(id),
      { runId: input.runId, ...snapshot },
      { merge: false }
    );
    operations += 1;
    if (operations >= 400) {
      await batch.commit();
      batch = adminDb.batch();
      operations = 0;
    }
  }
  if (operations) await batch.commit();

  return {
    parserVersion: 2,
    fundType: "FIAGRO",
    dataset: FIAGRO_MONTHLY_DATASET,
    resourcesRead,
    missingResources,
    filesRead,
    zipBytes,
    matchedRows,
    snapshotsSaved: snapshots.length,
    referenceDates: snapshots.map((snapshot) => snapshot.referenceDate),
    conflictCount: 0,
  };
}
