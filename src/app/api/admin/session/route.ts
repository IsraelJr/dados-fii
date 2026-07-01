import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const user = String(body?.user || "").trim();
  const token = String(body?.token || "");
  const expectedUser = process.env.ADMIN_USER || "";
  const expectedToken = process.env.ADMIN_UPDATE_SECRET || process.env.CRON_SECRET || "";

  if (!expectedUser || !expectedToken) {
    return NextResponse.json({ ok: false, error: "Acesso administrativo não configurado." }, { status: 500 });
  }

  if (user !== expectedUser || token !== expectedToken) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user });
}
