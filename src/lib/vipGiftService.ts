import { createHash, randomUUID } from "crypto";
import admin, { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

const MAX_GIFT_DAYS = 90;
const MAX_CLAIM_DAYS = 90;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeDays(value: unknown, fallback: number, max: number) {
  return Math.min(Math.max(Math.floor(Number(value || fallback)), 1), max);
}

function toDate(value: any): Date | null {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value: any) {
  return toDate(value)?.toISOString() || null;
}

function isExpired(value: any) {
  const date = toDate(value);
  return !date || date.getTime() <= Date.now();
}

function activeVipExpiration(data: any) {
  return toDate(data?.vipUntil || data?.vip?.expiresAt || data?.subscription?.expiresAt);
}

function hasPermanentVip(data: any) {
  const plan = String(data?.plan || data?.subscription?.plan || "").toLowerCase();
  const flagged = Boolean(data?.isVip || data?.isVIP || data?.isPremium || data?.premium || ["vip", "premium", "pro"].includes(plan));
  return flagged && !activeVipExpiration(data);
}

export function vipStatusFromUser(data: any) {
  const expiration = activeVipExpiration(data);
  const permanent = hasPermanentVip(data);
  const active = permanent || Boolean(expiration && expiration.getTime() > Date.now());
  return {
    active,
    permanent,
    expiresAt: expiration?.toISOString() || null,
    source: data?.vip?.source || data?.subscription?.source || (active ? "manual" : null),
    giftId: data?.vip?.giftId || null,
    remainingDays: expiration && active ? Math.max(Math.ceil((expiration.getTime() - Date.now()) / 86400000), 1) : null,
  };
}

export async function hasWalletSession(email: string, token: unknown) {
  const sessionToken = String(token || "");
  if (!sessionToken) return false;
  const snap = await adminDb.collection("WalletSessions").doc(sha256(`${email}:${sessionToken}`)).get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  return data.email === email && !isExpired(data.expiresAt);
}

export async function findUserByEmail(email: string) {
  const users = adminDb.collection("User");
  const direct = await users.doc(email).get();
  if (direct.exists) return { ref: direct.ref, data: direct.data() || {}, id: direct.id };
  const query = await users.where("email", "==", email).limit(1).get();
  if (query.empty) return null;
  const doc = query.docs[0];
  return { ref: doc.ref, data: doc.data() || {}, id: doc.id };
}

function serializeGiftDoc(doc: any) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    recipientEmail: data.recipientEmail || null,
    userDocId: data.userDocId || null,
    status: data.status || "pending",
    durationDays: Number(data.durationDays || 0),
    claimWindowDays: Number(data.claimWindowDays || 0),
    message: data.message || null,
    createdBy: data.createdBy || null,
    notificationId: data.notificationId || null,
    createdAt: toIso(data.createdAt),
    offerExpiresAt: toIso(data.offerExpiresAt),
    acceptedAt: toIso(data.acceptedAt),
    declinedAt: toIso(data.declinedAt),
    vipStartsAt: toIso(data.vipStartsAt),
    vipEndsAt: toIso(data.vipEndsAt),
    applied: data.applied !== false,
  };
}

async function createGiftNotification(userRef: any, giftId: string, notificationId: string, durationDays: number, message?: string) {
  await userRef.collection("Notifications").doc(notificationId).set({
    type: "vip_gift",
    eventKey: `vip_gift:${giftId}`,
    title: `Você recebeu ${durationDays} dia${durationDays === 1 ? "" : "s"} de VIP`,
    message: message || "Ative o presente para conhecer os relatórios completos, alertas avançados e recursos exclusivos do Dados FII.",
    severity: "success",
    actionUrl: "/carteira?presente-vip=1",
    vipGiftId: giftId,
    createdAt: adminFieldValue.serverTimestamp(),
    readAt: null,
    dismissedAt: null,
  }, { merge: true });
}

