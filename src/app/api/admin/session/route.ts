import { NextRequest, NextResponse } from "next/server";
import {
  adminSessionDurationSeconds,
  clearAdminSessionCookie,
  createAdminSessionToken,
  isSameOriginRequest,
  readAdminSession,
  setAdminSessionCookie,
  validateAdminCredentials,
} from "@/lib/adminSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store", "Content-Type": "application/json; charset=utf-8" };

export async function GET(req: NextRequest) {
  const session = readAdminSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, authenticated: false, error: "Sessão administrativa ausente ou expirada." },
      { status: 401, headers: NO_STORE }
    );
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: session.user,
    expiresAt: new Date(session.expiresAt * 1000).toISOString(),
    sessionDurationSeconds: adminSessionDurationSeconds(),
  }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "Origem da requisição não autorizada." }, { status: 403, headers: NO_STORE });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "");
  if (!process.env.ADMIN_UPDATE_SECRET) {
    return NextResponse.json({ ok: false, error: "Acesso administrativo não configurado." }, { status: 500, headers: NO_STORE });
  }

  if (!validateAdminCredentials(body?.user, token)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 401, headers: NO_STORE });
  }

  const session = createAdminSessionToken();
  const response = NextResponse.json({
    ok: true,
    authenticated: true,
    user: session.payload.user,
    expiresAt: new Date(session.payload.expiresAt * 1000).toISOString(),
    sessionDurationSeconds: adminSessionDurationSeconds(),
  }, { headers: NO_STORE });

  return setAdminSessionCookie(response, session.token, session.payload.expiresAt);
}

export async function DELETE(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "Origem da requisição não autorizada." }, { status: 403, headers: NO_STORE });
  }
  const response = NextResponse.json({ ok: true, authenticated: false }, { headers: NO_STORE });
  return clearAdminSessionCookie(response);
}
