import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { AutomaticMonitorError } from "@/lib/monitor/AutomaticMonitor";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const run = await regulatoryDataService.runAutomaticMonitor("cron:system-monitor");
    return NextResponse.json({ ok: true, run }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AutomaticMonitorError) return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    console.error("System monitor cron error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "Execução automática do monitor falhou." }, { status: 500 });
  }
}
