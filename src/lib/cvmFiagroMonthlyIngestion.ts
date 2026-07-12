import { createHash } from "crypto";
import { unzipSync } from "fflate";
import { adminDb } from "@/lib/firebaseAdmin";
import { normalizeCnpj, parseDelimitedLine } from "@/lib/cvmIngestion";

const FIAGRO_MONTHLY_BASE = "https://dados.cvm.gov.br/dados/FIAGRO/DOC/INF_MENSAL/DADOS";
const FI_DAILY_BASE = "https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS";
const FIAGRO_MONTHLY_DATASET = "fiagro-doc-inf_mensal";
const FI_DAILY_DATASET = "fi-doc-inf_diario";

type CsvRow = Record<string, string>;
type Conflict = {
  field: string;
  kept: unknown;
  incoming: unknown;
  sourceFile: string;
};

type FiagroSnapshot = {
  ticker: string;
  cnpj: string;
  referenceDate: string;
  dailyReferenceDate?: string;
  fundName?: string;
  netWorth?: number;
  vpCota?: number;
  sharesOutstanding?: number;
  numberShareholders?: number;
  totalPortfolioValue?: number;
  delinquentCreditValue?: number;
  derivedFields: string[];
  conflicts: Conflict[];
  source: {
    dataset: string;
    url: string;
    urls?: string[];
    importedAt: string;
    files: string[];
    kinds: string[];
    fragmentCount: number;
  };
  rawFragments: Array<{
    sourceKind: string;
    sourceFile: string;
    sourceRowIndex: number;
    raw: CsvRow;
  }>;
};

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

function sourceKind(filename: string) {
  const normalized = normalizeKey(filename);
  if (normalized.includes("SUBCLASSE")) return "subclasse";
  if (normalized.includes("CLASSE")) return "classe";
  if (normalized.includes("GERAL")) return "geral";
  if (normalized.includes("COTA")) return "cota";
  if (normalized.includes("CARTEIRA")) return "carteira";
  return "fiagro_mensal";
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
      "CNPJ_SUBCLASSE",
      "CNPJ",
    ]));
    if (rowCnpj !== normalizedExpected) continue;
    rows.push({ row, rowIndex: index });
  }

  return rows;
}

function emptySnapshot(input: {
  ticker: string;
  cnpj: string;
  referenceDate: string;
  sourceUrl: string;
  sourceFile: string;
  sourceKind: string;
  sourceRowIndex: number;
  raw: CsvRow;
  dataset?: string;
}): FiagroSnapshot {
  return {
    ticker: input.ticker,
    cnpj: input.cnpj,
    referenceDate: input.referenceDate,
    derivedFields: [],
    conflicts: [],
    source: {
      dataset: input.dataset || FIAGRO_MONTHLY_DATASET,
      url: input.sourceUrl,
      urls: [input.sourceUrl],
      importedAt: new Date().toISOString(),
      files: [input.sourceFile],
      kinds: [input.sourceKind],
      fragmentCount: 1,
    },
    rawFragments: [{
      sourceKind: input.sourceKind,
      sourceFile: input.sourceFile,
      sourceRowIndex: input.sourceRowIndex,
      raw: input.raw,
    }],
  };
}

function buildFragment(input: {
  row: CsvRow;
  ticker: string;
  cnpj: string;
  sourceUrl: string;
  sourceFile: string;
  sourceRowIndex: number;
}): FiagroSnapshot | null {
  const referenceDate = normalizeReferenceDate(firstText(input.row, [
    "DT_COMPTC",
    "DT_REFERENCIA",
    "DATA_REFERENCIA",
    "COMPETENCIA",
  ]));
  if (!referenceDate) return null;

  const kind = sourceKind(input.sourceFile);
  const fragment = emptySnapshot({
    ticker: input.ticker,
    cnpj: input.cnpj,
    referenceDate,
    sourceUrl: input.sourceUrl,
    sourceFile: input.sourceFile,
    sourceKind: kind,
    sourceRowIndex: input.sourceRowIndex,
    raw: input.row,
  });

  fragment.fundName = firstText(input.row, [
    "DENOM_SOCIAL",
    "DENOM_CLASSE",
    "DENOM_SUBCLASSE",
    "DENOM_FUNDO",
    "NM_FUNDO",
    "NOME_FUNDO",
  ]);
  fragment.netWorth = firstNumber(input.row, [
    "VL_PATRIM_LIQ",
    "TAB_IV_A_VL_PL",
    "VL_PL",
    "PATRIMONIO_LIQUIDO",
  ]);
  fragment.vpCota = firstNumber(input.row, [
    "VL_QUOTA",
    "VL_COTA",
    "VL_PATRIM_COTA",
    "VL_QUOTA_SUBCLASSE",
  ]);
  fragment.sharesOutstanding = firstNumber(input.row, [
    "QT_COTAS",
    "QTD_COTAS",
    "NR_COTAS",
    "QT_COTAS_EMITIDAS",
    "QT_COTA",
  ]);
  fragment.numberShareholders = firstNumber(input.row, [
    "NR_COTST",
    "NR_COTISTAS",
    "QT_COTISTAS",
    "QT_COTST",
  ]);
  fragment.totalPortfolioValue = firstNumber(input.row, [
    "VL_TOTAL",
    "VL_CARTEIRA_TOTAL",
  ]);
  fragment.delinquentCreditValue = firstNumber(input.row, [
    "TAB_VI_B_VL_DIRCRED_INAD",
    "TAB_VI_B_VL_TOTAL",
    "TAB_VI_VL_TOTAL_INAD",
  ]);

  return fragment;
}