export async function createVipGift(input: {
  email: string;
  durationDays?: number;
  claimWindowDays?: number;
  createdBy?: string;
  message?: string;
}) {
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) throw new Error("Informe um e-mail válido.");
  const durationDays = safeDays(input.durationDays, 5, MAX_GIFT_DAYS);
  const claimWindowDays = safeDays(input.claimWindowDays, 30, MAX_CLAIM_DAYS);
  const existingSnapshot = await adminDb.collection("VipGifts").where("recipientEmail", "==", email).limit(30).get();
  const existing = existingSnapshot.docs.find((doc) => {
    const data = doc.data() || {};
    return data.status === "pending" && !isExpired(data.offerExpiresAt);
  });
  if (existing) return { gift: serializeGiftDoc(existing), reused: true, userFound: Boolean((existing.data() || {}).userDocId) };

  const user = await findUserByEmail(email);
  const giftId = randomUUID();
  const notificationId = sha256(`vip-gift:${giftId}:${email}`).slice(0, 40);
  const now = new Date();
  const offerExpiresAt = new Date(now.getTime() + claimWindowDays * 86400000);
  const giftRef = adminDb.collection("VipGifts").doc(giftId);

  await giftRef.set({
    recipientEmail: email,
    userDocId: user?.id || null,
    status: "pending",
    durationDays,
    claimWindowDays,
    message: String(input.message || "").trim() || null,
    createdBy: String(input.createdBy || "admin").trim() || "admin",
    notificationId,
    offerExpiresAt: admin.firestore.Timestamp.fromDate(offerExpiresAt),
    createdAt: adminFieldValue.serverTimestamp(),
    updatedAt: adminFieldValue.serverTimestamp(),
  });

  if (user) await createGiftNotification(user.ref, giftId, notificationId, durationDays, input.message);
  const snap = await giftRef.get();
  return { gift: serializeGiftDoc(snap), reused: false, userFound: Boolean(user) };
}

async function attachPendingGiftToUser(user: { ref: any; id: string }, giftDoc: any) {
  const data = giftDoc.data() || {};
  const notificationId = data.notificationId || sha256(`vip-gift:${giftDoc.id}:${data.recipientEmail}`).slice(0, 40);
  await Promise.all([
    giftDoc.ref.set({ userDocId: user.id, notificationId, updatedAt: adminFieldValue.serverTimestamp() }, { merge: true }),
    createGiftNotification(user.ref, giftDoc.id, notificationId, Number(data.durationDays || 5), data.message),
  ]);
}

export async function listVipGifts(emailValue: unknown, sessionToken: unknown) {
  const email = normalizeEmail(emailValue);
  if (!isEmail(email)) throw new Error("Informe um e-mail válido.");
  if (!(await hasWalletSession(email, sessionToken))) throw new Error("Sessão expirada. Confirme novamente o e-mail da carteira.");
  const user = await findUserByEmail(email);
  if (!user) throw new Error("Usuário não encontrado.");

  const snapshot = await adminDb.collection("VipGifts").where("recipientEmail", "==", email).limit(30).get();
  const expired: any[] = [];
  const pending = snapshot.docs.filter((doc) => {
    const data = doc.data() || {};
    if (data.status !== "pending") return false;
    if (isExpired(data.offerExpiresAt)) {
      expired.push(doc);
      return false;
    }
    return true;
  });

  if (expired.length) {
    const batch = adminDb.batch();
    expired.forEach((doc) => batch.set(doc.ref, { status: "offer_expired", updatedAt: adminFieldValue.serverTimestamp() }, { merge: true }));
    await batch.commit();
  }

  await Promise.all(pending.map((doc) => attachPendingGiftToUser(user, doc)));
  const gifts = pending
    .map(serializeGiftDoc)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return { gifts, vip: vipStatusFromUser(user.data) };
}

