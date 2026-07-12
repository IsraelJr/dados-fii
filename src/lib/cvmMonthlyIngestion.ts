import { createHash } from "crypto";
import { unzipSync } from "fflate";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { discoverCvmResource, normalizeCnpj } from "@/lib/cvmIngestion";

const MONTHLY_DATASET = "fii-doc-inf_mensal";
const ESSENTIAL_FIELDS = [
  "referenceDate",
  "netWorth",
  "sharesOutstanding",
  "numberShareholders",
  "vpCota",
] as const;

type MonthlyKind = "geral" | "complemento" | "ativo_passivo";
type CsvRow = Record<string, string>;

type MonthlyFragment = Record<string, any> & {
  referenceDate: string;
  cnpj: string;
  sourceKind: MonthlyKind;
  sourceFile: string;
  sourceRowIndex: number;
  version?: number;
  raw: CsvRow;
};

type FieldConflict = {
  field: string;
  values: Array<{ value: unknown; sourceKind: MonthlyKind; sourceFile: string }>;
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

function parseDelimitedLine(line: string, delimiter: string) {
  const fields: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      fields.push(field);
      field = "";
      continue;
    }
    field += char;
  }

  fields.push(field);
  return fields.map((value) => value.trim());
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
    const rowCnpj = normalizeCnpj(firstText(row, ["CNPJ_Fundo_Classe", "CNPJ_FUNDO_CLASSE", "CNPJ_Fundo", "CNPJ"]));
    if (rowCnpj !== normalizedExpected) continue;
    rows.push({ row, rowIndex: index });
  }

  return rows;
}

function classifyFile(filename: string): MonthlyKind | null {
  const lower = filename.toLowerCase();
  if (!lower.endsWith(".csv")) return null;
  if (lower.includes("inf_mensal_fii_geral")) return "geral";
  if (lower.includes("inf_mensal_fii_complemento")) return "complemento";
  if (lower.includes("inf_mensal_fii_ativo_passivo")) return "ativo_passivo";
  return null;
}

function buildFragment(
  row: CsvRow,
  sourceKind: MonthlyKind,
  sourceFile: string,
  sourceRowIndex: number
): MonthlyFragment | null {
  const referenceDate = normalizeReferenceDate(firstText(row, [
    "Data_Referencia",
    "DT_COMPTC",
    "DT_REFERENCIA",
    "DATA_REFERENCIA",
  ]));
  const cnpj = normalizeCnpj(firstText(row, [
    "CNPJ_Fundo_Classe",
    "CNPJ_FUNDO_CLASSE",
    "CNPJ_Fundo",
    "CNPJ",
  ]));
  if (!referenceDate || !cnpj) return null;

  const netWorth = firstNumber(row, ["Patrimonio_Liquido", "VL_PATRIM_LIQ", "VL_PATRIMONIO_LIQUIDO"]);
  const sharesOutstanding = firstNumber(row, [
    "Cotas_Emitidas",
    "Quantidade_Cotas_Emitidas",
    "NR_COTAS_EMITIDAS",
    "QT_COTAS_EMITIDAS",
  ]);
  const numberShareholders = firstNumber(row, [
    "Total_Numero_Cotistas",
    "NR_COTISTAS",
    "QT_COTISTAS",
    "NUMERO_COTISTAS",
  ]);
  const directVpCota = firstNumber(row, [
    "Valor_Patrimonial_Cotas",
    "VL_PATRIM_COTA",
    "VL_COTA",
    "VALOR_PATRIMONIAL_POR_COTA",
  ]);

  return {
    referenceDate,
    cnpj,
    sourceKind,
    sourceFile,
    sourceRowIndex,
    version: firstNumber(row, ["Versao", "VERSAO"]),
    fundName: firstText(row, ["Nome_Fundo_Classe", "DENOM_SOCIAL", "DENOMINACAO_SOCIAL", "NOME_FUNDO"]),
    isin: firstText(row, ["Codigo_ISIN", "ISIN"]),
    segment: firstText(row, ["Segmento_Atuacao", "SEGMENTO"]),
    mandate: firstText(row, ["Mandato"]),
    netWorth,
    sharesOutstanding,
    numberShareholders,
    vpCota: directVpCota ?? (netWorth && sharesOutstanding ? netWorth / sharesOutstanding : undefined),
    dividendYieldMonth: firstNumber(row, ["Percentual_Dividend_Yield_Mes"]),
    effectiveReturnMonth: firstNumber(row, ["Percentual_Rentabilidade_Efetiva_Mes"]),
    patrimonialReturnMonth: firstNumber(row, ["Percentual_Rentabilidade_Patrimonial_Mes"]),
    administrationExpensePct: firstNumber(row, ["Percentual_Despesas_Taxa_Administracao"]),
    cash: firstNumber(row, ["Disponibilidades", "VL_DISPONIBILIDADES", "CAIXA"]),
    receivables: firstNumber(row, ["Contas_Receber_Aluguel", "Contas_Receber", "VL_CONTAS_RECEBER"]),
    incomeToDistribute: firstNumber(row, ["Rendimentos_Distribuir"]),
    cri: firstNumber(row, ["CRI"]),
    lci: firstNumber(row, ["LCI"]),
    finishedIncomeProperties: firstNumber(row, ["Imoveis_Renda_Acabados"]),
    incomePropertiesUnderConstruction: firstNumber(row, ["Imoveis_Renda_Construcao"]),
    raw: row,
  };
}

