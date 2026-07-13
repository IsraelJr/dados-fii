import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { getRegulatoryReportInput } from "@/lib/regulatoryService";
import { buildPremiumRegulatoryReport } from "@/lib/regulatoryPremiumReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const ticker = String(req.nextUrl.searchParams.get("ticker") || "").trim();
    if (!ticker) {
      return NextResponse.json({ ok: false, error: "Informe o ticker." }, { status: 400 });
    }

    const result = await getRegulatoryReportInput(ticker);
    if (!result.found) {
      return NextResponse.json({ ok: false, found: false, ticker: result.ticker }, { status: 404 });
    }
    if (!result.reportAvailable || !result.insights || !result.fund) {
      return NextResponse.json({
        ok: true,
        found: true,
        ticker: result.ticker,
        reportAvailable: false,
        reason: result.reason || "regulatory_data_not_published",
      });
    }

    const report = buildPremiumRegulatoryReport({
      ticker: result.ticker,
      fund: result.fund,
      deterministicAnalysis: result.insights,
    });

    return NextResponse.json({
      ok: true,
      found: true,
      reportAvailable: true,
      tier: "premium_preview",
      report,
      publication: {
        allowed: false,
        reason: "human_review_required",
      },
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error?.message || "Erro ao gerar preview do relatório Premium.",
    }, { status: 500 });
  }
}
