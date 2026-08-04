import type {
  PortfolioIntelligencePositionInput,
  PortfolioIntelligenceSnapshotInput,
} from "./PortfolioIntelligence";

export type ConsolidatedPortfolioSnapshot = Readonly<{
  monthKey: string;
  estimatedMonthlyIncome: number;
}>;

export type CurrentPortfolioPosition = Readonly<{
  ticker: string;
  quotas: number;
  price: number | null;
  estimatedIncome: number | null;
  segment: string | null;
}>;

export function intelligenceSnapshotsFromConsolidated(
  snapshots: readonly ConsolidatedPortfolioSnapshot[],
): readonly PortfolioIntelligenceSnapshotInput[] {
  return Object.freeze(snapshots.map((snapshot) => Object.freeze({
    competence: snapshot.monthKey,
    dividends: snapshot.estimatedMonthlyIncome,
  })));
}

export function intelligencePositionsFromCurrentWallet(
  positions: readonly CurrentPortfolioPosition[],
): readonly PortfolioIntelligencePositionInput[] {
  return Object.freeze(positions.map((position) => Object.freeze({
    ticker: position.ticker,
    quantity: position.quotas,
    price: position.price,
    estimatedIncome: position.estimatedIncome,
    segment: position.segment,
  })));
}
