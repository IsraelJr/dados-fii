import { NextResponse } from "next/server";
import { logObservabilityEvent } from "@/lib/observability";
import { regulatoryDataService } from "@/lib/regulatoryDataService";
import { encodeFiiCursor, parseFiiQuery } from "@/lib/http/FiiQueryContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE_SOURCE_LABEL = "Planilha de cotações Dados FII";

function headers() {
  return { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" };
}

export async function GET(req: Request) {
  const correlationId = req.headers.get("x-correlation-id") || undefined;
  const query = parseFiiQuery(new URL(req.url));
  if (!query.ok) {
    return NextResponse.json(
      { error: query.error, code: query.code },
      { status: query.status, headers: headers() },
    );
  }
  const ticker = query.mode === "detail" ? query.ticker : null;
  try {
    if (query.mode === "list") {
      const quotes = await regulatoryDataService.getMarketQuotes();
      const page = quotes.slice(query.offset, query.offset + query.limit);
      const items = page.map((quote) => ({
        ...quote,
        dataSources: { price: PRICE_SOURCE_LABEL, fund: "Dados cadastrais/dividendos não carregados nesta listagem" },
        marketDataSource: PRICE_SOURCE_LABEL,
        fundDataSource: null,
        marketDataUpdatedAt: new Date().toISOString(),
      }));
      const nextOffset = query.offset + page.length;
      return NextResponse.json({
        items,
        pagination: {
          limit: query.limit,
          count: items.length,
          nextCursor: nextOffset < quotes.length ? encodeFiiCursor(nextOffset) : null,
          hasMore: nextOffset < quotes.length,
        },
      }, { headers: headers() });
    }

    const item = await regulatoryDataService.getByTicker(query.ticker);
    if (!item) {
      await logObservabilityEvent({ type: "fii_lookup", ok: false, statusCode: 404, ticker: query.ticker, error: "FII não encontrado", source: "api/fii", correlationId });
      return NextResponse.json({ error: "FII não encontrado" }, { status: 404, headers: headers() });
    }
    await logObservabilityEvent({
      type: "fii_lookup",
      ok: true,
      statusCode: 200,
      ticker: query.ticker,
      source: "api/fii",
      correlationId,
      metadata: { fundKind: item.fundKind, currentVersion: item.regulatoryMeta.currentVersion, cache: item.regulatoryMeta.cache },
    });
    return NextResponse.json(item, { headers: headers() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar FII";
    if (ticker) await logObservabilityEvent({ type: "fii_lookup", ok: false, statusCode: 500, ticker, error: message, source: "api/fii", correlationId });
    return NextResponse.json({ error: "Não foi possível consultar o fundo." }, { status: 500, headers: headers() });
  }
}
