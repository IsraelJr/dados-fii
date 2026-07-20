import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { phase2ClosureService } from "@/lib/phase2/Phase2ClosureService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN_HASH = "00618c5927e1412f930fa8fadacb87752871c2239642d7b51fb4c2d0adde71de";
const PRIOR_RUN_ID = "catalog-20260719204643291-c845f739";
const PRIOR_SOURCE_HASH = "c845f73907160e2814fefde0f8e199925c4268e40239c2f0da86bd4804c376cb";
const PRIOR_PLAN_HASH = "e9a0a763fc71dcf7ffac34871a9142e19776c036547aac727c307ea93ea082b6";
const EXPIRES_AT = Date.parse("2026-07-21T00:00:00.000Z");

function validOneTimeToken(request: NextRequest) {
  const received = request.headers.get("x-phase2-revalidate-token") || "";
  if (!received) return false;
  const actual = createHash("sha256").update(received, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(TOKEN_HASH);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

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

export async function POST(request: NextRequest) {
  if (Date.now() > EXPIRES_AT) return NextResponse.json({ ok: false, error: "Disparador temporário expirado." }, { status: 410 });
  if (!validOneTimeToken(request)) return NextResponse.json({ ok: false, error: "Disparador não autorizado." }, { status: 401 });

  const before = await phase2ClosureService.getStatus();
  const exactCatalog = before?.runId === PRIOR_RUN_ID
    && before.catalog?.sourceHash === PRIOR_SOURCE_HASH
    && before.catalog?.planHash === PRIOR_PLAN_HASH;
  const retryableSmoke = Number(before?.schemaVersion) === 2 && before?.status === "failed" && before.phase === "production-smoke";
  const migratableSmoke = Number(before?.schemaVersion) === 1 && before?.status === "passed" && before.phase === "complete";

  if (!exactCatalog || (!retryableSmoke && !migratableSmoke)) {
    return NextResponse.json({
      ok: before?.status === "passed" && Number(before?.schemaVersion) >= 2,
      status: before?.status,
      phase: before?.phase,
      failure: before?.status === "failed" ? before.error : null,
    }, {
      status: before?.status === "passed" && Number(before?.schemaVersion) >= 2 ? 200 : 409,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  const state = await phase2ClosureService.advance("one-time:phase2-closure-v2");
  return NextResponse.json({
    ok: state.status === "passed",
    status: state.status,
    phase: state.phase,
    runId: state.runId,
    blockers: state.blockers,
    evidenceHash: state.evidenceHash,
    failure: state.status === "failed" ? state.error : null,
  }, {
    status: state.status === "failed" ? 500 : state.status === "blocked" ? 409 : 200,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
