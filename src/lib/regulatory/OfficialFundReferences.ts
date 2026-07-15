export type OfficialFundReference = {
  ticker: string;
  cnpj: string;
  vpCota: number;
  referenceDate: string;
  sourceName: string;
  sourceUrl: string;
};

const OFFICIAL_FUND_REFERENCES: Record<string, OfficialFundReference> = {
  VGIA11: {
    ticker: "VGIA11",
    cnpj: "41.081.088/0001-09",
    vpCota: 9.5,
    referenceDate: "2026-05-31",
    sourceName: "Relatório de Gestão VGIA11 — maio de 2026",
    sourceUrl: "https://valorainvest.com.br/wp-content/uploads/2026/07/Relatorio-de-Gestao-VGIA11-Maio-2026.pdf",
  },
};

function tickerOf(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function validCnpj(value: unknown) {
  return String(value || "").replace(/\D/g, "").length === 14;
}

function numberOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value || "").replace("R$", "").replace(/\s/g, "").trim();
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstPositive(data: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => (
      current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined
    ), data);
    const parsed = numberOf(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

function hasNewerValuation(data: Record<string, unknown>, referenceDate: string) {
  const valuation = data.valuation && typeof data.valuation === "object"
    ? data.valuation as Record<string, unknown>
    : {};
  const value = String(data.valuationReferenceDate || data.vpCotaReferenceDate || valuation.referenceDate || "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  return value.slice(0, 10) > referenceDate;
}

export function getOfficialFundReference(value: unknown) {
  return OFFICIAL_FUND_REFERENCES[tickerOf(value)] || null;
}

export function applyOfficialFundReference(value: unknown, input: Record<string, unknown>) {
  const reference = getOfficialFundReference(value);
  if (!reference) return input;

  const price = firstPositive(input, ["price", "currentPrice", "cotacao", "marketData.price"]);
  const existingVpCota = firstPositive(input, [
    "vpCota",
    "valorPatrimonialPorCota",
    "vpa",
    "bookValuePerShare",
    "equityValuePerShare",
    "valuation.vpCota",
  ]);
  const existingPvp = price > 0 && existingVpCota > 0 ? price / existingVpCota : 0;
  const inconsistentValuation = !existingVpCota || (price > 0 && (existingPvp < 0.1 || existingPvp > 10));
  const useOfficialValuation = !hasNewerValuation(input, reference.referenceDate) && inconsistentValuation;

  return {
    ...input,
    cnpj: validCnpj(input.cnpj) ? input.cnpj : reference.cnpj,
    ...(useOfficialValuation ? {
      vpCota: reference.vpCota,
      valorPatrimonialPorCota: reference.vpCota,
      valuationReferenceDate: reference.referenceDate,
      valuationSource: reference.sourceUrl,
    } : {}),
    officialReference: {
      sourceName: reference.sourceName,
      sourceUrl: reference.sourceUrl,
      referenceDate: reference.referenceDate,
    },
  };
}
