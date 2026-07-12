export type FiagroRawRow = Record<string, unknown>;

export const FIAGRO_FIELD_CANDIDATES = {
  referenceDate: ["Data_Referencia", "DT_COMPTC", "DT_REFERENCIA", "COMPETENCIA"],
  fundName: ["Nome_Classe", "Nome_Subclasse", "DENOM_SOCIAL", "DENOM_CLASSE"],
  netWorth: ["Patrimonio_Liquido", "VL_PATRIM_LIQ", "VL_PL"],
  sharesOutstanding: ["Cotas_Emitidas", "Numero_Cotas", "QT_COTAS", "QTD_COTAS"],
  numberShareholders: ["Numero_Cotistas", "NR_COTST", "NR_COTISTAS"],
  vpCota: ["Valor_Patrimonial_Cotas", "Valor_Patrimonial_Cota", "VL_QUOTA", "VL_COTA"],
  totalPortfolioValue: ["Valor_Ativo", "VL_TOTAL", "VL_CARTEIRA_TOTAL"],
  delinquentCreditValue: ["Vencidos", "TAB_VI_B_VL_DIRCRED_INAD", "TAB_VI_VL_TOTAL_INAD"],
} as const;

export function normalizeFiagroFieldKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

export function firstFiagroValue(row: FiagroRawRow, candidates: readonly string[]) {
  const entries = Object.entries(row || {});
  const normalizedCandidates = candidates.map(normalizeFiagroFieldKey);

  for (const candidate of normalizedCandidates) {
    const exact = entries.find(([key]) => normalizeFiagroFieldKey(key) === candidate);
    const value = exact?.[1];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }

  return undefined;
}

export function parseFiagroNumber(value: unknown) {
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

export function normalizeFiagroReferenceDate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const brazilian = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brazilian) return `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
}

export function mapFiagroMonthlyRow(row: FiagroRawRow) {
  const text = (field: keyof typeof FIAGRO_FIELD_CANDIDATES) => {
    const value = firstFiagroValue(row, FIAGRO_FIELD_CANDIDATES[field]);
    return value === undefined ? undefined : String(value).trim();
  };
  const numeric = (field: keyof typeof FIAGRO_FIELD_CANDIDATES) =>
    parseFiagroNumber(firstFiagroValue(row, FIAGRO_FIELD_CANDIDATES[field]));

  return {
    referenceDate: normalizeFiagroReferenceDate(text("referenceDate")),
    fundName: text("fundName"),
    netWorth: numeric("netWorth"),
    sharesOutstanding: numeric("sharesOutstanding"),
    numberShareholders: numeric("numberShareholders"),
    vpCota: numeric("vpCota"),
    totalPortfolioValue: numeric("totalPortfolioValue"),
    delinquentCreditValue: numeric("delinquentCreditValue"),
  };
}
