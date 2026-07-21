import { NextRequest, NextResponse } from "next/server";
import {
  RISK_LAB_COHORT_BACKTEST_RUN_ID,
} from "@/lib/risk-lab/RiskLabCohortBacktestV2Service";
import { riskLabCohortIdentityService } from "@/lib/risk-lab/RiskLabCohortIdentityService";
import {
  SEGMENTED_COHORT_TICKERS,
  segmentedRiskLabCohortBacktestService,
} from "@/lib/risk-lab/SegmentedRiskLabCohortBacktestService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

function executionParameters(request: NextRequest) {
  return {
    source: request.nextUrl.searchParams.get("source"),
    runId: request.nextUrl.searchParams.get("runId"),
    release: request.nextUrl.searchParams.get("release"),
    action: request.nextUrl.searchParams.get("action"),
    ticker: request.nextUrl.searchParams.get("ticker")?.toUpperCase() || null,
  };
}

function authorizedExecution(request: NextRequest) {
  const parameters = executionParameters(request);
  const deployedRelease = process.env.VERCEL_GIT_COMMIT_SHA || "";
  return {
    parameters,
    authorized: process.env.VERCEL_ENV === "production"
      && parameters.source === "github-actions"
      && parameters.runId === RISK_LAB_COHORT_BACKTEST_RUN_ID
      && /^[a-f0-9]{40}$/.test(parameters.release || "")
      && parameters.release === deployedRelease,
  };
}

export async function GET(request: NextRequest) {
  try {
    const execution = authorizedExecution(request);
    const attemptedExecution = Boolean(execution.parameters.source || execution.parameters.action || execution.parameters.release);
    if (attemptedExecution && !execution.authorized) {
      return response({ ok: false, sprint: "3.5", status: "release-mismatch" }, 409);
    }

    if (execution.authorized) {
      const { action, ticker } = execution.parameters;
      if (action === "identities") {
        const identities = await riskLabCohortIdentityService.list();
        return response({
          ok: true,
          sprint: "3.5",
          status: "ready",
          releaseCommit: process.env.VERCEL_GIT_COMMIT_SHA,
          identities,
        });
      }
      if (action === "initialize") {
        const evidence = await segmentedRiskLabCohortBacktestService.initialize();
        return response({ ok: true, sprint: "3.5", status: evidence.status, evidence });
      }
      if (action === "case") {
        if (!ticker || !SEGMENTED_COHORT_TICKERS.includes(ticker)) {
          return response({ ok: false, sprint: "3.5", status: "invalid-ticker" }, 400);
        }
        const evidence = await segmentedRiskLabCohortBacktestService.runTicker(ticker);
        const caseResult = evidence.cases.find((item) => item.ticker === ticker) || null;
        return response({
          ok: Boolean(caseResult),
          sprint: "3.5",
          status: evidence.status,
          ticker,
          case: caseResult,
          persistedCases: evidence.cases.length,
          evidence,
        });
      }
      if (action === "finalize") {
        const evidence = await segmentedRiskLabCohortBacktestService.finalize();
        return response({
          ok: evidence.status === "passed",
          sprint: "3.5",
          status: evidence.status,
          evidence,
        });
      }
      return response({ ok: false, sprint: "3.5", status: "invalid-action" }, 400);
    }

    const evidence = await segmentedRiskLabCohortBacktestService.getPublicEvidence();
    return response({
      ok: evidence?.status === "passed",
      sprint: "3.5",
      status: evidence?.status || "pending",
      evidence,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("Risk Lab segmented cohort error", message);
    return response({
      ok: false,
      sprint: "3.5",
      status: /execução|inicializado|inicializada/i.test(message) ? "busy" : "unavailable",
      error: message.slice(0, 300),
    }, /execução|inicializado|inicializada/i.test(message) ? 409 : 503);
  }
}
