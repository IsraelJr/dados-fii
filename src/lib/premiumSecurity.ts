import type { NextRequest } from "next/server";
import admin, { adminDb } from "@/lib/firebaseAdmin";
import { isAllowedAdminEmail, isSameOrigin } from "@/lib/adminSecurity";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

type RateBucket = { count: number; resetsAt: number };
const buckets = new Map<string, RateBucket>();

export type PremiumIdentity = { uid: string; email: string; plan: "premium" | "vip" | "admin" | "preview" };
export type PremiumAuthorization =
  | { ok: true; identity: PremiumIdentity }
  | { ok: false; status: 401 | 403 | 429; error: string; retryAfter?: number };

function previewEmails() {
  return String(process.env.PREMIUM_PREVIEW_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function premiumRecord(data: Record<string, any>) {
  const plan = String(data.plan || data.subscription?.plan || data.subscriptionPlan || "").toLowerCase();
  const status = String(data.subscription?.status || data.subscriptionStatus || "").toLowerCase();
  return data.isVip === true || data.isPremium === true || data.premium === true
    || ["vip", "premium"].includes(plan) && (!status || ["active", "trialing", "paid"].includes(status));
}

async function firestoreEntitlement(uid: string, email: string) {
  const users = adminDb.collection("User");
  const [uidSnapshot, emailSnapshot] = await Promise.all([users.doc(uid).get(), users.doc(email).get()]);
  if (uidSnapshot.exists && premiumRecord(uidSnapshot.data() || {})) return true;
  if (emailSnapshot.exists && premiumRecord(emailSnapshot.data() || {})) return true;
  const query = await users.where("email", "==", email).limit(1).get();
  return !query.empty && premiumRecord(query.docs[0].data() || {});
}

function consumeRateLimit(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const key = regulatoryDataService.requestFingerprint(["premium-report", ip]);
  const now = Date.now();
  const limit = 12;
  const windowMs = 10 * 60_000;
  if (buckets.size > 5_000) for (const [storedKey, bucket] of buckets) if (bucket.resetsAt <= now) buckets.delete(storedKey);
  const current = buckets.get(key);
  if (!current || current.resetsAt <= now) {
    buckets.set(key, { count: 1, resetsAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  return { allowed: current.count <= limit, retryAfter: Math.max(1, Math.ceil((current.resetsAt - now) / 1000)) };
}

export async function requirePremium(request: NextRequest): Promise<PremiumAuthorization> {
  const rate = consumeRateLimit(request);
  if (!rate.allowed) return { ok: false, status: 429, error: "Muitas tentativas de geração Premium.", retryAfter: rate.retryAfter };
  if (!isSameOrigin(request)) return { ok: false, status: 403, error: "Origem não autorizada." };
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "Autenticação necessária para o relatório Premium." };
  try {
    const decoded = await admin.auth().verifyIdToken(token, true);
    const email = String(decoded.email || "").trim().toLowerCase();
    if (!decoded.email_verified || !email) return { ok: false, status: 403, error: "Confirme seu e-mail antes de acessar o Premium." };
    if (isAllowedAdminEmail(email)) return { ok: true, identity: { uid: decoded.uid, email, plan: "admin" } };
    if (previewEmails().includes(email)) return { ok: true, identity: { uid: decoded.uid, email, plan: "preview" } };
    const claims = decoded as Record<string, unknown>;
    const claimPlan = String(claims.plan || "").toLowerCase();
    if (claims.premium === true || claims.isVip === true || ["premium", "vip"].includes(claimPlan)) {
      return { ok: true, identity: { uid: decoded.uid, email, plan: claims.isVip === true || claimPlan === "vip" ? "vip" : "premium" } };
    }
    if (await firestoreEntitlement(decoded.uid, email)) return { ok: true, identity: { uid: decoded.uid, email, plan: "vip" } };
    return { ok: false, status: 403, error: "Relatório disponível para assinantes Premium/VIP." };
  } catch {
    return { ok: false, status: 401, error: "Sessão inválida ou expirada." };
  }
}
