import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import type { AutomaticMonthlySourceSummary } from "@/types/riskLabAutomatic";
import type { VerifiedDividendNotice } from "@/types/riskLabDividendStress";

export interface CvmMonthlyArchive {
  year: number;
  sourceUrl: string;
  sourceHash: string;
  tables: {
    ativo: CsvTable;
    complemento: CsvTable;
    geral: CsvTable;
  };
}

interface CsvRow {
  values: Record<string, string>;
  raw: string;
}

interface CsvTable {
  name: string;
  rows: CsvRow[];
}

const CNPJ = ["CNPJ_Fundo_Classe", "CNPJ_Fundo", "CNPJ_FUNDO_CLASSE", "CNPJ_FUNDO"];
const DATE = ["Data_Referencia", "DT_COMPTC", "DATA_REFERENCIA"];
const VERSION = ["Versao", "VERSAO"];
const DELIVERY = ["Data_Entrega", "DT_RECEB", "DATA_ENTREGA"];
const DISTRIBUTION = ["Rendimentos_Distribuir", "RENDIMENTOS_DISTRIBUIR"];
const SHARES = ["Cotas_Emitidas", "Quantidade_Cotas_Emitidas", "COTAS_EMITIDAS", "QUANTIDADE_COTAS_EMITIDAS"];

function hash(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function field(row: CsvRow, aliases: string[]) {
  for (const alias of aliases) if (Object.hasOwn(row.values, alias)) return row.values[alias];
  return "";
}

function lineValues(line: string) {
  const result: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === ";" && !quoted) {
      result.push(value);
      value = "";
    } else value += char;
  }
  result.push(value);
  return result;
}

function csv(name: string, bytes: Uint8Array): CsvTable {
  const lines = new TextDecoder("windows-1252")
    .decode(bytes)
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const header = lineValues(lines[0] || "");
  if (!header.some((column) => CNPJ.includes(column))) throw new Error(`Schema CVM inválido em ${name}.`);
  return {
    name,
    rows: lines.slice(1).map((raw) => {
      const values = lineValues(raw);
      return { raw, values: Object.fromEntries(header.map((column, index) => [column, values[index] ?? ""])) };
    }),
  };
}

function zipFile(files: Record<string, Uint8Array>, pattern: RegExp) {
  const entry = Object.entries(files).find(([name]) => pattern.test(name));
  if (!entry) throw new Error(`Arquivo CVM ausente: ${pattern}.`);
  return entry;
}

export function parseCvmMonthlyArchive(year: number, sourceUrl: string, zipBytes: Uint8Array): CvmMonthlyArchive {
  const files = unzipSync(zipBytes);
  const total = Object.values(files).reduce((sum, bytes) => sum + bytes.byteLength, 0);
  if (total > 90 * 1024 * 1024) throw new Error(`ZIP CVM ${year} excede o limite descompactado.`);
  const [ativoName, ativo] = zipFile(files, /inf_mensal_fii_ativo_passivo_\d{4}\.csv$/i);
  const [complementoName, complemento] = zipFile(files, /inf_mensal_fii_complemento_\d{4}\.csv$/i);
  const [geralName, geral] = zipFile(files, /inf_mensal_fii_geral_\d{4}\.csv$/i);
  return {
    year,
    sourceUrl,
    sourceHash: hash(zipBytes),
    tables: {
      ativo: csv(ativoName, ativo),
      complemento: csv(complementoName, complemento),
      geral: csv(geralName, geral),
    },
  };
}

function date(value: string) {
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
}

function knownAt(value: string) {
  const onlyDate = date(value);
  if (onlyDate) return `${onlyDate}T23:59:59-03:00`;
  const stamp = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  return stamp ? `${stamp[1]}-${stamp[2]}-${stamp[3]}T${stamp[4]}:${stamp[5]}:${stamp[6] || "00"}-03:00` : null;
}

