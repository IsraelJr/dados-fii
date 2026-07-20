import type { PublicRiskLabCohortBacktestEvidence } from "@/types/riskLabCohortBacktest";

export const ADMIN_COHORT_TICKERS = [
  "DEVA11",
  "VSLH11",
  "KNCR11",
  "KNSC11",
  "MCCI11",
  "RBRY11",
] as const;

export type AdminCohortBacktestResponse =
  | {
      ok: true;
      enabled: boolean;
      runId: string;
      releaseCommit: string | null;
      tickers?: string[];
      action?: string;
      ticker?: string | null;
      persistedCases?: number;
      evidence: PublicRiskLabCohortBacktestEvidence | null;
    }
  | { ok: false; error: string };

async function requestJson(init?: RequestInit): Promise<AdminCohortBacktestResponse> {
  const response = await fetch("/api/admin/system/risk-lab/cohort-backtest", {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({
    ok: false,
    error: "Resposta inválida do servidor.",
  }));
  if (!response.ok) throw new Error(String(payload?.error || `Falha HTTP ${response.status}`));
  return payload as AdminCohortBacktestResponse;
}

export async function getCohortBacktestStatus() {
  return requestJson();
}

async function postStage(action: "initialize" | "case" | "finalize", ticker?: string) {
  return requestJson({
    method: "POST",
    body: JSON.stringify({ action, ...(ticker ? { ticker } : {}) }),
  });
}

export async function executeSegmentedCohortBacktest(
  onProgress?: (message: string, completed: number, total: number) => void,
) {
  const total = ADMIN_COHORT_TICKERS.length + 2;
  onProgress?.("Inicializando tentativa imutável…", 0, total);
  let response = await postStage("initialize");
  if (!response.ok) throw new Error(response.error);

  for (let index = 0; index < ADMIN_COHORT_TICKERS.length; index += 1) {
    const ticker = ADMIN_COHORT_TICKERS[index];
    onProgress?.(`Executando e persistindo ${ticker}…`, index + 1, total);
    response = await postStage("case", ticker);
    if (!response.ok) throw new Error(response.error);
  }

  onProgress?.("Consolidando métricas e gates…", total - 1, total);
  response = await postStage("finalize");
  if (!response.ok && response.evidence?.status !== "failed") throw new Error(response.error);
  onProgress?.("Execução concluída.", total, total);
  return response;
}
