import { NextRequest, NextResponse } from "next/server";
import { getRegulatoryReportInput } from "@/lib/regulatoryService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

    return NextResponse.json({
      ok: true,
      found: true,
      reportAvailable: true,
      tier: "free",
      ticker: result.ticker,
      fund: {
        code: result.fund.code,
        name: result.fund.name,
        sector: result.fund.sector,
        segment: result.fund.segment,
        price: result.fund.price,
        lastDividend: result.fund.lastDividend,
        lastDividendDate: result.fund.lastDividendDate,
      },
      regulatory: {
        status: result.fund.regulatoryData?.status,
        source: result.fund.regulatoryData?.source,
        latestSnapshot: result.fund.regulatoryData?.latestSnapshot,
        quality: result.fund.regulatoryData?.quality,
        documentsCount: result.fund.regulatoryData?.documents.length || 0,
        publication: result.fund.regulatoryData?.publication,
      },
      report: result.insights.freeReport,
      scores: {
        overall: result.insights.scores.overall,
        dataQuality: result.insights.scores.dataQuality,
        stability: result.insights.scores.stability,
        risk: result.insights.scores.risk,
      },
      methodology: result.insights.generatedBy,
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error?.message || "Erro ao gerar relatório regulatório gratuito.",
    }, { status: 500 });
  }
}
