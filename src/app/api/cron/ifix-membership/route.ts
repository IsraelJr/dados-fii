import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
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
    const sync = await regulatoryDataService.syncIfixComposition("cron:ifix-membership");
    return NextResponse.json({ ok: true, sync }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("IFIX composition cron error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível sincronizar a composição oficial do IFIX." }, { status: 502 });
  }
}
