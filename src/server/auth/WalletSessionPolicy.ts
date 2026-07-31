import { createHash } from "node:crypto";

export const WALLET_SESSION_COLLECTION = "WalletSessions";
export const WALLET_FIREBASE_SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export function normalizeWalletSessionEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function walletSessionDocumentId(email: string, token: string) {
  return createHash("sha256").update(`${normalizeWalletSessionEmail(email)}:${token}`).digest("hex");
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