function number(value: string) {
  const raw = value.trim().replace(/\s/g, "");
  if (!raw) return null;
  const parsed = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function indexed(table: CsvTable, cnpj: string) {
  const result = new Map<string, Map<number, CsvRow>>();
  for (const row of table.rows) {
    if (digits(field(row, CNPJ)) !== cnpj) continue;
    const reference = date(field(row, DATE));
    const version = Number(field(row, VERSION));
    if (!reference || !Number.isInteger(version) || version < 1) continue;
    const versions = result.get(reference) || new Map<number, CsvRow>();
    versions.set(version, row);
    result.set(reference, versions);
  }
  return result;
}

function commonVersions(...tables: Array<Map<number, CsvRow>>) {
  return [...tables[0].keys()]
    .filter((version) => tables.every((table) => table.has(version)))
    .sort((left, right) => right - left);
}

function knownVersion(
  ativo: Map<number, CsvRow>,
  complemento: Map<number, CsvRow>,
  geral: Map<number, CsvRow>,
  untilTimestamp: number,
) {
  const versions = commonVersions(ativo, complemento, geral);
  if (!versions.length) return { version: null, commonVersionExists: false };
  const version = versions.find((candidate) => {
    const deliveredAt = knownAt(field(geral.get(candidate)!, DELIVERY));
    return Boolean(deliveredAt && Date.parse(deliveredAt) <= untilTimestamp);
  }) || null;
  return { version, commonVersionExists: true };
}

export function deriveCvmMonthlyYear(
  ticker: string,
  cnpjValue: string,
  archive: CvmMonthlyArchive,
  fromDate: string,
  untilDate: string,
  reviewedAt: string,
) {
  const cnpj = digits(cnpjValue);
  if (cnpj.length !== 14) throw new Error("CNPJ inválido no informe mensal CVM.");
  const untilTimestamp = Date.parse(`${untilDate}T23:59:59-03:00`);
  if (!Number.isFinite(untilTimestamp)) throw new Error("Data final inválida no informe mensal CVM.");
  const ativo = indexed(archive.tables.ativo, cnpj);
  const complemento = indexed(archive.tables.complemento, cnpj);
  const geral = indexed(archive.tables.geral, cnpj);
  const dates = [...new Set([...ativo.keys(), ...complemento.keys(), ...geral.keys()])].sort();
  const observations: VerifiedDividendNotice[] = [];
  const conflicts: string[] = [];

  for (const reference of dates) {
    if (reference < fromDate || reference > untilDate) continue;
    const a = ativo.get(reference);
    const c = complemento.get(reference);
    const g = geral.get(reference);
    if (!a || !c || !g) {
      conflicts.push(`${reference}: tabelas mensais obrigatórias incompletas.`);
      continue;
    }
    const selected = knownVersion(a, c, g, untilTimestamp);
    if (!selected.commonVersionExists) {
      conflicts.push(`${reference}: nenhuma versão comum entre as tabelas.`);
      continue;
    }
    if (!selected.version) continue;
    const version = selected.version;
    const ar = a.get(version)!;
    const cr = c.get(version)!;
    const gr = g.get(version)!;
    const announcedAt = knownAt(field(gr, DELIVERY));
    if (!announcedAt) {
      conflicts.push(`${reference}: Data_Entrega inválida.`);
      continue;
    }
    const total = number(field(ar, DISTRIBUTION));
    const complementShares = number(field(cr, SHARES));
    const generalShares = number(field(gr, SHARES));
    const shares = complementShares && complementShares > 0 ? complementShares : generalShares;
    if (total === null || !shares || shares <= 0) {
      conflicts.push(`${reference}: rendimento ou cotas inválidos.`);
      continue;
    }
    if (generalShares && complementShares && Math.abs(generalShares - complementShares) > Math.max(1, complementShares * 1e-8)) {
      conflicts.push(`${reference}: cotas divergentes entre as tabelas.`);
      continue;
    }
    const competenceMonth = reference.slice(0, 7);
    const amount = Math.round(total / shares * 100_000_000) / 100_000_000;
    const rowHash = hash(`${ar.raw}\n${cr.raw}\n${gr.raw}`);
    observations.push({
      ticker,
      competenceMonth,
      amountPerShare: amount,
      announcedAt,
      source: {
        documentId: `CVM-INF-MENSAL-${archive.year}-${competenceMonth}-v${version}`,
        sourceUrl: archive.sourceUrl,
        sourceType: "primary_regulatory",
        reviewMethod: "automatic_regulatory_validation",
        reviewedBy: "risk-lab-cvm-monthly-bulk-v1",
        reviewedAt,
        page: 1,
        excerpt: `Informe mensal CVM ${competenceMonth}, versão ${version}: Rendimentos_Distribuir=${total}; Cotas_Emitidas=${shares}; rendimento por cota=${amount}; Data_Entrega=${announcedAt}.`,
        sourceHash: archive.sourceHash,
        sourceVersion: `inf_mensal_fii_${archive.year}.zip:v${version}`,
        protocolHash: rowHash,
        protocolVersion: version,
      },
    });
  }

  const matchingRows = [...ativo.values()].reduce((sum, versions) => sum + versions.size, 0);
  const source: AutomaticMonthlySourceSummary = {
    year: archive.year,
    sourceUrl: archive.sourceUrl,
    sourceHash: archive.sourceHash,
    fetched: true,
    documentsInspected: matchingRows,
    matchingRows,
    acceptedMonths: observations.length,
    error: conflicts[0] || null,
  };
  return { observations, conflicts, source };
}
