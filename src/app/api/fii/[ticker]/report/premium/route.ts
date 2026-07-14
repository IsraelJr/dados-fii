import { NextRequest, NextResponse } from "next/server";
import { PremiumReportError } from "@/lib/reports/PremiumReportEngine";
import { requirePremium } from "@/lib/premiumSecurity";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ ticker: string }> };

function requestKey(request: NextRequest, uid: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return regulatoryDataService.requestFingerprint(["premium", uid, ip]);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authorization = await requirePremium(request);
  if (!authorization.ok) {
    return NextResponse.json({ ok: false, error: authorization.error }, {
      status: authorization.status,
      headers: authorization.retryAfter ? { "Retry-After": String(authorization.retryAfter) } : undefined,
    });
  }
  try {
    const { ticker } = await context.params;
    const report = await regulatoryDataService.getPremiumReport(ticker, { requestKey: requestKey(request, authorization.identity.uid) });
    if (!report) return NextResponse.json({ ok: false, error: "Fundo não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true, report, access: { plan: authorization.identity.plan } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof PremiumReportError) return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    console.error("Premium fund report error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível gerar o relatório Premium." }, { status: 500 });
  }
}
