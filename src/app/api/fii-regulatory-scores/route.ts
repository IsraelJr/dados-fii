import { NextRequest, NextResponse } from "next/server";
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

export async function GET() {
  return reply({
    ok: false,
    error: "Acesso direto não permitido. Use uma sessão autenticada do site.",
  }, 405);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const access = await requireRegisteredUserAccess({
      email: body.email,
      sessionToken: body.sessionToken,
    });
    const ticker = String(body.ticker || "").trim();
    if (!ticker) return reply({ ok: false, error: "Informe o ticker." }, 400);

    const result = await regulatoryDataService.getReportInput(ticker);
    if (!result.found) {
      return reply({ ok: false, found: false, ticker: result.ticker }, 404);
    }
    if (!result.reportAvailable || !result.insights || !result.fund) {
      return reply({
        ok: true,
        found: true,
        ticker: result.ticker,
        scoresAvailable: false,
        reason: result.reason || "regulatory_data_not_published",
        access: { email: access.email },
      });
    }

    return reply({
      ok: true,
      found: true,
      scoresAvailable: true,
      ticker: result.ticker,
      access: { email: access.email },
      service: {
        version: "regulatory-data-service-v1",
        dataVersion: result.fund.regulatoryData?.dataVersion || null,
        cacheHit: result.cache.hit,
      },
      methodology: {
        insightsVersion: result.insights.generatedBy,
        insightsMethodologyVersion: result.insights.methodologyVersion,
        scoreEngineVersion: result.insights.scoreEngine.version,
        scoreEngineMethodologyVersion: result.insights.scoreEngine.methodologyVersion,
        weights: result.insights.scoreEngine.weights,
      },
      scores: result.insights.scores,
      semaphore: result.insights.semaphore,
      assessedDimensions: result.insights.assessedDimensions,
      unavailableDimensions: result.insights.unavailableDimensions,
      facts: result.insights.facts,
    });
  } catch (error: any) {
    return reply({
      ok: false,
      error: error?.message || "Erro ao consultar scores regulatórios.",
    }, registeredUserErrorStatus(error));
  }
}
