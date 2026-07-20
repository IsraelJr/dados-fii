import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { phase2ClosureService } from "@/lib/phase2/Phase2ClosureService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN_HASH = "9dddc8a0da82530520432829059d922af5c6e67fc2f21ee72b4a23da831e6004";
const PRIOR_EVIDENCE_HASH = "48560d2b025608e9122fad39bcbd11ecfae056f8169030b45f3173fafed83c1c";
const PRIOR_RUN_ID = "catalog-20260719204643291-c845f739";
const EXPIRES_AT = Date.parse("2026-07-21T00:00:00.000Z");

function validToken(request: NextRequest) {
  const received = request.headers.get("x-phase2-revalidate-token") || "";
  if (!received) return false;
  const actual = createHash("sha256").update(received, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(TOKEN_HASH);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function POST(request: NextRequest) {
  if (Date.now() > EXPIRES_AT) {
    return NextResponse.json({ ok: false, error: "Disparador temporário expirado." }, { status: 410 });
  }
  if (!validToken(request)) {
    return NextResponse.json({ ok: false, error: "Disparador não autorizado." }, { status: 401 });
  }

  const before = await phase2ClosureService.getStatus();
  if (Number(before?.schemaVersion) >= 2) {
    return NextResponse.json({ ok: before?.status === "passed", status: before?.status, phase: before?.phase }, {
      status: before?.status === "passed" ? 200 : 409,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  if (
    before?.status !== "passed"
    || before.runId !== PRIOR_RUN_ID
    || before.evidenceHash !== PRIOR_EVIDENCE_HASH
    || !before.catalog
  ) {
    return NextResponse.json({ ok: false, error: "A evidência anterior não permite revalidar apenas o smoke." }, { status: 409 });
  }

  const state = await phase2ClosureService.advance("one-time:phase2-closure-v2");
  return NextResponse.json({
    ok: state.status === "passed",
    status: state.status,
    phase: state.phase,
    runId: state.runId,
    blockers: state.blockers,
    evidenceHash: state.evidenceHash,
  }, {
    status: state.status === "failed" ? 500 : state.status === "blocked" ? 409 : 200,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
