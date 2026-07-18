const MONTHS = [
  ["January", "Janeiro"],
  ["February", "Fevereiro"],
  ["March", "Março", "Marco"],
  ["April", "Abril"],
  ["May", "Maio"],
  ["June", "Junho"],
  ["July", "Julho"],
  ["August", "Agosto"],
  ["September", "Setembro"],
  ["October", "Outubro"],
  ["November", "Novembro"],
  ["December", "Dezembro"],
] as const;

type WalletFund = {
  quotas: number;
  data?: Record<string, unknown> | null;
};

export type WalletMonthlyDividendTotal = {
  monthKey: string;
  value: number;
};

function parseCurrency(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return Number(String(value || "0").replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
}

function yearData(data: Record<string, unknown> | null | undefined, year: number) {
  const value = data?.[`earnings${year}`];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function monthEarning(data: Record<string, unknown>, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = data[alias];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const parsed = parseCurrency((value as Record<string, unknown>).earnings);
    if (parsed > 0) return parsed;
  }
  return 0;
}

export function buildWalletMonthlyDividendTotals(
  funds: WalletFund[],
  referenceDate = new Date(),
  yearsToInclude = 5,
): WalletMonthlyDividendTotal[] {
  const currentYear = referenceDate.getFullYear();
  const currentMonthIndex = referenceDate.getMonth();
  const firstYear = currentYear - Math.max(1, yearsToInclude) + 1;
  const totals: WalletMonthlyDividendTotal[] = [];

  for (let year = firstYear; year <= currentYear; year += 1) {
    for (let monthIndex = 0; monthIndex < MONTHS.length; monthIndex += 1) {
      if (year === currentYear && monthIndex > currentMonthIndex) break;
      const value = funds.reduce((sum, fund) => {
        const perShare = monthEarning(yearData(fund.data, year), MONTHS[monthIndex]);
        return sum + perShare * fund.quotas;
      }, 0);
      if (value <= 0) continue;
      totals.push({
        monthKey: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
        value,
      });
    }
  }

  return totals;
}
