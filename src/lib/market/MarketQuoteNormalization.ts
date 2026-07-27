export const MAX_PLAUSIBLE_INTRADAY_VARIATION_PERCENT = 30;

export function parseMarketNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value ?? "")
    .replace(/R\$/gi, "")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .trim();

  if (!raw || raw === "#N/A") return null;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateIntradayVariationPercent(
  currentValue: unknown,
  openingValue: unknown,
  maxAbsoluteVariation = MAX_PLAUSIBLE_INTRADAY_VARIATION_PERCENT,
): number | null {
  const current = parseMarketNumber(currentValue);
  const opening = parseMarketNumber(openingValue);

  if (current === null || opening === null || current <= 0 || opening <= 0) return null;

  const variation = ((current - opening) / opening) * 100;
  if (!Number.isFinite(variation) || Math.abs(variation) > maxAbsoluteVariation) return null;

  return Number(variation.toFixed(4));
}

export function formatMarketVariation(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  return `${value.toFixed(4)}%`;
}
