import { NextResponse } from "next/server";
import { AIInsightsError } from "@/lib/ai/AIInsightsEngine";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ ticker: string }> };

function requestKey(request: Request) {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || null;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { ticker } = await context.params;
    const insights = await regulatoryDataService.getAIInsights(ticker, { requestKey: requestKey(request) });
    if (!insights) return NextResponse.json({ ok: false, error: "Fundo não encontrado." }, { status: 404 });
    return NextResponse.json(
      { ok: true, insights },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" } },
    );
  } catch (error) {
    if (error instanceof AIInsightsError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    console.error("Fund insights error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível gerar os insights." }, { status: 500 });
  }
}
