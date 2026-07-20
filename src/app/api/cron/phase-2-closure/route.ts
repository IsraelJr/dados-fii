import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { phase2ClosureService } from "@/lib/phase2/Phase2ClosureService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function validSecret(request: NextRequest) {
  const expected = String(process.env.CRON_SECRET || "");
  const authorization = request.headers.get("authorization") || "";
  const received = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function GET(request: NextRequest) {
  if (!validSecret(request)) return NextResponse.json({ ok: false, error: "Cron não autorizado." }, { status: 401 });
  try {
    const startedAt = Date.now();
    let stepsAttempted = 0;
    let state = await phase2ClosureService.advance();
    stepsAttempted += 1;
    for (let step = 1; step < 3; step += 1) {
      if (["passed", "blocked", "failed"].includes(state.status)) break;
      if (Date.now() - startedAt >= 240_000) break;
      state = await phase2ClosureService.advance();
      stepsAttempted += 1;
    }
    return NextResponse.json({
      ok: state.status !== "failed" && state.status !== "blocked",
      sprint: state.sprint,
      status: state.status,
      phase: state.phase,
      runId: state.runId,
      blockers: state.blockers,
      evidenceHash: state.evidenceHash,
      stepsAttempted,
    }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch (error) {
    console.error("Phase 2 closure cron error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "A etapa automática da Sprint 2.12 falhou." }, { status: 500 });
  }
}
