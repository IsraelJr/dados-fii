import { NextResponse } from "next/server";
import { phase2ClosureService } from "@/lib/phase2/Phase2ClosureService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const evidence = await phase2ClosureService.getPublicEvidence();
    if (!evidence) {
      return NextResponse.json({ ok: true, sprint: "2.12", status: "pending", evidence: null }, {
        headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
      });
    }
    return NextResponse.json({ ok: evidence.status === "passed", sprint: "2.12", status: evidence.status, evidence }, {
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (error) {
    console.error("Phase 2 closure evidence error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, sprint: "2.12", status: "unavailable" }, { status: 503 });
  }
}