function versionRank(value: unknown) {
  return numberOf(value) ?? 0;
}

function sameValue(left: unknown, right: unknown) {
  if (typeof left === "number" && typeof right === "number") {
    const tolerance = Math.max(0.000001, Math.max(Math.abs(left), Math.abs(right)) * 0.000001);
    return Math.abs(left - right) <= tolerance;
  }
  return String(left) === String(right);
}

function chooseValue(
  fragments: MonthlyFragment[],
  field: string,
  priorities: MonthlyKind[],
  conflicts: FieldConflict[]
) {
  const candidates = fragments
    .filter((fragment) => fragment[field] !== undefined && fragment[field] !== null && fragment[field] !== "")
    .sort((left, right) => priorities.indexOf(left.sourceKind) - priorities.indexOf(right.sourceKind));
  if (!candidates.length) return undefined;

  const distinct = candidates.filter((candidate, index) =>
    candidates.findIndex((other) => sameValue(other[field], candidate[field])) === index
  );
  if (distinct.length > 1) {
    conflicts.push({
      field,
      values: distinct.map((fragment) => ({
        value: fragment[field],
        sourceKind: fragment.sourceKind,
        sourceFile: fragment.sourceFile,
      })),
    });
  }
  return candidates[0][field];
}

export function consolidateMonthlyFragments(fragments: MonthlyFragment[], sourceUrl: string) {
  const latestByDateAndKind = new Map<string, MonthlyFragment>();
  for (const fragment of fragments) {
    const key = `${fragment.referenceDate}:${fragment.sourceKind}`;
    const current = latestByDateAndKind.get(key);
    if (!current || versionRank(fragment.version) >= versionRank(current.version)) {
      latestByDateAndKind.set(key, fragment);
    }
  }

  const byDate = new Map<string, MonthlyFragment[]>();
  for (const fragment of latestByDateAndKind.values()) {
    const group = byDate.get(fragment.referenceDate) || [];
    group.push(fragment);
    byDate.set(fragment.referenceDate, group);
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([referenceDate, monthlyFragments]) => {
      const conflicts: FieldConflict[] = [];
      const priorities = {
        geral: ["geral", "complemento", "ativo_passivo"] as MonthlyKind[],
        complemento: ["complemento", "geral", "ativo_passivo"] as MonthlyKind[],
        ativoPassivo: ["ativo_passivo", "complemento", "geral"] as MonthlyKind[],
      };
      const netWorth = chooseValue(monthlyFragments, "netWorth", priorities.complemento, conflicts);
      const sharesOutstanding = chooseValue(monthlyFragments, "sharesOutstanding", priorities.complemento, conflicts);
      const directVpCota = chooseValue(monthlyFragments, "vpCota", priorities.complemento, conflicts);
      const vpCota = directVpCota ?? (
        typeof netWorth === "number" && typeof sharesOutstanding === "number" && sharesOutstanding > 0
          ? netWorth / sharesOutstanding
          : undefined
      );

      return {
        referenceDate,
        cnpj: monthlyFragments[0]?.cnpj,
        fundName: chooseValue(monthlyFragments, "fundName", priorities.geral, conflicts),
        isin: chooseValue(monthlyFragments, "isin", priorities.geral, conflicts),
        segment: chooseValue(monthlyFragments, "segment", priorities.geral, conflicts),
        mandate: chooseValue(monthlyFragments, "mandate", priorities.geral, conflicts),
        netWorth,
        sharesOutstanding,
        numberShareholders: chooseValue(monthlyFragments, "numberShareholders", priorities.complemento, conflicts),
        vpCota,
        dividendYieldMonth: chooseValue(monthlyFragments, "dividendYieldMonth", priorities.complemento, conflicts),
        effectiveReturnMonth: chooseValue(monthlyFragments, "effectiveReturnMonth", priorities.complemento, conflicts),
        patrimonialReturnMonth: chooseValue(monthlyFragments, "patrimonialReturnMonth", priorities.complemento, conflicts),
        administrationExpensePct: chooseValue(monthlyFragments, "administrationExpensePct", priorities.complemento, conflicts),
        cash: chooseValue(monthlyFragments, "cash", priorities.ativoPassivo, conflicts),
        receivables: chooseValue(monthlyFragments, "receivables", priorities.ativoPassivo, conflicts),
        incomeToDistribute: chooseValue(monthlyFragments, "incomeToDistribute", priorities.ativoPassivo, conflicts),
        cri: chooseValue(monthlyFragments, "cri", priorities.ativoPassivo, conflicts),
        lci: chooseValue(monthlyFragments, "lci", priorities.ativoPassivo, conflicts),
        finishedIncomeProperties: chooseValue(monthlyFragments, "finishedIncomeProperties", priorities.ativoPassivo, conflicts),
        incomePropertiesUnderConstruction: chooseValue(monthlyFragments, "incomePropertiesUnderConstruction", priorities.ativoPassivo, conflicts),
        conflicts,
        source: {
          dataset: MONTHLY_DATASET,
          url: sourceUrl,
          importedAt: new Date().toISOString(),
          files: [...new Set(monthlyFragments.map((fragment) => fragment.sourceFile))],
          kinds: [...new Set(monthlyFragments.map((fragment) => fragment.sourceKind))],
          fragmentCount: monthlyFragments.length,
        },
        rawFragments: monthlyFragments.map((fragment) => ({
          sourceKind: fragment.sourceKind,
          sourceFile: fragment.sourceFile,
          sourceRowIndex: fragment.sourceRowIndex,
          version: fragment.version ?? null,
          raw: fragment.raw,
        })),
      };
    });
}

