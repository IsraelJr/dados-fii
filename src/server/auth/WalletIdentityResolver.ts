import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  normalizeWalletSessionEmail,
} from "@/server/auth/WalletSessionPolicy";
import { walletSessionStore } from "@/server/auth/FirebaseWalletSessionStore";
const USER_COLLECTION = "User";

export type WalletIdentity = Readonly<{
  ownerId: string;
  authMode: "email-session" | "anon-cookie";
}>;

export type WalletIdentityErrorCode =
  | "WALLET_SESSION_REQUIRED"
  | "USER_NOT_IDENTIFIED"
  | "USER_NOT_FOUND";

export class WalletIdentityError extends Error {
  readonly status: 401 | 404;
  readonly code: WalletIdentityErrorCode;

  constructor(status: 401 | 404, code: WalletIdentityErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "WalletIdentityError";
  }
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function resolveEmailSession(request: Request): Promise<WalletIdentity | null> {
  const email = normalizeWalletSessionEmail(request.headers.get("x-wallet-email"));
  const token = String(request.headers.get("x-wallet-session") ?? "");
  if (!email && !token) return null;
  if (!isEmail(email) || !token) {
    throw new WalletIdentityError(401, "WALLET_SESSION_REQUIRED", "Sessão da carteira inválida.");
  }

  if (!await walletSessionStore.verify(email, token)) {
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
