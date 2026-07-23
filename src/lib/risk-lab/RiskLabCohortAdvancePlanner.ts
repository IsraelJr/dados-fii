export type RiskLabCohortAdvanceAction = "initialize" | "case" | "finalize" | "noop";

export interface RiskLabCohortAdvanceSnapshot {
  releaseCommit: string | null;
  status: string;
  cases: Array<{ ticker: string }>;
}

export interface RiskLabCohortAdvancePlan {
  action: RiskLabCohortAdvanceAction;
  ticker: string | null;
}

export function planRiskLabCohortAdvance(
  activeRelease: string,
  tickers: readonly string[],
  current: RiskLabCohortAdvanceSnapshot | null,
): RiskLabCohortAdvancePlan {
  if (!/^[a-f0-9]{40}$/.test(activeRelease)) {
    throw new Error("Release ativa inválida para o avanço da coorte.");
  }
  if (!tickers.length || new Set(tickers).size !== tickers.length) {
    throw new Error("Coorte inválida para o avanço automático.");
  }
  if (!current || current.releaseCommit !== activeRelease) {
    return { action: "initialize", ticker: null };
  }
  if (current.status !== "running") {
    return { action: "noop", ticker: null };
  }

  const completed = new Set(current.cases.map((item) => item.ticker));
  const nextTicker = tickers.find((ticker) => !completed.has(ticker)) || null;
  return nextTicker
    ? { action: "case", ticker: nextTicker }
    : { action: "finalize", ticker: null };
}
