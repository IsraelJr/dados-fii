import { NextRequest, NextResponse } from "next/server";
import { getRegulatoryReportInput } from "@/lib/regulatoryService";
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
    const body = await req.json().catch(() => ({} as Record<string, any>));
    const access = await requireRegisteredUserAccess({
      email: body?.email,
      sessionToken: body?.sessionToken,
    });
    const ticker = String(body?.ticker || "").trim();
    if (!ticker) return reply({ ok: false, error: "Informe o ticker." }, 400);

    const result = await getRegulatoryReportInput(ticker);
    if (!result.found) {
      return reply({ ok: false, found: false, ticker: result.ticker }, 404);
    }
    if (!result.reportAvailable || !result.insights || !result.fund || !result.timeline) {
      return reply({
        ok: true,
        found: true,
        ticker: result.ticker,
        reportAvailable: false,
        reason: result.reason || "regulatory_data_not_published",
        access: { email: access.email },
      });
    }

    return reply({
      ok: true,
      found: true,
      reportAvailable: true,
      tier: "free",
      ticker: result.ticker,
      access: { email: access.email },
      fund: {
        code: result.fund.code,
        name: result.fund.name,
        sector: result.fund.sector,
        segment: result.fund.segment,
        price: result.fund.price,
        lastDividend: result.fund.lastDividend,
        lastDividendDate: result.fund.lastDividendDate,
      },
      regulatory: {
        status: result.fund.regulatoryData?.status,
        source: result.fund.regulatoryData?.source,
        latestSnapshot: result.fund.regulatoryData?.latestSnapshot,
        quality: result.fund.regulatoryData?.quality,
        documentsCount: result.fund.regulatoryData?.documents.length || 0,
        publication: result.fund.regulatoryData?.publication,
      },
      report: result.insights.freeReport,
      scores: result.insights.scores,
      scoreMeta: {
        methodologyVersion: result.insights.methodologyVersion,
        semaphore: result.insights.semaphore,
        assessedDimensions: result.insights.assessedDimensions,
        unavailableDimensions: result.insights.unavailableDimensions,
      },
      timeline: {
        version: result.timeline.version,
        counts: result.timeline.counts,
        groups: result.timeline.groups,
      },
      methodology: result.insights.generatedBy,
    });
  } catch (error: any) {
    return reply({
      ok: false,
      error: error?.message || "Erro ao gerar relatório regulatório gratuito.",
    }, registeredUserErrorStatus(error));
  }
}
