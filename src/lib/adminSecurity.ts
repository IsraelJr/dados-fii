import type { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import admin from "@/lib/firebaseAdmin";
import { safeLog } from "@/lib/observability/SafeLogger";
import { distributedRateLimitRepository } from "@/lib/security/DistributedRateLimitRepository";

export const ADMIN_SESSION_COOKIE = "dados_fii_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 30 * 60;

export type AdminIdentity = { uid: string; email: string; role: "admin" };
export type AdminAuthorization =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; status: 401 | 403 | 429 | 503; error: string; retryAfter?: number };

export function adminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

export function isAllowedAdminEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  return Boolean(email && adminEmails().includes(email));
}

function requestKey(req: NextRequest, scope: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const agent = req.headers.get("user-agent") || "unknown";
  return createHash("sha256").update(`${scope}\u0000${ip}\u0000${agent}`, "utf8").digest("hex");
}

export async function consumeAdminRateLimit(req: NextRequest, scope: string, options?: { limit?: number; windowMs?: number }) {
  const limit = Math.min(Math.max(options?.limit || 20, 1), 100);
  const windowMs = Math.min(Math.max(options?.windowMs || 60_000, 1_000), 60 * 60_000);
  const key = requestKey(req, scope);
  try {
    return await distributedRateLimitRepository.consume(key, { limit, windowMs });
  } catch (error) {
    safeLog("error", "admin.rate-limit.unavailable", {
      scope,
      correlationId: req.headers.get("x-correlation-id"),
      error,
    });
    return {
      allowed: false,
      remaining: 0,
      retryAfter: 0,
      unavailable: true as const,
    };
  }
}

export function isSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
    return originUrl.host === forwardedHost;
  } catch {
    return false;
  }
}

export async function requireAdmin(req: NextRequest, options?: { scope?: string; limit?: number; windowMs?: number }): Promise<AdminAuthorization> {
  if (!isSameOrigin(req)) return { ok: false, status: 403, error: "Origem da requisição não autorizada." };
  const cookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!cookie) return { ok: false, status: 401, error: "Sessão administrativa ausente ou expirada." };
  const rate = await consumeAdminRateLimit(req, options?.scope || "admin", { limit: options?.limit, windowMs: options?.windowMs });
  if ("unavailable" in rate) return { ok: false, status: 503, error: "Controle de acesso temporariamente indisponível." };
  if (!rate.allowed) return { ok: false, status: 429, error: "Muitas tentativas. Aguarde antes de tentar novamente.", retryAfter: rate.retryAfter };
  try {
    const decoded = await admin.auth().verifySessionCookie(cookie, true);
    const email = String(decoded.email || "").trim().toLowerCase();
    if (!decoded.email_verified || !isAllowedAdminEmail(email)) return { ok: false, status: 403, error: "E-mail sem autorização administrativa." };
    return { ok: true, identity: { uid: decoded.uid, email, role: "admin" } };
  } catch {
    return { ok: false, status: 401, error: "Sessão administrativa inválida ou expirada." };
  }
}
