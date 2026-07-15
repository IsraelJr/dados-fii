export const WALLET_SNAPSHOT_MONTHS = [
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

const MONTH_ALIASES: Record<string, string> = {
  january: "January", janeiro: "January", jan: "January", "1": "January", "01": "January",
  february: "February", fevereiro: "February", fev: "February", feb: "February", "2": "February", "02": "February",
  march: "March", marco: "March", mar: "March", "3": "March", "03": "March",
  april: "April", abril: "April", abr: "April", apr: "April", "4": "April", "04": "April",
  may: "May", maio: "May", mai: "May", "5": "May", "05": "May",
  june: "June", junho: "June", jun: "June", "6": "June", "06": "June",
  july: "July", julho: "July", jul: "July", "7": "July", "07": "July",
  august: "August", agosto: "August", ago: "August", aug: "August", "8": "August", "08": "August",
  september: "September", setembro: "September", set: "September", sep: "September", "9": "September", "09": "September",
  october: "October", outubro: "October", out: "October", oct: "October", "10": "October",
  november: "November", novembro: "November", nov: "November", "11": "November",
  december: "December", dezembro: "December", dez: "December", dec: "December", "12": "December",
};

export type WalletSnapshotRecord = {
  id?: string;
  monthKey: string;
  year?: string;
  month?: string;
  label?: string;
  totalValue: number;
  estimatedDividendIncome: number;
  walletCount?: number;
  totalQuotas?: number;
  topWeightTicker?: string;
  topIncomeTicker?: string;
  source?: string;
  dataQuality?: string;
  closedAt?: unknown;
};

export function walletSnapshotNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value || "0").replace("R$", "").trim();
  const numeric = raw.replace(/[^0-9.,-]/g, "");
  const normalized = numeric.includes(",") ? numeric.replace(/\./g, "").replace(",", ".") : numeric;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthAlias(value: unknown) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return MONTH_ALIASES[key] || null;
}

function labelFor(year: string, month: string) {
  return `${MONTHS_SHORT_PTBR[month] || month}/${year.slice(-2)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function canonicalMonthValues(value: unknown) {
  const result = new Map<string, number>();
  for (const [rawMonth, rawValue] of Object.entries(asRecord(value))) {
    const month = monthAlias(rawMonth);
    if (!month) continue;
    const number = walletSnapshotNumber(rawValue);
    if (!result.has(month) || number > 0) result.set(month, number);
  }
  return result;
}

export function legacyWalletSnapshots(data: Record<string, unknown> | null | undefined): WalletSnapshotRecord[] {
  const patrimony = asRecord(data?.patrimony);
  const earnings = asRecord(data?.earnings);
  const years = Array.from(new Set([...Object.keys(patrimony), ...Object.keys(earnings)]))
    .filter((year) => /^\d{4}$/.test(year));
  const results: WalletSnapshotRecord[] = [];

  for (const year of years) {
    const patrimonyMonths = canonicalMonthValues(patrimony[year]);
    const earningMonths = canonicalMonthValues(earnings[year]);
    const months = Array.from(new Set([...patrimonyMonths.keys(), ...earningMonths.keys()]));
    for (const month of months) {
      const monthIndex = WALLET_SNAPSHOT_MONTHS.indexOf(month as typeof WALLET_SNAPSHOT_MONTHS[number]);
      if (monthIndex < 0) continue;
      const totalValue = patrimonyMonths.get(month) || 0;
      const estimatedDividendIncome = earningMonths.get(month) || 0;
      if (totalValue <= 0 && estimatedDividendIncome <= 0) continue;
      results.push({
        monthKey: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
        year,
        month,
        label: labelFor(year, month),
        totalValue,
        estimatedDividendIncome,
        source: "legacy_ios",
        dataQuality: "aggregate_only",
      });
    }
  }

  return results.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export function mergeWalletSnapshots(
  legacy: WalletSnapshotRecord[],
  persisted: WalletSnapshotRecord[],
): WalletSnapshotRecord[] {
  const merged = new Map<string, WalletSnapshotRecord>();
  legacy.forEach((snapshot) => merged.set(snapshot.monthKey, snapshot));
  persisted.forEach((snapshot) => {
    const previous = merged.get(snapshot.monthKey);
    merged.set(snapshot.monthKey, {
      ...previous,
      ...snapshot,
      totalValue: snapshot.totalValue > 0 ? snapshot.totalValue : previous?.totalValue || 0,
      estimatedDividendIncome: snapshot.estimatedDividendIncome > 0
        ? snapshot.estimatedDividendIncome
        : previous?.estimatedDividendIncome || 0,
    });
  });
  return Array.from(merged.values())
    .filter((snapshot) => snapshot.totalValue > 0 || snapshot.estimatedDividendIncome > 0)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-120);
}
