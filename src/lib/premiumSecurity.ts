import type { NextRequest } from "next/server";
import admin, { adminDb } from "@/lib/firebaseAdmin";
import { isAllowedAdminEmail, isSameOrigin } from "@/lib/adminSecurity";
import { regulatoryDataService } from "@/lib/regulatoryDataService";
import { paidPlanFromRecord, type PaidProductPlan } from "@/lib/productPlans";

type RateBucket = { count: number; resetsAt: number };
const buckets = new Map<string, RateBucket>();

export type PremiumIdentity = {
  uid: string;
  email: string;
  plan: PaidProductPlan;
  role: "user" | "admin";
  accessSource: "subscription" | "admin_override" | "preview";
};
export type PremiumAuthorization =
  | { ok: true; identity: PremiumIdentity }
  | { ok: false; status: 401 | 403 | 429; error: string; retryAfter?: number };

function previewEmails() {
  return String(process.env.PREMIUM_PREVIEW_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

export function isPremiumPreviewEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  return Boolean(email) && previewEmails().includes(email);
}

async function firestoreEntitlement(uid: string, email: string) {
  const users = adminDb.collection("User");
  const [uidSnapshot, emailSnapshot] = await Promise.all([users.doc(uid).get(), users.doc(email).get()]);
  const uidPlan = uidSnapshot.exists ? paidPlanFromRecord(uidSnapshot.data() || {}) : null;
  if (uidPlan) return uidPlan;
  const emailPlan = emailSnapshot.exists ? paidPlanFromRecord(emailSnapshot.data() || {}) : null;
  if (emailPlan) return emailPlan;
  const query = await users.where("email", "==", email).limit(1).get();
  return query.empty ? null : paidPlanFromRecord(query.docs[0].data() || {});
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
    if (isAllowedAdminEmail(email)) return { ok: true, identity: { uid: decoded.uid, email, plan: "super_premium", role: "admin", accessSource: "admin_override" } };
    if (isPremiumPreviewEmail(email)) return { ok: true, identity: { uid: decoded.uid, email, plan: "super_premium", role: "user", accessSource: "preview" } };
    const claims = decoded as Record<string, unknown>;
    const claimPlan = String(claims.plan || "").toLowerCase();
    if (claims.premium === true || claims.isVip === true || ["premium", "vip", "super_premium"].includes(claimPlan)) {
      const plan = claims.isVip === true || ["vip", "super_premium"].includes(claimPlan) ? "super_premium" : "premium";
      return { ok: true, identity: { uid: decoded.uid, email, plan, role: "user", accessSource: "subscription" } };
    }
    const entitlement = await firestoreEntitlement(decoded.uid, email);
    if (entitlement) return { ok: true, identity: { uid: decoded.uid, email, plan: entitlement, role: "user", accessSource: "subscription" } };
    return { ok: false, status: 403, error: "Relatório disponível para assinantes Premium e Super Premium." };
  } catch {
    return { ok: false, status: 401, error: "Sessão inválida ou expirada." };
  }
}
