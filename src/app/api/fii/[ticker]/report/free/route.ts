import { NextResponse } from "next/server";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ ticker: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { ticker } = await context.params;
    const report = await regulatoryDataService.getFreeReport(ticker);
    if (!report) return NextResponse.json({ ok: false, error: "Fundo não encontrado." }, { status: 404 });
    return NextResponse.json(
      { ok: true, report },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } },
    );
  } catch (error) {
    console.error("Free fund report error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível gerar o relatório gratuito." }, { status: 500 });
  }
}