function buildDailyFragment(input: {
  row: CsvRow;
  ticker: string;
  cnpj: string;
  competenceDate: string;
  sourceUrl: string;
  sourceFile: string;
  sourceRowIndex: number;
}): FiagroSnapshot {
  const fragment = emptySnapshot({
    ticker: input.ticker,
    cnpj: input.cnpj,
    referenceDate: input.competenceDate,
    sourceUrl: input.sourceUrl,
    sourceFile: input.sourceFile,
    sourceKind: "fi_daily_month_end",
    sourceRowIndex: input.sourceRowIndex,
    raw: input.row,
    dataset: FI_DAILY_DATASET,
  });

  fragment.dailyReferenceDate = normalizeReferenceDate(firstText(input.row, ["DT_COMPTC"]));
  fragment.fundName = firstText(input.row, ["DENOM_SOCIAL", "DENOM_CLASSE", "NM_FUNDO"]);
  fragment.vpCota = firstNumber(input.row, ["VL_QUOTA", "VL_COTA"]);
  fragment.numberShareholders = firstNumber(input.row, ["NR_COTST", "NR_COTISTAS"]);
  fragment.totalPortfolioValue = firstNumber(input.row, ["VL_TOTAL", "VL_CARTEIRA_TOTAL"]);

  return fragment;
}

function valuesDiffer(left: unknown, right: unknown) {
  if (left === undefined || left === null || right === undefined || right === null) return false;
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) > Math.max(0.000001, Math.abs(left) * 0.000001);
  }
  return String(left) !== String(right);
}

function mergeSnapshots(current: FiagroSnapshot | undefined, incoming: FiagroSnapshot): FiagroSnapshot {
  if (!current) return incoming;

  const scalarFields: Array<keyof FiagroSnapshot> = [
    "fundName",
    "netWorth",
    "vpCota",
    "sharesOutstanding",
    "numberShareholders",
    "totalPortfolioValue",
    "delinquentCreditValue",
    "dailyReferenceDate",
  ];
  const currentUrls = current.source.urls || [current.source.url];
  const incomingUrls = incoming.source.urls || [incoming.source.url];
  const merged: FiagroSnapshot = {
    ...current,
    source: {
      ...current.source,
      url: current.source.url || incoming.source.url,
      urls: Array.from(new Set([...currentUrls, ...incomingUrls])),
      files: Array.from(new Set([...current.source.files, ...incoming.source.files])),
      kinds: Array.from(new Set([...current.source.kinds, ...incoming.source.kinds])),
      fragmentCount: current.source.fragmentCount + incoming.source.fragmentCount,
    },
    rawFragments: [...current.rawFragments, ...incoming.rawFragments],
    derivedFields: Array.from(new Set([...current.derivedFields, ...incoming.derivedFields])),
    conflicts: [...current.conflicts],
  };

  for (const field of scalarFields) {
    const existingValue = current[field];
    const incomingValue = incoming[field];
    if (valuesDiffer(existingValue, incomingValue)) {
      merged.conflicts.push({
        field: String(field),
        kept: existingValue,
        incoming: incomingValue,
        sourceFile: incoming.source.files[0] || "unknown",
      });
      continue;
    }
    if ((existingValue === undefined || existingValue === null || existingValue === "")
      && incomingValue !== undefined && incomingValue !== null && incomingValue !== "") {
      (merged as any)[field] = incomingValue;
    }
  }

  return merged;
}

