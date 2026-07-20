import { NextRequest, NextResponse } from "next/server";
import { ConcurrentAutomaticDividendSeriesService } from "@/lib/risk-lab/ConcurrentAutomaticDividendSeriesService";
import {
  RISK_LAB_COHORT_BACKTEST_RUN_ID,
  RiskLabCohortBacktestV2Service,
} from "@/lib/risk-lab/RiskLabCohortBacktestV2Service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const productionBacktestService = new RiskLabCohortBacktestV2Service({
  dividendSeries: new ConcurrentAutomaticDividendSeriesService({ yearConcurrency: 3 }),
});

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Pragma": "no-cache",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function authorizedExecution(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source");
  const runId = request.nextUrl.searchParams.get("runId");
  const release = request.nextUrl.searchParams.get("release");
  const deployedRelease = process.env.VERCEL_GIT_COMMIT_SHA || "";
  return process.env.VERCEL_ENV === "production"
    && source === "github-actions"
    && runId === RISK_LAB_COHORT_BACKTEST_RUN_ID
    && /^[a-f0-9]{40}$/.test(release || "")
    && release === deployedRelease;
}

export async function GET(request: NextRequest) {
  try {
    if (authorizedExecution(request)) {
      const evidence = await productionBacktestService.run();
      return response({
        ok: evidence.status === "passed",
        sprint: "3.5",
        status: evidence.status,
        evidence,
      }, evidence.status === "running" ? 202 : 200);
    }

    const evidence = await productionBacktestService.getPublicEvidence();
    return response({
      ok: evidence?.status === "passed",
      sprint: "3.5",
      status: evidence?.status || "pending",
      evidence,
    });
  } catch (error) {
    console.error(
      "Risk Lab cohort backtest v2 error",
      error instanceof Error ? error.message : "unknown",
    );
    return response({ ok: false, sprint: "3.5", status: "unavailable" }, 503);
  }
}
