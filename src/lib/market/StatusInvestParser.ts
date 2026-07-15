export const DIVIDEND_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

type DividendEntry = {
  payment_date: string;
  date_with: string;
  earnings: string;
  price_date_with?: string;
};

export type DividendYear = Record<string, DividendEntry>;

export type StatusInvestMarketIndicators = {
  dailyLiquidity?: number;
  liquidity?: number;
  dailyLiquidityUnit?: "BRL/day";
  dailyLiquidityWindowDays?: number;
  numberShares?: number;
  numberCotistas?: number;
  numberShareholders?: number;
  marketData?: Record<string, string | number>;
  marketDataSource?: "StatusInvest";
  marketDataUpdatedAt?: string;
};

function parseBrazilianNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value || "").replace(/R\$|%|\s/g, "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function currency(value: string) {
  const parsed = parseBrazilianNumber(value);
  return parsed === null ? undefined : `R$ ${parsed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function scaledNumber(value: string, suffix?: string) {
  const parsed = parseBrazilianNumber(value);
  if (parsed === null) return null;
  const unit = String(suffix || "").toUpperCase();
  const multiplier = unit === "BI" || unit === "B" ? 1_000_000_000
    : unit === "MI" || unit === "M" ? 1_000_000
      : unit === "MIL" || unit === "K" ? 1_000
        : 1;
  return parsed * multiplier;
}

function referencePrices(text: string) {
  const result = new Map<string, string>();
  const pattern = /Cota(?:ç|c)ão base\s+R\$\s*([0-9.]+(?:,[0-9]+)?)[\s\S]{0,180}?Data Base\s+(\d{2}\/\d{2}\/\d{4})/gi;
  for (const match of text.matchAll(pattern)) {
    const formatted = currency(match[1]);
    if (formatted) result.set(match[2], formatted);
  }
  return result;
}

export function parseStatusInvestDividends(text: string, year: number): DividendYear {
  const output: DividendYear = {};
  const prices = referencePrices(text);
  const pattern = /Rendimento\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(?:R\$\s*)?([0-9]+(?:[.,][0-9]+)?)/gi;
  for (const match of text.matchAll(pattern)) {
    const [, dateWith, paymentDate, rawValue] = match;
    if (!paymentDate.endsWith(`/${year}`)) continue;
    const monthNumber = Number(paymentDate.slice(3, 5));
    const month = DIVIDEND_MONTHS[monthNumber - 1];
    if (!month) continue;
    const basePrice = prices.get(dateWith);
    output[month] = {
      payment_date: paymentDate,
      date_with: dateWith,
      earnings: currency(rawValue) || `R$ ${rawValue}`,
      ...(basePrice ? { price_date_with: basePrice } : {}),
    };
  }
  return output;
}

export function mergeDividendYear(previous: unknown, fetched: DividendYear): DividendYear {
  const existing = previous && typeof previous === "object" && !Array.isArray(previous)
    ? previous as DividendYear
    : {};
  const merged: DividendYear = { ...existing };
  for (const [month, next] of Object.entries(fetched)) {
    const prior = existing[month];
    const priorBase = parseBrazilianNumber(prior?.price_date_with);
    merged[month] = {
      ...(prior || {}),
      ...next,
      ...(!next.price_date_with && priorBase && priorBase > 0 ? { price_date_with: prior.price_date_with } : {}),
    };
  }
  return merged;
}

function metricAfterLabel(text: string, labels: string[], options?: { currencyRequired?: boolean }) {
  for (const label of labels) {
    const index = text.toLocaleLowerCase("pt-BR").indexOf(label.toLocaleLowerCase("pt-BR"));
    if (index < 0) continue;
    const slice = text.slice(index + label.length, index + label.length + 180);
    const match = options?.currencyRequired
      ? slice.match(/R\$\s*([0-9.]+(?:,[0-9]+)?)(?:\s*(BI|MIL|MI|B|M|K))?/i)
      : slice.match(/(?:R\$\s*)?([0-9.]+(?:,[0-9]+)?)(?:\s*(BI|MIL|MI|B|M|K))?/i);
    const value = match ? scaledNumber(match[1], match[2]) : null;
    if (value !== null && value > 0) return value;
  }
  return undefined;
}

export function parseStatusInvestMarketIndicators(text: string, sourceUrl: string, updatedAt: string): StatusInvestMarketIndicators {
  const dailyLiquidity = metricAfterLabel(text, ["Liquidez média diária", "Liquidez Diária", "Volume médio diário", "Volume diário médio"], { currencyRequired: true });
  const numberShares = metricAfterLabel(text, ["Cotas emitidas", "Número de cotas", "Nº de cotas", "Total de cotas"]);
  const numberShareholders = metricAfterLabel(text, ["Número de cotistas", "Nº de cotistas", "Cotistas"]);
  if (!dailyLiquidity && !numberShares && !numberShareholders) return {};
  const values = {
    ...(dailyLiquidity ? { dailyLiquidity, liquidity: dailyLiquidity, dailyLiquidityUnit: "BRL/day" as const, dailyLiquidityWindowDays: 30 } : {}),
    ...(numberShares ? { numberShares } : {}),
    ...(numberShareholders ? { numberCotistas: numberShareholders, numberShareholders } : {}),
  };
  return {
    ...values,
    marketData: { ...values, source: "StatusInvest", sourceUrl, updatedAt },
    marketDataSource: "StatusInvest" as const,
    marketDataUpdatedAt: updatedAt,
  };
}
