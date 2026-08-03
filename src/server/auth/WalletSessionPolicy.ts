import { createHash } from "node:crypto";

export const WALLET_SESSION_COLLECTION = "WalletSessions";
export const WALLET_SESSION_FAMILY_COLLECTION = "WalletSessionFamilies";
export const WALLET_FIREBASE_SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export type WalletSessionRecord = Readonly<{
  email?: unknown;
  uid?: unknown;
  source?: unknown;
  familyId?: unknown;
  generation?: unknown;
  expiresAt?: unknown;
}>;

export type WalletSessionFamilyRecord = Readonly<{
  email?: unknown;
  uid?: unknown;
  firebaseAuthTime?: unknown;
  status?: unknown;
  currentGeneration?: unknown;
  revokedBeforeGeneration?: unknown;
}>;

export function normalizeWalletSessionEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function walletSessionDocumentId(email: string, token: string) {
  return createHash("sha256").update(`${normalizeWalletSessionEmail(email)}:${token}`).digest("hex");
}

export function walletSessionFamilyDocumentId(uid: string, firebaseAuthTime: number) {
  return createHash("sha256").update(`${String(uid).trim()}:${firebaseAuthTime}`).digest("hex");
}

export function walletSessionExpiration(nowMs = Date.now()) {
  return new Date(nowMs + WALLET_FIREBASE_SESSION_DURATION_MS);
}

export function walletSessionIsExpired(value: unknown, nowMs = Date.now()) {
  if (!value) return true;
  const timestamp = value as { toDate?: () => Date };
  const date = value instanceof Date
    ? value
    : typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(String(value));
  return Number.isNaN(date.getTime()) || date.getTime() <= nowMs;
}

export function walletSessionMatches(
  session: Readonly<{ email?: unknown; expiresAt?: unknown }>,
  email: string,
  nowMs = Date.now(),
) {
  const normalizedEmail = normalizeWalletSessionEmail(email);
  return Boolean(normalizedEmail)
    && normalizeWalletSessionEmail(session.email) === normalizedEmail
    && !walletSessionIsExpired(session.expiresAt, nowMs);
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function walletSessionFamilyMatches(
  session: WalletSessionRecord,
  family: WalletSessionFamilyRecord,
  email: string,
  nowMs = Date.now(),
) {
  const generation = positiveInteger(session.generation);
  const currentGeneration = positiveInteger(family.currentGeneration);
  const revokedBeforeGeneration = positiveInteger(family.revokedBeforeGeneration);
  const uid = String(session.uid || "").trim();
  const firebaseAuthTime = positiveInteger(family.firebaseAuthTime);

  return walletSessionMatches(session, email, nowMs)
    && session.source === "firebase"
    && Boolean(String(session.familyId || ""))
    && Boolean(uid)
    && family.status === "active"
    && normalizeWalletSessionEmail(family.email) === normalizeWalletSessionEmail(email)
    && String(family.uid || "").trim() === uid
    && Boolean(firebaseAuthTime)
    && generation === currentGeneration
    && generation >= revokedBeforeGeneration;
}
