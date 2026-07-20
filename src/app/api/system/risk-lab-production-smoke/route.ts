import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { riskLabProductionSmokeService } from "@/lib/risk-lab/RiskLabProductionSmokeService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ONE_TIME_TOKEN_HASH = "8142bee94ca8e3f123e37e7ac2f2c08cbabcf86e3bb9351bce807071ba81ade1";
const ONE_TIME_TOKEN_EXPIRES_AT = "2026-07-21T06:00:00.000Z";

function validOneTimeToken(request: NextRequest) {
  if (Date.now() > Date.parse(ONE_TIME_TOKEN_EXPIRES_AT)) return false;
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!token) return false;
  const received = Buffer.from(createHash("sha256").update(token, "utf8").digest("hex"));
  const expected = Buffer.from(ONE_TIME_TOKEN_HASH);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

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

export async function GET(request: NextRequest) {
  const hasToken = request.nextUrl.searchParams.has("token");
  if (!hasToken) {
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

  if (process.env.VERCEL_ENV !== "production") {
    return response({ ok: false, error: "O smoke da Sprint 3.4 só pode executar em Produção." }, 409);
  }
  if (!validOneTimeToken(request)) {
    return response({ ok: false, error: "Token temporário inválido ou expirado." }, 401);
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
