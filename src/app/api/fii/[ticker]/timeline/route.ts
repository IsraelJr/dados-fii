import { NextRequest, NextResponse } from "next/server";
import { TIMELINE_TYPES } from "@/lib/regulatory/RegulatoryTimeline";
import { normalizeTicker, regulatoryDataService } from "@/lib/regulatoryDataService";
import type { RegulatoryTimelineType } from "@/types/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ ticker: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { ticker: rawTicker } = await context.params;
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) return NextResponse.json({ ok: false, error: "Ticker inválido." }, { status: 400 });

  const requestedTypes = String(req.nextUrl.searchParams.get("types") || "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is RegulatoryTimelineType => TIMELINE_TYPES.includes(value as RegulatoryTimelineType));
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 20), 1), 100);
  const cursor = req.nextUrl.searchParams.get("cursor");

  try {
    const timeline = await regulatoryDataService.getTimeline(ticker, { types: requestedTypes, limit, cursor });
    if (!timeline) return NextResponse.json({ ok: false, error: "Fundo não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true, timeline }, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Erro ao carregar a timeline regulatória." }, { status: 500 });
  }
}
