import type { RegulatoryScore } from "./regulatoryInsights.ts";

export type ComparableRegulatoryFund = {
  ticker: string;
  name?: string | null;
  segment?: string | null;
  scores: Record<string, RegulatoryScore>;
  facts: Record<string, any>;
};

const DIMENSION_LABELS: Record<string, string> = {
  overall: "Nota geral",
  dataQuality: "Qualidade dos dados",
  documentation: "Documentação",
  governanceEvidence: "Evidências de governança",
  investorBase: "Base de cotistas",
  patrimonial: "Patrimônio",
  growth: "Crescimento",
  stability: "Estabilidade",
  liquidity: "Liquidez",
  risk: "Risco observado",
};

function assessed(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function winnerForDimension(funds: ComparableRegulatoryFund[], dimension: string) {
  const available = funds
    .map((fund) => ({ ticker: fund.ticker, value: fund.scores[dimension] }))
    .filter((item): item is { ticker: string; value: number } => assessed(item.value));
  if (!available.length) return null;
  const sorted = [...available].sort((left, right) =>
    dimension === "risk" ? left.value - right.value : right.value - left.value
  );
  const best = sorted[0];
  const ties = sorted.filter((item) => item.value === best.value).map((item) => item.ticker);
  return {
    ticker: ties.length === 1 ? best.ticker : null,
    ties,
    value: best.value,
  };
}

export function compareRegulatoryFunds(funds: ComparableRegulatoryFund[]) {
  const unique = [...new Map(
    funds
      .filter((fund) => String(fund?.ticker || "").trim())
      .map((fund) => [String(fund.ticker).toUpperCase(), { ...fund, ticker: String(fund.ticker).toUpperCase() }])
  ).values()];

  if (unique.length < 2) {
    throw new Error("O comparador exige ao menos dois fundos com relatório regulatório disponível.");
  }
  if (unique.length > 5) {
    throw new Error("Compare no máximo cinco fundos por vez.");
  }

  const dimensions = Object.keys(DIMENSION_LABELS).map((key) => ({
    key,
    label: DIMENSION_LABELS[key],
    winner: winnerForDimension(unique, key),
    values: unique.map((fund) => ({
      ticker: fund.ticker,
      value: fund.scores[key] ?? null,
      assessed: assessed(fund.scores[key]),
    })),
  }));

  const overallWinner = winnerForDimension(unique, "overall");
  const coverageLeader = winnerForDimension(unique, "dataQuality");
  const lowerRiskLeader = winnerForDimension(unique, "risk");

  return {
    version: "regulatory-comparator-v1",
    funds: unique.map((fund) => ({
      ticker: fund.ticker,
      name: fund.name || null,
      segment: fund.segment || null,
      scores: fund.scores,
      facts: fund.facts,
    })),
    dimensions,
    highlights: {
      overallLeader: overallWinner,
      dataQualityLeader: coverageLeader,
      lowerObservedRisk: lowerRiskLeader,
    },
    methodology: {
      unavailableValuesAreExcluded: true,
      riskDimensionUsesLowerIsBetter: true,
      marketLiquidityIsNotEstimated: true,
    },
  };
}
