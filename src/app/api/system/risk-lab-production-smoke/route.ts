import { NextRequest, NextResponse } from "next/server";
import {
  RISK_LAB_PRODUCTION_SMOKE_RUN_ID,
  riskLabProductionSmokeService,
} from "@/lib/risk-lab/RiskLabProductionSmokeService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const AUTOMATIC_TRIGGER_EXPIRES_AT = "2026-07-21T06:00:00.000Z";

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

function automaticTrigger(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId") || "";
  const release = request.nextUrl.searchParams.get("release") || "";
  const source = request.nextUrl.searchParams.get("source") || "";
  return {
    requested: Boolean(runId || release || source),
    valid: Date.now() <= Date.parse(AUTOMATIC_TRIGGER_EXPIRES_AT)
      && process.env.VERCEL_ENV === "production"
      && runId === RISK_LAB_PRODUCTION_SMOKE_RUN_ID
      && release.length === 40
      && release === process.env.VERCEL_GIT_COMMIT_SHA
      && source === "github-actions",
  };
}

export async function GET(request: NextRequest) {
  const trigger = automaticTrigger(request);
  if (!trigger.requested) {
    try {
      const evidence = await riskLabProductionSmokeService.getPublicEvidence();
      return response({
        ok: evidence?.status === "passed",
        sprint: "3.4",
        status: evidence?.status || "pending",
        evidence,
      });
    } catch (error) {
      console.error("Risk Lab production smoke evidence error", error instanceof Error ? error.message : "unknown");
      return response({ ok: false, sprint: "3.4", status: "unavailable" }, 503);
    }
  }

  if (!trigger.valid) {
    return response({
      ok: false,
      sprint: "3.4",
      status: "deployment_not_ready",
      error: "O commit solicitado ainda não é o deployment ativo de Produção ou o gatilho expirou.",
    }, 409);
  }

  try {
    const evidence = await riskLabProductionSmokeService.run();
    return response({
      ok: evidence.status === "passed",
      sprint: evidence.sprint,
      status: evidence.status,
      runId: evidence.runId,
      releaseCommit: evidence.releaseCommit,
      blockers: evidence.blockers,
      evidenceHash: evidence.evidenceHash,
      evidence,
    }, evidence.status === "failed" ? 422 : 200);
  } catch (error) {
    console.error("Risk Lab production smoke error", error instanceof Error ? error.message : "unknown");
    return response({ ok: false, sprint: "3.4", status: "failed", error: "O smoke automatizado da Sprint 3.4 falhou." }, 500);
  }
}
