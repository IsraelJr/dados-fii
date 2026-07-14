import type { NextRequest } from "next/server";
import admin from "@/lib/firebaseAdmin";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const ADMIN_SESSION_COOKIE = "dados_fii_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 30 * 60;

type RateBucket = { count: number; resetsAt: number };
const rateBuckets = new Map<string, RateBucket>();

export type AdminIdentity = { uid: string; email: string; role: "admin" };
export type AdminAuthorization =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; status: 401 | 403 | 429; error: string; retryAfter?: number };

export function adminEmails() {
  return String(process.env.ADMIN_EMAILS || process.env.ADMIN_USER || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
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
  return regulatoryDataService.requestFingerprint([scope, ip, agent]);
}

export function consumeAdminRateLimit(req: NextRequest, scope: string, options?: { limit?: number; windowMs?: number }) {
  const limit = Math.min(Math.max(options?.limit || 20, 1), 100);
  const windowMs = Math.min(Math.max(options?.windowMs || 60_000, 1_000), 60 * 60_000);
  const key = requestKey(req, scope);
  const now = Date.now();
  if (rateBuckets.size > 5_000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.resetsAt <= now) rateBuckets.delete(bucketKey);
    }
  }
  const current = rateBuckets.get(key);
  if (!current || current.resetsAt <= now) {
    rateBuckets.set(key, { count: 1, resetsAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }
  current.count += 1;
  rateBuckets.set(key, current);
  const retryAfter = Math.max(1, Math.ceil((current.resetsAt - now) / 1_000));
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), retryAfter };
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
  const rate = consumeAdminRateLimit(req, options?.scope || "admin", { limit: options?.limit, windowMs: options?.windowMs });
  if (!rate.allowed) return { ok: false, status: 429, error: "Muitas tentativas. Aguarde antes de tentar novamente.", retryAfter: rate.retryAfter };
  if (!isSameOrigin(req)) return { ok: false, status: 403, error: "Origem da requisição não autorizada." };
  const cookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!cookie) return { ok: false, status: 401, error: "Sessão administrativa ausente ou expirada." };
  try {
    const decoded = await admin.auth().verifySessionCookie(cookie, true);
    const email = String(decoded.email || "").trim().toLowerCase();
    if (!decoded.email_verified || !isAllowedAdminEmail(email)) return { ok: false, status: 403, error: "E-mail sem autorização administrativa." };
    return { ok: true, identity: { uid: decoded.uid, email, role: "admin" } };
  } catch {
    return { ok: false, status: 401, error: "Sessão administrativa inválida ou expirada." };
  }
}
