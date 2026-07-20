import { NextRequest } from "next/server";
import { adminJson, authorizeAdminRequest } from "@/lib/adminApi";
import { ConcurrentAutomaticDividendSeriesService } from "@/lib/risk-lab/ConcurrentAutomaticDividendSeriesService";
import {
  RISK_LAB_COHORT_BACKTEST_RUN_ID,
  RiskLabCohortBacktestV2Service,
} from "@/lib/risk-lab/RiskLabCohortBacktestV2Service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const riskLabCohortBacktestV2Service = new RiskLabCohortBacktestV2Service({
  dividendSeries: new ConcurrentAutomaticDividendSeriesService({ yearConcurrency: 3 }),
});

function activeProductionRelease() {
  const release = process.env.VERCEL_GIT_COMMIT_SHA || "";
  if (process.env.VERCEL_ENV !== "production") return null;
  return /^[a-f0-9]{40}$/.test(release) ? release : null;
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(
    request,
    "risk-lab-cohort-backtest-status",
    { limit: 30, windowMs: 60_000 },
  );
  if (authorization.rejection) return authorization.rejection;

  try {
    const releaseCommit = activeProductionRelease();
    const evidence = await riskLabCohortBacktestV2Service.getPublicEvidence();
    return adminJson({
      ok: true,
      enabled: Boolean(releaseCommit),
      runId: RISK_LAB_COHORT_BACKTEST_RUN_ID,
      releaseCommit,
      evidence,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Falha ao carregar o status do backtest da coorte.";
    console.error("Risk Lab cohort v2 admin status error", {
      actor: authorization.identity.email,
      message,
    });
    return adminJson({ ok: false, error: message }, 500);
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdminRequest(
    request,
    "risk-lab-cohort-backtest-execute",
    { limit: 3, windowMs: 30 * 60_000 },
  );
  if (authorization.rejection) return authorization.rejection;

  const releaseCommit = activeProductionRelease();
  if (!releaseCommit) {
    return adminJson({
      ok: false,
      error: "A execução da Sprint 3.5 só é permitida no deployment ativo de Produção.",
    }, 503);
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();
  if (action !== "execute") {
    return adminJson({ ok: false, error: "Ação inválida. Use execute." }, 400);
  }

  try {
    console.info("Risk Lab cohort v2 admin execution requested", {
      actor: authorization.identity.email,
      releaseCommit,
      runId: RISK_LAB_COHORT_BACKTEST_RUN_ID,
    });
    const evidence = await riskLabCohortBacktestV2Service.run();
    return adminJson({
      ok: true,
      enabled: true,
      runId: RISK_LAB_COHORT_BACKTEST_RUN_ID,
      releaseCommit,
      evidence,
    }, evidence.status === "running" ? 202 : 200);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Falha ao executar o backtest da coorte.";
    console.error("Risk Lab cohort v2 admin execution error", {
      actor: authorization.identity.email,
      releaseCommit,
      message,
    });
    const status = /já está em execução/i.test(message) ? 409 : 500;
    return adminJson({ ok: false, error: message }, status);
  }
}
