import { NextRequest, NextResponse } from "next/server";
import { compareRegulatoryFunds } from "@/lib/regulatoryComparator";
import { normalizeIngestionTicker } from "@/lib/fiiIngestionConfig";
import { regulatoryDataService } from "@/services/regulatory";
import {
  registeredUserErrorStatus,
  requireRegisteredUserAccess,
} from "@/lib/registeredUserAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function parseTickers(value: unknown) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[\s,;|]+/);
  return [...new Set(raw.map(normalizeIngestionTicker).filter(Boolean))];
}

export async function GET() {
  return reply({
    ok: false,
    error: "Acesso direto não permitido. Use uma sessão autenticada do site.",
  }, 405);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, any>));
    const access = await requireRegisteredUserAccess({
      email: body?.email,
      sessionToken: body?.sessionToken,
    });
    const tickers = parseTickers(body?.tickers);
    if (tickers.length < 2) {
      return reply({ ok: false, error: "Informe de dois a cinco tickers para comparação." }, 400);
    }
    if (tickers.length > 5) {
      return reply({ ok: false, error: "Compare no máximo cinco fundos por vez." }, 400);
    }

    const reports = await regulatoryDataService.getReportInputs(tickers);
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
      access: { email: access.email },
      service: {
        version: "regulatory-data-service-v1",
        cacheHits: reports.filter((item) => item.cache.hit).length,
      },
      requestedTickers: tickers,
      comparedTickers: comparison.funds.map((fund) => fund.ticker),
      unavailable,
      comparison,
      disclaimer: "Comparação regulatória determinística. Não constitui recomendação de investimento.",
    });
  } catch (error: any) {
    return reply({
      ok: false,
      error: error?.message || "Falha ao comparar fundos.",
    }, registeredUserErrorStatus(error));
  }
}
