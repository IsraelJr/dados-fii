import { NextResponse } from "next/server";
import { logObservabilityEvent } from "@/lib/observability";
import { normalizeTicker, regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const correlationId = req.headers.get("x-correlation-id") || undefined;
  try {
    const body = await req.json().catch(() => ({}));
    const tickers = Array.isArray(body?.tickers)
      ? Array.from(new Set<string>(body.tickers.map(normalizeTicker).filter(Boolean))).slice(0, 80)
      : [];
    if (!tickers.length) return NextResponse.json({ ok: true, items: {}, errors: {} });
    const result = await regulatoryDataService.getMany(tickers);
    await logObservabilityEvent({
      type: "fii_batch_lookup",
      ok: true,
      statusCode: 200,
      tickers,
      source: "api/fii/batch",
      correlationId,
      metadata: { requested: result.requested, found: result.found, missing: Object.keys(result.errors).length },
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar FIIs em lote.";
    await logObservabilityEvent({ type: "fii_batch_lookup", ok: false, statusCode: 500, error: message, source: "api/fii/batch", correlationId });
    return NextResponse.json({ ok: false, error: "Não foi possível consultar os fundos." }, { status: 500 });
  }
}