export async function acceptVipGift(input: { email: unknown; sessionToken: unknown; giftId: unknown }) {
  const email = normalizeEmail(input.email);
  const giftId = String(input.giftId || "").trim();
  if (!isEmail(email) || !giftId) throw new Error("Presente VIP inválido.");
  if (!(await hasWalletSession(email, input.sessionToken))) throw new Error("Sessão expirada. Confirme novamente o e-mail da carteira.");
  const user = await findUserByEmail(email);
  if (!user) throw new Error("Usuário não encontrado.");

  const giftRef = adminDb.collection("VipGifts").doc(giftId);
  const benefitRef = user.ref.collection("VipBenefits").doc(giftId);
  let response: any = null;

  await adminDb.runTransaction(async (transaction) => {
    const [giftSnap, userSnap] = await Promise.all([transaction.get(giftRef), transaction.get(user.ref)]);
    if (!giftSnap.exists) throw new Error("Presente VIP não encontrado.");
    const gift = giftSnap.data() || {};
    const userData = userSnap.data() || {};
    if (normalizeEmail(gift.recipientEmail) !== email) throw new Error("Este presente pertence a outro usuário.");
    if (gift.status !== "pending") throw new Error("Este presente já foi respondido.");
    if (isExpired(gift.offerExpiresAt)) throw new Error("O prazo para aceitar este presente expirou.");

    const now = new Date();
    const durationDays = safeDays(gift.durationDays, 5, MAX_GIFT_DAYS);
    const permanent = hasPermanentVip(userData);
    const currentExpiration = activeVipExpiration(userData);
    const startsAt = now;
    const baseMs = currentExpiration && currentExpiration.getTime() > now.getTime() ? currentExpiration.getTime() : now.getTime();
    const endsAt = permanent ? null : new Date(baseMs + durationDays * 86400000);
    const notificationId = String(gift.notificationId || "");

    transaction.set(giftRef, {
      status: "accepted",
      applied: !permanent,
      acceptedAt: adminFieldValue.serverTimestamp(),
      vipStartsAt: admin.firestore.Timestamp.fromDate(startsAt),
      vipEndsAt: endsAt ? admin.firestore.Timestamp.fromDate(endsAt) : null,
      userDocId: user.id,
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(benefitRef, {
      giftId,
      type: "temporary_vip",
      durationDays,
      startsAt: admin.firestore.Timestamp.fromDate(startsAt),
      endsAt: endsAt ? admin.firestore.Timestamp.fromDate(endsAt) : null,
      applied: !permanent,
      createdAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    if (!permanent && endsAt) {
      transaction.set(user.ref, {
        isVip: true,
        vipUntil: admin.firestore.Timestamp.fromDate(endsAt),
        vip: {
          active: true,
          source: "gift",
          giftId,
          durationDays,
          startsAt: admin.firestore.Timestamp.fromDate(startsAt),
          expiresAt: admin.firestore.Timestamp.fromDate(endsAt),
        },
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });
    }

    if (notificationId) {
      transaction.set(user.ref.collection("Notifications").doc(notificationId), {
        title: permanent ? "Presente VIP registrado" : "Presente VIP ativado",
        message: permanent
          ? "Sua conta já possui VIP permanente. O presente foi registrado, sem alterar seu plano atual."
          : `Seu acesso VIP foi ativado por ${durationDays} dia${durationDays === 1 ? "" : "s"}.`,
        readAt: adminFieldValue.serverTimestamp(),
        severity: "success",
      }, { merge: true });
    }

    response = {
      giftId,
      durationDays,
      applied: !permanent,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt?.toISOString() || null,
      permanentAlreadyActive: permanent,
    };
  });

  const updatedUser = await user.ref.get();
  return { ...response, vip: vipStatusFromUser(updatedUser.data() || {}) };
}

export async function declineVipGift(input: { email: unknown; sessionToken: unknown; giftId: unknown }) {
  const email = normalizeEmail(input.email);
  const giftId = String(input.giftId || "").trim();
  if (!isEmail(email) || !giftId) throw new Error("Presente VIP inválido.");
  if (!(await hasWalletSession(email, input.sessionToken))) throw new Error("Sessão expirada. Confirme novamente o e-mail da carteira.");
  const user = await findUserByEmail(email);
  if (!user) throw new Error("Usuário não encontrado.");
  const giftRef = adminDb.collection("VipGifts").doc(giftId);

  await adminDb.runTransaction(async (transaction) => {
    const giftSnap = await transaction.get(giftRef);
    if (!giftSnap.exists) throw new Error("Presente VIP não encontrado.");
    const gift = giftSnap.data() || {};
    if (normalizeEmail(gift.recipientEmail) !== email) throw new Error("Este presente pertence a outro usuário.");
    if (gift.status !== "pending") throw new Error("Este presente já foi respondido.");
    transaction.set(giftRef, {
      status: "declined",
      declinedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });
    if (gift.notificationId) {
      transaction.set(user.ref.collection("Notifications").doc(String(gift.notificationId)), {
        readAt: adminFieldValue.serverTimestamp(),
        dismissedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });

  return { giftId, status: "declined" };
}

export async function expireVipGifts(limit = 300) {
  const safeLimit = Math.min(Math.max(Number(limit || 300), 1), 500);
  const now = new Date();
  const [usersSnapshot, giftsSnapshot] = await Promise.all([
    adminDb.collection("User").where("isVip", "==", true).limit(safeLimit).get(),
    adminDb.collection("VipGifts").where("status", "==", "accepted").limit(safeLimit).get(),
  ]);

  const expiredUsers = usersSnapshot.docs.filter((doc) => {
    const data = doc.data() || {};
    const expiration = activeVipExpiration(data);
    return data?.vip?.source === "gift" && Boolean(expiration && expiration.getTime() <= now.getTime());
  });
  const expiredGifts = giftsSnapshot.docs.filter((doc) => {
    const endsAt = toDate((doc.data() || {}).vipEndsAt);
    return Boolean(endsAt && endsAt.getTime() <= now.getTime());
  });

  const batch = adminDb.batch();
  expiredUsers.forEach((doc) => batch.set(doc.ref, {
    isVip: false,
    vipUntil: null,
    vip: { ...(doc.data()?.vip || {}), active: false, expiredAt: admin.firestore.Timestamp.fromDate(now) },
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true }));
  expiredGifts.forEach((doc) => batch.set(doc.ref, {
    status: "expired",
    expiredAt: adminFieldValue.serverTimestamp(),
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true }));
  if (expiredUsers.length || expiredGifts.length) await batch.commit();

  return {
    ok: true,
    usersRead: usersSnapshot.size,
    giftsRead: giftsSnapshot.size,
    usersExpired: expiredUsers.length,
    giftsExpired: expiredGifts.length,
  };
}
