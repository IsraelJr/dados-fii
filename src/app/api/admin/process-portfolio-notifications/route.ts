import { NextRequest, NextResponse } from "next/server";
import { processPortfolioNotifications } from "@/lib/portfolioNotificationEngine";
import { internalAuthError, requireAdminOrCron } from "@/lib/security/InternalRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeLimit(value: unknown) {
  return Math.min(Math.max(Number(value || process.env.PORTFOLIO_NOTIFICATION_USER_LIMIT || 100), 1), 300);
}

export async function GET(req: NextRequest) {
  const authorization = await requireAdminOrCron(req, { scope: "process-portfolio-notifications" });
  if (!authorization.ok) return internalAuthError(authorization);

  try {
    const result = await processPortfolioNotifications({
      limit: safeLimit(req.nextUrl.searchParams.get("limit")),
      correlationId: req.headers.get("x-correlation-id") || undefined,
    });
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
    const result = await processPortfolioNotifications({
      limit: safeLimit(body?.limit),
      correlationId: req.headers.get("x-correlation-id") || undefined,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao processar notificações da carteira." }, { status: 500 });
  }
}
