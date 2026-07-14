import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { regulatoryDataService } from "@/services/regulatory";

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

    const result = await regulatoryDataService.getReportInput(ticker);
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

    return NextResponse.json({
      ok: true,
      found: true,
      reportAvailable: true,
      tier: "premium_input",
      service: {
        version: "regulatory-data-service-v1",
        dataVersion: result.fund.regulatoryData?.dataVersion || null,
        cacheHit: result.cache.hit,
      },
      ticker: result.ticker,
      fund: result.fund,
      deterministicAnalysis: result.insights,
      aiContract: {
        allowedSources: ["published_regulatory_data", "official_documents"],
        mustCiteFacts: true,
        mayInfer: true,
        mustLabelInferences: true,
        mayInventMissingData: false,
        outputSections: [
          "executiveSummary",
          "patrimonialTrend",
          "investorBase",
          "riskSignals",
          "officialDocuments",
          "bullCase",
          "bearCase",
          "monitoringPoints",
        ],
      },
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error?.message || "Erro ao preparar entrada do relatório Premium.",
    }, { status: 500 });
  }
}
