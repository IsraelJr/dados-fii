import { NextRequest, NextResponse } from "next/server";
import { AIInsightsError } from "@/lib/ai/AIInsightsEngine";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestKey(request: NextRequest) {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const ticker = String(body?.ticker || "").trim().toUpperCase();
    if (!ticker) return NextResponse.json({ error: "Ticker não fornecido" }, { status: 400 });
    const insights = await regulatoryDataService.getAIInsights(ticker, { requestKey: requestKey(request) });
    if (!insights) return NextResponse.json({ error: "Fundo não encontrado" }, { status: 404 });

    return NextResponse.json({
      ticker: insights.ticker,
      summary: insights.executiveSummary,
      sources: insights.sources.map((source) => source.provider),
      insights,
      engine: "AIInsightsEngine",
    });
  } catch (error) {
    if (error instanceof AIInsightsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("FII summary compatibility error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Não foi possível gerar o resumo do FII." }, { status: 500 });
  }
}
