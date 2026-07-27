// Controlador de aplicação; o Route Handler permanece sem acesso à persistência.
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { paidPlanFromRecord, productPlanLabel } from "@/lib/productPlans";
import {
  FREE_PATRIMONY_CHANGE_THRESHOLD_PERCENT,
  MAX_PAID_PATRIMONY_CHANGE_THRESHOLD_PERCENT,
  MIN_PAID_PATRIMONY_CHANGE_THRESHOLD_PERCENT,
  paidPatrimonyThresholdPercent,
} from "@/lib/portfolioNotificationPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function emailOf(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isExpired(value: unknown) {
  if (!value) return true;
  const date = typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate(): Date }).toDate()
    : new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

async function hasSession(email: string, token: unknown) {
  const sessionToken = String(token || "");
  if (!sessionToken) return false;
  const snapshot = await adminDb.collection("WalletSessions").doc(hash(`${email}:${sessionToken}`)).get();
  if (!snapshot.exists) return false;
  const data = snapshot.data() || {};
  return data.email === email && !isExpired(data.expiresAt);
}

function legacyEmailCandidates(email: string) {
  const [name, domain] = email.split("@");
  const capitalized = name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}@${domain}` : email;
  return Array.from(new Set([email, capitalized]));
}

async function findUser(email: string) {
  const users = adminDb.collection("User");
  for (const docId of legacyEmailCandidates(email)) {
    const direct = await users.doc(docId).get();
    if (direct.exists) return { ref: direct.ref, data: direct.data() || {} };
  }
  const query = await users.where("email", "==", email).limit(1).get();
  if (!query.empty) return { ref: query.docs[0].ref, data: query.docs[0].data() || {} };
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = emailOf(body?.email);
    if (!isEmail(email)) return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
    if (!(await hasSession(email, body?.sessionToken))) {
      return NextResponse.json({ ok: false, error: "Confirme o código antes de configurar as notificações." }, { status: 401 });
    }

    const user = await findUser(email);
    if (!user) return NextResponse.json({ ok: false, error: "Salve sua carteira antes de configurar as notificações." }, { status: 404 });
    const paidPlan = paidPlanFromRecord(user.data);
    const isPaid = paidPlan !== null;
    const preferences = user.data.notificationPreferences && typeof user.data.notificationPreferences === "object"
      ? user.data.notificationPreferences as Record<string, unknown>
      : {};
    const action = String(body?.action || "load").trim().toLowerCase();

    if (action === "save") {
      if (!isPaid) {
        return NextResponse.json({ ok: false, error: `No plano Grátis, o limite permanece em ${FREE_PATRIMONY_CHANGE_THRESHOLD_PERCENT}%.` }, { status: 403 });
      }
      const requested = Number(body?.patrimonyChangeThresholdPercent);
      if (!Number.isFinite(requested) || requested < MIN_PAID_PATRIMONY_CHANGE_THRESHOLD_PERCENT || requested > MAX_PAID_PATRIMONY_CHANGE_THRESHOLD_PERCENT) {
        return NextResponse.json({
          ok: false,
          error: `Escolha um limite entre ${MIN_PAID_PATRIMONY_CHANGE_THRESHOLD_PERCENT}% e ${MAX_PAID_PATRIMONY_CHANGE_THRESHOLD_PERCENT}%.`,
        }, { status: 400 });
      }
      const thresholdPercent = paidPatrimonyThresholdPercent(requested);
      await user.ref.update({
        "notificationPreferences.patrimonyAlerts": true,
        "notificationPreferences.patrimonyChangeThresholdPercent": thresholdPercent,
        notificationPreferencesUpdatedAt: adminFieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, isPaid, plan: paidPlan, planLabel: productPlanLabel(paidPlan), thresholdPercent });
    }

    if (action !== "load") return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
    const thresholdPercent = isPaid
      ? paidPatrimonyThresholdPercent(preferences.patrimonyChangeThresholdPercent)
      : FREE_PATRIMONY_CHANGE_THRESHOLD_PERCENT;
    return NextResponse.json({
      ok: true,
      isPaid,
      plan: paidPlan || "free",
      planLabel: productPlanLabel(paidPlan || "free"),
      thresholdPercent,
      minimumPercent: isPaid ? MIN_PAID_PATRIMONY_CHANGE_THRESHOLD_PERCENT : FREE_PATRIMONY_CHANGE_THRESHOLD_PERCENT,
      maximumPercent: isPaid ? MAX_PAID_PATRIMONY_CHANGE_THRESHOLD_PERCENT : FREE_PATRIMONY_CHANGE_THRESHOLD_PERCENT,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Erro ao configurar notificações." }, { status: 500 });
  }
}
