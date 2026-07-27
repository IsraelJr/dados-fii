import { NextRequest, NextResponse } from "next/server";
import { diagnoseMarketBenchmarks } from "@/lib/marketBenchmarks";
import { internalAuthError, requireAdminOrCron } from "@/lib/security/InternalRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function wantsTextOutput(req: NextRequest, body?: any) {
  const format = String(req.nextUrl.searchParams.get("format") || body?.format || "").toLowerCase();
  const download = String(req.nextUrl.searchParams.get("download") || body?.download || "").toLowerCase();
  return format === "txt" || format === "text" || download === "true" || download === "1";
}

function wantsAttachment(req: NextRequest, body?: any) {
  const attachment = String(req.nextUrl.searchParams.get("attachment") || body?.attachment || "").toLowerCase();
  return attachment === "true" || attachment === "1";
}

function textOutputResponse(filename: string, payload: unknown, attachment = false) {
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `${attachment ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const authorization = await requireAdminOrCron(req, { scope: "diagnose-market-benchmarks" });
    if (!authorization.ok) return internalAuthError(authorization);

    const payload = await diagnoseMarketBenchmarks();

    if (wantsTextOutput(req)) {
      return textOutputResponse(`diagnose-market-benchmarks-${new Date().toISOString().slice(0, 10)}.txt`, payload, wantsAttachment(req));
    }

    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao diagnosticar benchmarks." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await requireAdminOrCron(req, { scope: "diagnose-market-benchmarks" });
    if (!authorization.ok) return internalAuthError(authorization);
    const body = await req.json().catch(() => ({}));

    const payload = await diagnoseMarketBenchmarks();

    if (wantsTextOutput(req, body)) {
      return textOutputResponse(`diagnose-market-benchmarks-${new Date().toISOString().slice(0, 10)}.txt`, payload, wantsAttachment(req, body));
    }

    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao diagnosticar benchmarks." }, { status: 500 });
  }
}
