import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

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

function isExpired(value: any) {
  if (!value) return true;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return !date || Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

function toIso(value: any) {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return !date || Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function hasSession(email: string, token: unknown) {
  const sessionToken = String(token || "");
  if (!sessionToken) return false;

  const snap = await adminDb.collection("WalletSessions").doc(hash(`${email}:${sessionToken}`)).get();
  if (!snap.exists) return false;

  const data = snap.data() || {};
  return data.email === email && !isExpired(data.expiresAt);
}

async function findUser(email: string) {
  const users = adminDb.collection("User");
  const directRef = users.doc(email);
  const directSnap = await directRef.get();
  if (directSnap.exists) return { ref: directRef, snap: directSnap };

  const query = await users.where("email", "==", email).limit(1).get();
  if (!query.empty) {
    const doc = query.docs[0];
    return { ref: doc.ref, snap: doc };
  }

  return null;
}

function serializeNotification(doc: any) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    type: String(data.type || "info"),
    ticker: data.ticker ? String(data.ticker) : null,
    title: String(data.title || "Notificação"),
    message: String(data.message || ""),
    severity: String(data.severity || "info"),
    actionUrl: String(data.actionUrl || "/carteira"),
    portfolioImpact: data.portfolioImpact || null,
    createdAt: toIso(data.createdAt),
    readAt: toIso(data.readAt),
    dismissedAt: toIso(data.dismissedAt),
    emailSentAt: toIso(data.emailSentAt),
  };
}

function validNotificationId(value: unknown) {
  const id = String(value || "").trim();
  return /^[a-f0-9]{16,64}$/i.test(id) ? id : "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list").trim().toLowerCase();
    const email = emailOf(body?.email);

    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
    }

    if (!(await hasSession(email, body?.sessionToken))) {
      return NextResponse.json({ ok: false, error: "Sessão expirada. Confirme novamente o e-mail da carteira." }, { status: 401 });
    }

    const user = await findUser(email);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
    }

    const notifications = user.ref.collection("Notifications");

    if (action === "list") {
      const limit = Math.min(Math.max(Number(body?.limit || 50), 1), 100);
      const snapshot = await notifications.orderBy("createdAt", "desc").limit(limit).get();
      const items = snapshot.docs
        .map(serializeNotification)
        .filter((item) => !item.dismissedAt);
      const unreadCount = items.filter((item) => !item.readAt).length;

      return NextResponse.json({ ok: true, items, unreadCount, totalReturned: items.length });
    }

    if (action === "mark-all-read") {
      const snapshot = await notifications.orderBy("createdAt", "desc").limit(100).get();
      const unread = snapshot.docs.filter((doc) => {
        const data = doc.data() || {};
        return !data.readAt && !data.dismissedAt;
      });

      if (unread.length) {
        const batch = adminDb.batch();
        unread.forEach((doc) => batch.set(doc.ref, { readAt: adminFieldValue.serverTimestamp() }, { merge: true }));
        await batch.commit();
      }

      return NextResponse.json({ ok: true, updated: unread.length });
    }

    if (action === "mark-read" || action === "dismiss") {
      const id = validNotificationId(body?.id);
      if (!id) {
        return NextResponse.json({ ok: false, error: "Notificação inválida." }, { status: 400 });
      }

      const ref = notifications.doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        return NextResponse.json({ ok: false, error: "Notificação não encontrada." }, { status: 404 });
      }

      const payload = action === "dismiss"
        ? { dismissedAt: adminFieldValue.serverTimestamp(), readAt: adminFieldValue.serverTimestamp() }
        : { readAt: adminFieldValue.serverTimestamp() };
      await ref.set(payload, { merge: true });

      return NextResponse.json({ ok: true, id, action });
    }

    return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao consultar notificações." }, { status: 500 });
  }
}
