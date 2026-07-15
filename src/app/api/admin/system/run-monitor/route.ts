import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminSecurity";
import { AutomaticMonitorError } from "@/lib/monitor/AutomaticMonitor";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authorization = await requireAdmin(request, { scope: "run-monitor", limit: 5, windowMs: 60_000 });
  if (!authorization.ok) return NextResponse.json({ ok: false, error: authorization.error }, { status: authorization.status });
  try {
    const run = await regulatoryDataService.runAutomaticMonitor(authorization.identity.email);
    return NextResponse.json({ ok: true, run }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AutomaticMonitorError) return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    console.error("Automatic monitor error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "O monitor automático falhou." }, { status: 500 });
  }
}
