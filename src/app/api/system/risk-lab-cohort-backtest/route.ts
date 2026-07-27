import { NextRequest, NextResponse } from "next/server";
import {
  RISK_LAB_COHORT_BACKTEST_RUN_ID,
} from "@/lib/risk-lab/RiskLabCohortBacktestV2Service";
import { decidePublicEvidenceStatus } from "@/lib/risk-lab/PublicRiskLabEvidenceContract";
import { segmentedRiskLabCohortBacktestService } from "@/lib/risk-lab/SegmentedRiskLabCohortBacktestService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

function deployedRelease() {
  const release = process.env.VERCEL_GIT_COMMIT_SHA || "";
  return /^[a-f0-9]{40}$/.test(release) ? release : null;
}

export async function GET(request: NextRequest) {
  try {
    const forbiddenMutation = ["source", "runId", "action", "ticker"]
      .some((parameter) => request.nextUrl.searchParams.has(parameter));
    if (forbiddenMutation) {
      return response({
        ok: false,
        sprint: "3.5",
        status: "read-only",
        error: "Este endpoint publica evidências e não executa operações.",
      }, 405);
    }

    const evidence = await segmentedRiskLabCohortBacktestService.getPublicEvidence();
    if (!evidence) {
      return response({ ok: false, sprint: "3.5", status: "not-found", evidence: null }, 404);
    }

    const activeRelease = deployedRelease();
    const decision = decidePublicEvidenceStatus(
      evidence,
      activeRelease,
      RISK_LAB_COHORT_BACKTEST_RUN_ID,
      request.nextUrl.searchParams.get("release"),
    );
    if (decision.status === "release-mismatch") {
      return response({
        ok: false,
        sprint: "3.5",
        status: "release-mismatch",
        releaseCommit: evidence.releaseCommit,
        activeRelease,
        evidence,
      }, 409);
    }
    if (decision.status === "superseded") {
      return response({
        ok: false,
        sprint: "3.5",
        status: "superseded",
        evidence,
      }, 409);
    }
    return response({
      ok: decision.ok,
      sprint: "3.5",
      status: decision.status,
      evidence,
    }, decision.statusCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida.";
    console.error("Risk Lab public evidence unavailable", { message });
    return response({
      ok: false,
      sprint: "3.5",
      status: "unavailable",
      error: "Evidência temporariamente indisponível.",
    }, 503);
  }
}
