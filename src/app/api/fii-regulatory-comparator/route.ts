import { NextRequest, NextResponse } from "next/server";
import { compareRegulatoryFunds } from "@/lib/regulatoryComparator";
import { getRegulatoryReportInput } from "@/lib/regulatoryService";
import { normalizeIngestionTicker } from "@/lib/fiiIngestionConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function parseTickers(req: NextRequest) {
  const repeated = req.nextUrl.searchParams.getAll("ticker");
  const compact = String(req.nextUrl.searchParams.get("tickers") || "")
    .split(/[\s,;|]+/)
    .filter(Boolean);
  return [...new Set([...repeated, ...compact]
    .map(normalizeIngestionTicker)
    .filter(Boolean))];
}

export async function GET(req: NextRequest) {
  try {
    const tickers = parseTickers(req);
    if (tickers.length < 2) {
      return reply({ ok: false, error: "Informe de dois a cinco tickers para comparação." }, 400);
    }
    if (tickers.length > 5) {
      return reply({ ok: false, error: "Compare no máximo cinco fundos por vez." }, 400);
    }

    const reports = await Promise.all(tickers.map((ticker) => getRegulatoryReportInput(ticker)));
    const available = reports.filter((item) => item.reportAvailable && item.fund && item.insights);
    const unavailable = reports
      .filter((item) => !item.reportAvailable)
      .map((item) => ({ ticker: item.ticker, reason: item.reason }));

    if (available.length < 2) {
      return reply({
        ok: false,
        error: "São necessários ao menos dois fundos com relatório regulatório publicado.",
        unavailable,
      }, 409);
    }

    const comparison = compareRegulatoryFunds(available.map((item) => ({
      ticker: item.ticker,
      name: item.fund?.name || null,
      segment: item.fund?.segment || null,
      scores: item.insights?.scores || {},
      facts: item.insights?.facts || {},
    })));

    return reply({
      ok: true,
      requestedTickers: tickers,
      comparedTickers: comparison.funds.map((fund) => fund.ticker),
      unavailable,
      comparison,
      disclaimer: "Comparação regulatória determinística. Não constitui recomendação de investimento.",
    });
  } catch (error: any) {
    return reply({ ok: false, error: error?.message || "Falha ao comparar fundos." }, 400);
  }
}
