import { NextResponse } from "next/server";
import { riskLabProductionSmokeService } from "@/lib/risk-lab/RiskLabProductionSmokeService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    const evidence = await riskLabProductionSmokeService.getPublicEvidence();
    return response({
      ok: evidence?.status === "passed",
      sprint: "3.4",
      status: evidence?.status || "pending",
      evidence,
    });
  } catch (error) {
    console.error(
      "Risk Lab production smoke evidence error",
      error instanceof Error ? error.message : "unknown",
    );
    return response({ ok: false, sprint: "3.4", status: "unavailable" }, 503);
  }
}
