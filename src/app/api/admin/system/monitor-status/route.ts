import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminSecurity";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = await requireAdmin(request, { scope: "monitor-status", limit: 30 });
  if (!authorization.ok) return NextResponse.json({ ok: false, error: authorization.error }, { status: authorization.status });
  try {
    const monitor = await regulatoryDataService.getMonitorStatus(20);
    return NextResponse.json({ ok: true, monitor }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Monitor status error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível carregar o monitor." }, { status: 500 });
  }
}
