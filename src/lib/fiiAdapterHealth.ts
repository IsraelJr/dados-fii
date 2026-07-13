export type AdapterRunSample = {
  adapterId?: string | null;
  fundType?: string | null;
  ticker?: string | null;
  status?: string | null;
  requestedAt?: string | null;
  finishedAt?: string | null;
  parserVersion?: number | null;
  manualQa?: Record<string, any> | null;
  error?: string | null;
};

function timestamp(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function durationMs(run: AdapterRunSample) {
  const start = timestamp(run.requestedAt);
  const end = timestamp(run.finishedAt);
  return start !== null && end !== null && end >= start ? end - start : null;
}

export function buildAdapterHealth(runs: AdapterRunSample[]) {
  const groups = new Map<string, AdapterRunSample[]>();
  for (const run of runs || []) {
    const adapterId = String(run.adapterId || "unknown").trim() || "unknown";
    const current = groups.get(adapterId) || [];
    current.push(run);
    groups.set(adapterId, current);
  }

  return [...groups.entries()].map(([adapterId, items]) => {
    const ordered = [...items].sort((left, right) =>
      String(right.requestedAt || "").localeCompare(String(left.requestedAt || ""))
    );
    const completed = ordered.filter((run) => run.status === "completed");
    const failed = ordered.filter((run) => run.status === "failed");
    const durations = ordered.map(durationMs).filter((value): value is number => value !== null);
    let consecutiveFailures = 0;
    for (const run of ordered) {
      if (run.status !== "failed") break;
      consecutiveFailures += 1;
    }
    const qaScores = ordered
      .map((run) => Number(run.manualQa?.score))
      .filter((value) => Number.isFinite(value));
    const coverages = ordered
      .map((run) => Number(run.manualQa?.validation?.minimumCoverage ?? run.manualQa?.coverage?.referenceDate))
      .filter((value) => Number.isFinite(value));
    const successRate = ordered.length ? Number(((completed.length / ordered.length) * 100).toFixed(1)) : 0;
    const averageDurationMs = durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : null;
    const latest = ordered[0] || null;
    const status = consecutiveFailures >= 2
      ? "degraded"
      : latest?.status === "failed"
        ? "attention"
        : successRate >= 90
          ? "healthy"
          : "attention";

    return {
      adapterId,
      fundTypes: [...new Set(ordered.map((run) => run.fundType).filter(Boolean))],
      tickers: [...new Set(ordered.map((run) => run.ticker).filter(Boolean))],
      parserVersions: [...new Set(ordered.map((run) => run.parserVersion).filter((value) => value !== null && value !== undefined))],
      status,
      runsAnalyzed: ordered.length,
      completedRuns: completed.length,
      failedRuns: failed.length,
      consecutiveFailures,
      successRate,
      averageDurationMs,
      averageQaScore: qaScores.length ? Number((qaScores.reduce((sum, value) => sum + value, 0) / qaScores.length).toFixed(1)) : null,
      averageCoverage: coverages.length ? Number((coverages.reduce((sum, value) => sum + value, 0) / coverages.length).toFixed(1)) : null,
      latestRun: latest ? {
        ticker: latest.ticker || null,
        status: latest.status || null,
        requestedAt: latest.requestedAt || null,
        finishedAt: latest.finishedAt || null,
        error: latest.error || null,
      } : null,
    };
  }).sort((left, right) => left.adapterId.localeCompare(right.adapterId));
}
