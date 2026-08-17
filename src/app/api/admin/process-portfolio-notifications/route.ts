import { NextRequest, NextResponse } from "next/server";
import { processPortfolioNotifications } from "@/lib/portfolioNotificationEngine";
import { internalAuthError, requireAdminOrCron } from "@/lib/security/InternalRequestAuth";
import { featureEnabled } from "@/lib/featureFlags";
import { processFundRadarUpdates } from "@/server/services/FundRadarBatchRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeLimit(value: unknown) {
  return Math.min(Math.max(Number(value || process.env.PORTFOLIO_NOTIFICATION_USER_LIMIT || 100), 1), 300);
}

async function processAll(limit: number, correlationId?: string) {
  const portfolio = await processPortfolioNotifications({ limit, correlationId });
  const radar = featureEnabled("ENABLE_FUND_RADAR", false)
    ? await processFundRadarUpdates(Math.min(limit, 100))
    : { ok: true, disabled: true };
  return { ...portfolio, radar };
}

export async function GET(req: NextRequest) {
  const authorization = await requireAdminOrCron(req, { scope: "process-portfolio-notifications" });
  if (!authorization.ok) return internalAuthError(authorization);

  try {
    const result = await processAll(
      safeLimit(req.nextUrl.searchParams.get("limit")),
      req.headers.get("x-correlation-id") || undefined,
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao processar notificações da carteira." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authorization = await requireAdminOrCron(req, { scope: "process-portfolio-notifications" });
  if (!authorization.ok) return internalAuthError(authorization);
  const body = await req.json().catch(() => ({}));

  try {
    const result = await processAll(
      safeLimit(body?.limit),
      req.headers.get("x-correlation-id") || undefined,
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao processar notificações da carteira." }, { status: 500 });
  }
}
