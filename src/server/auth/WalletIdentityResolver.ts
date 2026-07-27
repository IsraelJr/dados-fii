import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebaseAdmin";

const SESSION_COLLECTION = "WalletSessions";
const USER_COLLECTION = "User";

export type WalletIdentity = Readonly<{
  ownerId: string;
  authMode: "email-session" | "anon-cookie";
}>;

export class WalletIdentityError extends Error {
  constructor(
    readonly status: 401 | 404,
    readonly code: "WALLET_SESSION_REQUIRED" | "USER_NOT_IDENTIFIED" | "USER_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "WalletIdentityError";
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isExpired(value: unknown) {
  if (!value) return true;
  const timestamp = value as { toDate?: () => Date };
  const date = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(String(value));
  return Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

async function resolveEmailSession(request: Request): Promise<WalletIdentity | null> {
  const email = normalizeEmail(request.headers.get("x-wallet-email"));
  const token = String(request.headers.get("x-wallet-session") ?? "");
  if (!email && !token) return null;
  if (!isEmail(email) || !token) {
    throw new WalletIdentityError(401, "WALLET_SESSION_REQUIRED", "Sessão da carteira inválida.");
  }

  const session = await adminDb.collection(SESSION_COLLECTION).doc(sha256(`${email}:${token}`)).get();
  if (!session.exists) {
    throw new WalletIdentityError(401, "WALLET_SESSION_REQUIRED", "Sessão da carteira inválida.");
  }
  const sessionData = session.data() || {};
  if (normalizeEmail(sessionData.email) !== email || isExpired(sessionData.expiresAt)) {
    throw new WalletIdentityError(401, "WALLET_SESSION_REQUIRED", "Sessão da carteira expirada.");
  }

  const users = adminDb.collection(USER_COLLECTION);
  const direct = await users.doc(email).get();
  if (direct.exists) return Object.freeze({ ownerId: direct.id, authMode: "email-session" });

  const query = await users.where("email", "==", email).limit(1).get();
  const matchedUser = query.docs.at(0);
  if (!matchedUser) {
    throw new WalletIdentityError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
  }

  return Object.freeze({ ownerId: matchedUser.id, authMode: "email-session" });
}

async function resolveAnonymousCookie(): Promise<WalletIdentity> {
  const cookieStore = await cookies();
  const anonId = String(cookieStore.get("anonId")?.value ?? "").trim();
  if (!anonId) {
    throw new WalletIdentityError(401, "USER_NOT_IDENTIFIED", "Usuário não identificado.");
  }

  const user = await adminDb.collection(USER_COLLECTION).doc(anonId).get();
  if (!user.exists) {
    throw new WalletIdentityError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
  }
  return Object.freeze({ ownerId: user.id, authMode: "anon-cookie" });
}

export async function resolveWalletIdentity(request: Request): Promise<WalletIdentity> {
  return (await resolveEmailSession(request)) ?? resolveAnonymousCookie();
}
