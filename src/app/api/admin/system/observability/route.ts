import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminSecurity";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = await requireAdmin(request, { scope: "system-observability", limit: 30 });
  if (!authorization.ok) return NextResponse.json({ ok: false, error: authorization.error }, { status: authorization.status });
  try {
    const observability = await regulatoryDataService.getObservability();
    return NextResponse.json({ ok: true, observability }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("System observability error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível consolidar a observabilidade." }, { status: 500 });
  }
}
