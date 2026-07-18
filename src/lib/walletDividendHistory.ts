export const WALLET_DIVIDEND_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTHS_SHORT_PTBR: Record<string, string> = {
  January: "Jan",
  February: "Fev",
  March: "Mar",
  April: "Abr",
  May: "Mai",
  June: "Jun",
  July: "Jul",
  August: "Ago",
  September: "Set",
  October: "Out",
  November: "Nov",
  December: "Dez",
};

export type WalletDividendMonth = { month: string; label: string; value: number };

export type WalletDividendHistory = {
  months: WalletDividendMonth[];
  visibleMonths: WalletDividendMonth[];
  total: number;
  average: number;
  best: WalletDividendMonth | null;
  worst: WalletDividendMonth | null;
  topPayer: { ticker: string; value: number } | null;
};

type WalletDividendItem = {
  ticker: string;
  quotas: number;
  data?: Record<string, unknown> | null;
};

function parseCurrency(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return Number(String(value || "0").replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
}

function yearData(data: Record<string, unknown> | null | undefined, year: number) {
  const value = data?.[`earnings${year}`];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, { earnings?: unknown }>
    : {};
}

export function buildWalletDividendHistory(
  items: WalletDividendItem[],
  year = new Date().getFullYear(),
  throughMonthIndex = new Date().getMonth(),
): WalletDividendHistory {
  const safeMonthIndex = Math.max(0, Math.min(11, throughMonthIndex));
  const byTicker: Record<string, number> = {};
  const months = WALLET_DIVIDEND_MONTHS.slice(0, safeMonthIndex + 1).map((month) => {
    const value = items.reduce((total, item) => {
      const earning = yearData(item.data, year)[month]?.earnings;
      const amount = parseCurrency(earning) * item.quotas;
      if (amount > 0) byTicker[item.ticker] = (byTicker[item.ticker] || 0) + amount;
      return total + amount;
    }, 0);
    return { month, label: MONTHS_SHORT_PTBR[month], value };
  });
  const visibleMonths = months.filter((item) => item.value > 0);
  const total = months.reduce((sum, item) => sum + item.value, 0);
  const average = visibleMonths.length ? total / visibleMonths.length : 0;
  const best = [...visibleMonths].sort((a, b) => b.value - a.value)[0] || null;
  const worst = [...visibleMonths].sort((a, b) => a.value - b.value)[0] || null;
  const topPayer = Object.entries(byTicker)
    .sort((a, b) => b[1] - a[1])
    .map(([ticker, value]) => ({ ticker, value }))[0] || null;

  return { months, visibleMonths, total, average, best, worst, topPayer };
}
