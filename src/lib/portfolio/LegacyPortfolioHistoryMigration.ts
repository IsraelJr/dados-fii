import {
  buildCompetence,
  isFutureCompetence,
  parseOptionalMoney,
  PORTFOLIO_HISTORY_SCHEMA_VERSION,
  type PortfolioHistoryEntry,
} from "./PortfolioHistory";

export type LegacyWalletSnapshot = Readonly<{
  monthKey?: unknown;
  totalValue?: unknown;
  estimatedMonthlyIncome?: unknown;
  announcedMonthlyIncome?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}>;

export type LegacyMigrationResult = Readonly<{
  entries: readonly PortfolioHistoryEntry[];
  rejected: number;
}>;

function validIso(value: unknown, fallback: string) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function normalizeLegacyWalletSnapshots(
  portfolioId: string,
  snapshots: unknown,
  now: Date,
): LegacyMigrationResult {
  if (!Array.isArray(snapshots)) return Object.freeze({ entries: Object.freeze([]), rejected: 0 });

  const currentYear = now.getUTCFullYear();
  const byCompetence = new Map<string, PortfolioHistoryEntry>();
  let rejected = 0;

  for (const raw of snapshots as LegacyWalletSnapshot[]) {
    try {
      const match = /^(\d{4})-(\d{2})$/.exec(String(raw?.monthKey ?? "").trim());
      if (!match) throw new Error("INVALID_COMPETENCE");
      const year = Number(match[1]);
      const month = Number(match[2]);
      const competence = buildCompetence(year, month);
      if (year !== currentYear || isFutureCompetence(competence, now)) {
        throw new Error("OUTSIDE_CURRENT_YEAR");
      }

      const totalValue = parseOptionalMoney(raw.totalValue);
      const dividends = parseOptionalMoney(
        raw.estimatedMonthlyIncome ?? raw.announcedMonthlyIncome,
      );
      if (totalValue === null && dividends === null) throw new Error("EMPTY_ENTRY");

      const fallback = now.toISOString();
      const createdAt = validIso(raw.createdAt ?? raw.updatedAt, fallback);
      const updatedAt = validIso(raw.updatedAt ?? raw.createdAt, createdAt);
      byCompetence.set(competence, Object.freeze({
        schemaVersion: PORTFOLIO_HISTORY_SCHEMA_VERSION,
        portfolioId,
        competence,
        totalValue,
        dividends,
        source: "legacy" as const,
        createdAt,
        updatedAt,
      }));
    } catch {
      rejected += 1;
    }
  }

  return Object.freeze({
    entries: Object.freeze([...byCompetence.values()].sort((a, b) => a.competence.localeCompare(b.competence))),
    rejected,
  });
}
