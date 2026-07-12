import { NextRequest, NextResponse } from "next/server";
import { processPortfolioNotifications } from "@/lib/portfolioNotificationEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function allowedSecrets() {
  return [process.env.CRON_SECRET, process.env.ADMIN_UPDATE_SECRET].filter(Boolean);
}

function isAuthorized(req: NextRequest, body?: any) {
  const secrets = allowedSecrets();
  if (!secrets.length) return false;
  const authorization = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-admin-secret") || authorization.replace(/^Bearer\s+/i, "");
  const querySecret = req.nextUrl.searchParams.get("secret") || "";
  const bodySecret = String(body?.secret || "");
  return [headerSecret, querySecret, bodySecret].some((value) => Boolean(value && secrets.includes(value)));
}

function safeLimit(value: unknown) {
  return Math.min(Math.max(Number(value || process.env.PORTFOLIO_NOTIFICATION_USER_LIMIT || 100), 1), 300);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await processPortfolioNotifications({ limit: safeLimit(req.nextUrl.searchParams.get("limit")) });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao processar notificações da carteira." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isAuthorized(req, body)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await processPortfolioNotifications({ limit: safeLimit(body?.limit) });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao processar notificações da carteira." }, { status: 500 });
  }
}