export async function importMonthlyCvmDataV2(input: {
  runId: string;
  ticker: string;
  cnpj: string;
  year: number;
}) {
  const { resource, metadataModified } = await discoverCvmResource(MONTHLY_DATASET, input.year, "ZIP");
  const response = await fetch(resource.url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Falha ao baixar informe mensal CVM: ${response.status}`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  const files = unzipSync(bytes);
  const fragments: MonthlyFragment[] = [];
  const filesRead: string[] = [];
  const ignoredCsvFiles: string[] = [];
  const fragmentsByKind: Record<MonthlyKind, number> = {
    geral: 0,
    complemento: 0,
    ativo_passivo: 0,
  };

  for (const [filename, content] of Object.entries(files)) {
    if (!/\.csv$/i.test(filename)) continue;
    const kind = classifyFile(filename);
    if (!kind) {
      ignoredCsvFiles.push(filename);
      continue;
    }

    filesRead.push(filename);
    const text = new TextDecoder("latin1").decode(content);
    const rows = parseRows(text, input.cnpj);
    for (const { row, rowIndex } of rows) {
      const fragment = buildFragment(row, kind, filename, rowIndex);
      if (!fragment) continue;
      fragments.push(fragment);
      fragmentsByKind[kind] += 1;
    }
  }

  const snapshots = consolidateMonthlyFragments(fragments, resource.url);
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
      { ticker: input.ticker, runId: input.runId, ...snapshot },
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
    dataset: MONTHLY_DATASET,
    resourceUrl: resource.url,
    resourceName: resource.name || null,
    metadataModified,
    zipBytes: bytes.byteLength,
    filesRead,
    ignoredCsvFiles,
    fragmentsByKind,
    matchedRows: fragments.length,
    snapshotsSaved: snapshots.length,
    referenceDates: snapshots.map((snapshot) => snapshot.referenceDate),
    conflictCount: snapshots.reduce((total, snapshot) => total + snapshot.conflicts.length, 0),
  };
}

function fieldCoverage(items: Array<Record<string, any>>, field: string) {
  if (!items.length) return 0;
  const present = items.filter((item) => item[field] !== undefined && item[field] !== null && item[field] !== "").length;
  return Number(((present / items.length) * 100).toFixed(1));
}

export async function validatePilotRunV2(input: {
  runId: string;
  ticker: string;
  cnpj: string;
  monthly: any;
  documents: any;
  ai: any;
}) {
  const snapshotQuery = await adminDb
    .collection("FiiIngestionStaging")
    .doc(input.runId)
    .collection("MonthlySnapshots")
    .limit(1000)
    .get();
  const snapshots = snapshotQuery.docs.map((doc) => doc.data() as Record<string, any>);
  const coverage = Object.fromEntries(
    ESSENTIAL_FIELDS.map((field) => [field, fieldCoverage(snapshots, field)])
  );
  const dateCounts = new Map<string, number>();
  for (const snapshot of snapshots) {
    const date = String(snapshot.referenceDate || "");
    if (date) dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
  }
  const duplicateDates = [...dateCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([date, count]) => ({ date, count }));
  const conflictCount = snapshots.reduce(
    (total, snapshot) => total + (Array.isArray(snapshot.conflicts) ? snapshot.conflicts.length : 0),
    0
  );
  const minimumCoverage = Math.min(...ESSENTIAL_FIELDS.map((field) => Number(coverage[field] || 0)));
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (!snapshots.length) blockingIssues.push("Nenhum snapshot mensal consolidado foi encontrado.");
  if (duplicateDates.length) blockingIssues.push("Existem competências mensais duplicadas após a consolidação.");
  if (conflictCount) blockingIssues.push(`Foram encontrados ${conflictCount} conflitos entre os subtipos mensais.`);
  if (minimumCoverage < 80) blockingIssues.push(`A cobertura mínima dos campos essenciais é ${minimumCoverage}%, abaixo de 80%.`);
  if (!input.documents?.documentsSaved) warnings.push("Nenhum documento eventual foi indexado.");
  if (input.ai?.status !== "completed") {
    warnings.push(`Extração por IA incompleta: ${input.ai?.reason || input.ai?.status || "desconhecido"}.`);
  }
  if (Number(input.ai?.sourceCoverage || 0) < 50) {
    warnings.push(`A IA utilizou apenas ${Number(input.ai?.sourceCoverage || 0)}% dos documentos submetidos.`);
  }

  const result = {
    parserVersion: 2,
    ticker: input.ticker,
    cnpj: input.cnpj,
    readyForReview: snapshots.length > 0 && blockingIssues.length === 0,
    publishToOfficialBase: false,
    monthlyRows: snapshots.length,
    documents: Number(input.documents?.documentsSaved || 0),
    coverage,
    minimumCoverage,
    duplicateDates,
    conflictCount,
    blockingIssues,
    warnings,
    aiSourceCoverage: Number(input.ai?.sourceCoverage || 0),
  };

  await adminDb.collection("FiiIngestionStaging").doc(input.runId).set({
    runId: input.runId,
    ticker: input.ticker,
    cnpj: input.cnpj,
    validation: result,
    parserVersion: 2,
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });

  return result;
}
