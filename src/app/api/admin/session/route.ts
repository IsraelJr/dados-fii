import { NextRequest, NextResponse } from "next/server";
import {
  adminSessionDurationSeconds,
  clearAdminSessionCookie,
  createAdminSessionToken,
  expectedAdminUser,
  readAdminSession,
  setAdminSessionCookie,
  validateAdminCredentials,
} from "@/lib/adminSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = readAdminSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, authenticated: false, error: "Sessão administrativa ausente ou expirada." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      authenticated: true,
      user: session.user,
      expiresAt: new Date(session.expiresAt * 1000).toISOString(),
      sessionDurationSeconds: adminSessionDurationSeconds(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const user = String(body?.user || "").trim();
  const token = String(body?.token || "");

  if (!(process.env.ADMIN_UPDATE_SECRET || process.env.CRON_SECRET)) {
    return NextResponse.json(
      { ok: false, error: "Acesso administrativo não configurado." },
      { status: 500 }
    );
  }

  if (!validateAdminCredentials(user, token)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 401 });
  }

  const session = createAdminSessionToken(user || expectedAdminUser());
  const response = NextResponse.json(
    {
      ok: true,
      authenticated: true,
      user: session.payload.user,
      expiresAt: new Date(session.payload.expiresAt * 1000).toISOString(),
      sessionDurationSeconds: adminSessionDurationSeconds(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );

  return setAdminSessionCookie(response, session.token, session.payload.expiresAt);
}

export async function DELETE() {
  const response = NextResponse.json(
    { ok: true, authenticated: false },
    { headers: { "Cache-Control": "no-store" } }
  );
  return clearAdminSessionCookie(response);
}
