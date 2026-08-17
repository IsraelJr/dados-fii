import { createHash } from "node:crypto";

export type VerifiedWalletSessionRecord = Readonly<{
  email?: unknown;
  expiresAt?: unknown;
}>;

export type VerifiedWalletIdentityDependencies = Readonly<{
  readSession(documentId: string): Promise<VerifiedWalletSessionRecord | null>;
  findOwnerId(email: string): Promise<string | null>;
  now?: () => number;
}>;

export type VerifiedWalletIdentity = Readonly<{
  ownerId: string;
  authMode: "email-session";
}>;

export type VerifiedWalletIdentityFailure = Readonly<{
  status: 401 | 404;
  code: "WALLET_SESSION_REQUIRED" | "USER_NOT_FOUND";
  message: string;
}>;

export class VerifiedWalletIdentityCoreError extends Error {
  readonly status: 401 | 404;
  readonly code: VerifiedWalletIdentityFailure["code"];

  constructor(failure: VerifiedWalletIdentityFailure) {
    super(failure.message);
    this.name = "VerifiedWalletIdentityCoreError";
    this.status = failure.status;
    this.code = failure.code;
  }
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function verifiedWalletSessionDocumentId(email: string, token: string) {
  return createHash("sha256").update(`${email}:${token}`).digest("hex");
}

function isExpired(value: unknown, now: number) {
  if (!value) return true;
  const timestamp = value as { toDate?: () => Date };
  const date = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(String(value));
  return Number.isNaN(date.getTime()) || date.getTime() <= now;
}

const invalidSession = Object.freeze({
  status: 401 as const,
  code: "WALLET_SESSION_REQUIRED" as const,
  message: "Sessão da carteira inválida.",
});

export async function resolveEmailSessionWithDependencies(
  request: Request,
  dependencies: VerifiedWalletIdentityDependencies,
): Promise<VerifiedWalletIdentity | null> {
  const email = normalizeEmail(request.headers.get("x-wallet-email"));
  const token = String(request.headers.get("x-wallet-session") ?? "");
  if (!email && !token) return null;
  if (!isEmail(email) || !token) throw new VerifiedWalletIdentityCoreError(invalidSession);

  const session = await dependencies.readSession(verifiedWalletSessionDocumentId(email, token));
  if (!session) throw new VerifiedWalletIdentityCoreError(invalidSession);
  if (
    normalizeEmail(session.email) !== email
    || isExpired(session.expiresAt, (dependencies.now ?? Date.now)())
  ) {
    throw new VerifiedWalletIdentityCoreError({
      status: 401,
      code: "WALLET_SESSION_REQUIRED",
      message: "Sessão da carteira expirada.",
    });
  }

  const ownerId = String(await dependencies.findOwnerId(email) ?? "").trim();
  if (!ownerId) {
    throw new VerifiedWalletIdentityCoreError({
      status: 404,
      code: "USER_NOT_FOUND",
      message: "Usuário não encontrado.",
    });
  }
  return Object.freeze({ ownerId, authMode: "email-session" });
}
