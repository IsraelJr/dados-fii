import { NextRequest, NextResponse } from "next/server";
import { expireVipGifts } from "@/lib/vipGiftService";

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
  return Math.min(Math.max(Number(value || 300), 1), 500);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  try {
    return NextResponse.json(await expireVipGifts(safeLimit(req.nextUrl.searchParams.get("limit"))));
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Erro ao expirar presentes VIP." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isAuthorized(req, body)) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  try {
    return NextResponse.json(await expireVipGifts(safeLimit(body?.limit)));
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Erro ao expirar presentes VIP." }, { status: 500 });
  }
}
