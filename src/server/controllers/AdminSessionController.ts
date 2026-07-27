// Controlador de autenticação; o Route Handler permanece sem acesso ao Firebase Admin.
import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebaseAdmin";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  consumeAdminRateLimit,
  isAllowedAdminEmail,
  isSameOrigin,
  requireAdmin,
} from "@/lib/adminSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(payload: unknown, status = 200, retryAfter?: number) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "login").toLowerCase();

  if (action === "status") {
    const authorization = await requireAdmin(req, { scope: "admin-session-status", limit: 60 });
    if (!authorization.ok) return response({ ok: false, error: authorization.error }, authorization.status, authorization.retryAfter);
    return response({ ok: true, email: authorization.identity.email });
  }

  if (action === "logout") {
    if (!isSameOrigin(req)) return response({ ok: false, error: "Origem da requisição não autorizada." }, 403);
    const result = response({ ok: true });
    result.cookies.set({ name: ADMIN_SESSION_COOKIE, value: "", path: "/", httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 0 });
    return result;
  }

  if (!isSameOrigin(req)) return response({ ok: false, error: "Origem da requisição não autorizada." }, 403);
  const idToken = String(body?.idToken || "");
  if (!idToken) return response({ ok: false, error: "Token de autenticação obrigatório." }, 400);
  const rate = await consumeAdminRateLimit(req, "admin-session-login", { limit: 8, windowMs: 5 * 60_000 });
  if ("unavailable" in rate) return response({ ok: false, error: "Controle de acesso temporariamente indisponível." }, 503);
  if (!rate.allowed) return response({ ok: false, error: "Muitas tentativas de login. Aguarde e tente novamente." }, 429, rate.retryAfter);
  try {
    const decoded = await admin.auth().verifyIdToken(idToken, true);
    const email = String(decoded.email || "").trim().toLowerCase();
    if (!decoded.email_verified) return response({ ok: false, error: "Confirme seu e-mail antes de acessar o Admin." }, 403);
    if (!isAllowedAdminEmail(email)) return response({ ok: false, error: "E-mail sem autorização administrativa." }, 403);
    const expiresIn = ADMIN_SESSION_MAX_AGE_SECONDS * 1_000;
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });
    const result = response({ ok: true, email, expiresIn });
    result.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: sessionCookie,
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
    return result;
  } catch {
    return response({ ok: false, error: "Não foi possível autenticar a sessão administrativa." }, 401);
  }
}
