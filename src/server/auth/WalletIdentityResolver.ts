import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  resolveEmailSessionWithDependencies,
  VerifiedWalletIdentityCoreError,
} from "./VerifiedWalletIdentityCore";
import { firestoreVerifiedWalletIdentityDependencies } from "./FirestoreVerifiedWalletIdentity";

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

async function resolveEmailSession(request: Request): Promise<WalletIdentity | null> {
  try {
    return await resolveEmailSessionWithDependencies(
      request,
      firestoreVerifiedWalletIdentityDependencies(adminDb),
    );
  } catch (error) {
    if (error instanceof VerifiedWalletIdentityCoreError) {
      throw new WalletIdentityError(error.status, error.code, error.message);
    }
    throw error;
  }
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

export async function resolveVerifiedWalletIdentity(request: Request): Promise<WalletIdentity> {
  const identity = await resolveEmailSession(request);
  if (!identity || identity.authMode !== "email-session") {
    throw new WalletIdentityError(
      401,
      "WALLET_SESSION_REQUIRED",
      "Sessão verificada da carteira obrigatória.",
    );
  }
  return identity;
}