function finalizeSnapshot(snapshot: FiagroSnapshot) {
  if (!snapshot.sharesOutstanding && snapshot.netWorth && snapshot.vpCota && snapshot.vpCota > 0) {
    snapshot.sharesOutstanding = snapshot.netWorth / snapshot.vpCota;
    snapshot.derivedFields = Array.from(new Set([...snapshot.derivedFields, "sharesOutstanding"]));
  }
  return snapshot;
}

function monthsForYear(year: number) {
  const now = new Date();
  if (year < now.getFullYear()) return Array.from({ length: 12 }, (_, index) => index + 1);
  if (year > now.getFullYear()) return [];
  return Array.from({ length: now.getMonth() + 1 }, (_, index) => index + 1);
}

async function enrichFromDailyReports(input: {
  ticker: string;
  cnpj: string;
  snapshotsByDate: Map<string, FiagroSnapshot>;
}) {
  const resourcesRead: string[] = [];
  const missingResources: string[] = [];
  const filesRead: string[] = [];
  let matchedRows = 0;
  let zipBytes = 0;

  const snapshots = [...input.snapshotsByDate.values()]
    .filter((snapshot) => !snapshot.vpCota || snapshot.numberShareholders === undefined)
    .sort((left, right) => left.referenceDate.localeCompare(right.referenceDate));

  for (const snapshot of snapshots) {
    const period = snapshot.referenceDate.slice(0, 7).replace("-", "");
    const sourceUrl = `${FI_DAILY_BASE}/inf_diario_fi_${period}.zip`;
    const response = await fetch(sourceUrl, { cache: "no-store" });

    if (response.status === 404) {
      missingResources.push(sourceUrl);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Falha ao baixar Informe Diário CVM ${period}: ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    zipBytes += bytes.byteLength;
    resourcesRead.push(sourceUrl);
    const files = unzipSync(bytes);
    const candidates: Array<{ row: CsvRow; rowIndex: number; filename: string; date: string }> = [];

    for (const [filename, content] of Object.entries(files)) {
      if (!/\.csv$/i.test(filename)) continue;
      filesRead.push(filename);
      const text = new TextDecoder("latin1").decode(content);
      const rows = parseRows(text, input.cnpj);
      matchedRows += rows.length;
      for (const item of rows) {
        const date = normalizeReferenceDate(firstText(item.row, ["DT_COMPTC"]));
        if (!date || !date.startsWith(snapshot.referenceDate.slice(0, 7))) continue;
        candidates.push({ ...item, filename, date });
      }
    }

    const latest = candidates.sort((left, right) => right.date.localeCompare(left.date))[0];
    if (!latest) continue;

    const dailyFragment = buildDailyFragment({
      row: latest.row,
      ticker: input.ticker,
      cnpj: input.cnpj,
      competenceDate: snapshot.referenceDate,
      sourceUrl,
      sourceFile: latest.filename,
      sourceRowIndex: latest.rowIndex,
    });
    input.snapshotsByDate.set(
      snapshot.referenceDate,
      mergeSnapshots(input.snapshotsByDate.get(snapshot.referenceDate), dailyFragment)
    );
  }

  return {
    resourcesRead,
    missingResources,
    filesRead: Array.from(new Set(filesRead)),
    matchedRows,
    zipBytes,
  };
}

export async function importFiagroMonthlyData(input: {
  runId: string;
  ticker: string;
  cnpj: string;
  year: number;
}) {
  const snapshotsByDate = new Map<string, FiagroSnapshot>();
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
        const fragment = buildFragment({
          row,
          ticker: input.ticker,
          cnpj: input.cnpj,
          sourceUrl,
          sourceFile: filename,
          sourceRowIndex: rowIndex,
        });
        if (!fragment) continue;
        snapshotsByDate.set(
          fragment.referenceDate,
          mergeSnapshots(snapshotsByDate.get(fragment.referenceDate), fragment)
        );
      }
    }
  }

  const daily = await enrichFromDailyReports({
    ticker: input.ticker,
    cnpj: input.cnpj,
    snapshotsByDate,
  });
  const snapshots = [...snapshotsByDate.values()]
    .map(finalizeSnapshot)
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
    dailyEnrichment: daily,
    snapshotsSaved: snapshots.length,
    referenceDates: snapshots.map((snapshot) => snapshot.referenceDate),
    conflictCount: snapshots.reduce((total, snapshot) => total + snapshot.conflicts.length, 0),
  };
}
