import { createHash } from "crypto";
import { unzipSync } from "fflate";
import { adminDb } from "@/lib/firebaseAdmin";
import { normalizeCnpj, parseDelimitedLine } from "@/lib/cvmIngestion";
import {
  firstFiagroValue,
  mapFiagroMonthlyRow,
  normalizeFiagroFieldKey,
} from "@/lib/fiagroFieldMapping";

const FIAGRO_MONTHLY_BASE = "https://dados.cvm.gov.br/dados/FIAGRO/DOC/INF_MENSAL/DADOS";
const FIAGRO_MONTHLY_DATASET = "fiagro-doc-inf_mensal";

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

function detectDelimiter(line: string) {
  return (line.match(/;/g) || []).length >= (line.match(/,/g) || []).length ? ";" : ",";
}

function sourceKind(filename: string) {
  const normalized = normalizeFiagroFieldKey(filename);
  if (normalized.includes("SUBCLASSE")) return "subclasse";
  if (normalized.includes("CLASSE")) return "classe";
  return "fiagro_mensal";
}

function cnpjFromRow(row: CsvRow) {
  return normalizeCnpj(firstFiagroValue(row, [
    "CNPJ_Classe",
    "CNPJ_FUNDO_CLASSE",
    "CNPJ_FUNDO",
    "CNPJ_CLASSE",
    "CNPJ_SUBCLASSE",
    "CNPJ",
  ]));
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
    if (cnpjFromRow(row) !== normalizedExpected) continue;
    rows.push({ row, rowIndex: index });
  }

  return rows;
}

function buildFragment(input: {
  row: CsvRow;
  ticker: string;
  cnpj: string;
  sourceUrl: string;
  sourceFile: string;
  sourceRowIndex: number;
}): FiagroSnapshot | null {
  const mapped = mapFiagroMonthlyRow(input.row);
  if (!mapped.referenceDate) return null;
  const kind = sourceKind(input.sourceFile);

  return {
    ticker: input.ticker,
    cnpj: input.cnpj,
    referenceDate: mapped.referenceDate,
    fundName: mapped.fundName,
    netWorth: mapped.netWorth,
    vpCota: mapped.vpCota,
    sharesOutstanding: mapped.sharesOutstanding,
    numberShareholders: mapped.numberShareholders,
    totalPortfolioValue: mapped.totalPortfolioValue,
    delinquentCreditValue: mapped.delinquentCreditValue,
    derivedFields: [],
    conflicts: [],
    source: {
      dataset: FIAGRO_MONTHLY_DATASET,
      url: input.sourceUrl,
      importedAt: new Date().toISOString(),
      files: [input.sourceFile],
      kinds: [kind],
      fragmentCount: 1,
    },
    rawFragments: [{
      sourceKind: kind,
      sourceFile: input.sourceFile,
      sourceRowIndex: input.sourceRowIndex,
      raw: input.row,
    }],
  };
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
  ];
  const merged: FiagroSnapshot = {
    ...current,
    source: {
      ...current.source,
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
      (merged as Record<string, unknown>)[String(field)] = incomingValue;
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

function orderedCsvFiles(files: Record<string, Uint8Array>) {
  return Object.entries(files)
    .filter(([filename]) => /\.csv$/i.test(filename))
    .sort(([left], [right]) => {
      const leftSub = normalizeFiagroFieldKey(left).includes("SUBCLASSE") ? 1 : 0;
      const rightSub = normalizeFiagroFieldKey(right).includes("SUBCLASSE") ? 1 : 0;
      return leftSub - rightSub || left.localeCompare(right);
    });
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

    for (const [filename, content] of orderedCsvFiles(files)) {
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
    adapterId: "cvm-fiagro-v2",
    dataset: FIAGRO_MONTHLY_DATASET,
    resourcesRead,
    missingResources,
    filesRead: Array.from(new Set(filesRead)),
    zipBytes,
    matchedRows,
    snapshotsSaved: snapshots.length,
    referenceDates: snapshots.map((snapshot) => snapshot.referenceDate),
    conflictCount: snapshots.reduce((total, snapshot) => total + snapshot.conflicts.length, 0),
  };
}
