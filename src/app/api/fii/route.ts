import { NextResponse } from "next/server";
import { logObservabilityEvent } from "@/lib/observability";
import { normalizeTicker, regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE_SOURCE_LABEL = "Planilha de cotações Dados FII";

function headers() {
  return { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" };
}

export async function GET(req: Request) {
  const ticker = normalizeTicker(new URL(req.url).searchParams.get("ticker"));
  try {
    if (!ticker) {
      const quotes = await regulatoryDataService.getMarketQuotes();
      return NextResponse.json(quotes.map((quote) => ({
        ...quote,
        dataSources: { price: PRICE_SOURCE_LABEL, fund: "Dados cadastrais/dividendos não carregados nesta listagem" },
        marketDataSource: PRICE_SOURCE_LABEL,
        fundDataSource: null,
        marketDataUpdatedAt: new Date().toISOString(),
      })), { headers: headers() });
    }

    const item = await regulatoryDataService.getByTicker(ticker);
    if (!item) {
      await logObservabilityEvent({ type: "fii_lookup", ok: false, statusCode: 404, ticker, error: "FII não encontrado", source: "api/fii" });
      return NextResponse.json({ error: "FII não encontrado" }, { status: 404, headers: headers() });
    }
    await logObservabilityEvent({
      type: "fii_lookup",
      ok: true,
      statusCode: 200,
      ticker,
      source: "api/fii",
      metadata: { fundKind: item.fundKind, currentVersion: item.regulatoryMeta.currentVersion, cache: item.regulatoryMeta.cache },
    });
    return NextResponse.json(item, { headers: headers() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar FII";
    if (ticker) await logObservabilityEvent({ type: "fii_lookup", ok: false, statusCode: 500, ticker, error: message, source: "api/fii" });
    return NextResponse.json({ error: message }, { status: 500, headers: headers() });
  }
}
