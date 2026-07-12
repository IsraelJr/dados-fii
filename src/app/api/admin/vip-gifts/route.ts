import { NextRequest, NextResponse } from "next/server";
import { createVipGift } from "@/lib/vipGiftService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowedSecrets() {
  return [process.env.ADMIN_UPDATE_SECRET, process.env.CRON_SECRET].filter(Boolean);
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isAuthorized(req, body)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await createVipGift({
      email: body?.email,
      durationDays: body?.durationDays,
      claimWindowDays: body?.claimWindowDays,
      message: body?.message,
      createdBy: body?.createdBy || "admin",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Erro ao criar presente VIP." }, { status: 400 });
  }
}
