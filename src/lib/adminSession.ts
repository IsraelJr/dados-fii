import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE = "dados-fii-admin-session";

const DEFAULT_SESSION_SECONDS = 8 * 60 * 60;
const MIN_SESSION_SECONDS = 15 * 60;
const MAX_SESSION_SECONDS = 24 * 60 * 60;

type AdminSessionPayload = {
  version: 1;
  user: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_UPDATE_SECRET ||
    process.env.CRON_SECRET ||
    ""
  );
}

function firstConfiguredAdminEmail() {
  return String(
    process.env.ADMIN_EMAILS ||
    process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
    ""
  )
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .find(Boolean) || "";
}

export function expectedAdminUser() {
  return String(process.env.ADMIN_USER || firstConfiguredAdminEmail() || "admin").trim();
}

export function adminSessionDurationSeconds() {
  const configured = Number(process.env.ADMIN_SESSION_TTL_SECONDS || DEFAULT_SESSION_SECONDS);
  if (!Number.isFinite(configured)) return DEFAULT_SESSION_SECONDS;
  return Math.min(Math.max(Math.floor(configured), MIN_SESSION_SECONDS), MAX_SESSION_SECONDS);
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function validateAdminCredentials(_userValue: unknown, tokenValue: unknown) {
  const token = String(tokenValue || "");
  const expectedToken = process.env.ADMIN_UPDATE_SECRET || process.env.CRON_SECRET || "";
  if (!expectedToken || !sessionSecret()) return false;
  return safeEqual(token, expectedToken);
}

export function createAdminSessionToken() {
  const user = expectedAdminUser();
  const secret = sessionSecret();

  if (!secret || !user) {
    throw new Error("Sessão administrativa não configurada.");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + adminSessionDurationSeconds();
  const payload: AdminSessionPayload = {
    version: 1,
    user,
    issuedAt,
    expiresAt,
    nonce: randomBytes(16).toString("hex"),
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return {
    token: `${encodedPayload}.${signature(encodedPayload, secret)}`,
    payload,
  };
}

export function verifyAdminSessionToken(tokenValue: unknown): AdminSessionPayload | null {
  const token = String(tokenValue || "");
  const secret = sessionSecret();
  if (!token || !secret) return null;

  const [encodedPayload, receivedSignature, extra] = token.split(".");
  if (!encodedPayload || !receivedSignature || extra) return null;
  if (!safeEqual(receivedSignature, signature(encodedPayload, secret))) return null;

  try {
    const payload = JSON.parse(decode(encodedPayload)) as AdminSessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.version !== 1) return null;
    if (!payload.user || payload.user !== expectedAdminUser()) return null;
    if (!Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt)) return null;
    if (payload.issuedAt > now + 300 || payload.expiresAt <= now) return null;
    if (payload.expiresAt - payload.issuedAt > MAX_SESSION_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readAdminSession(req: NextRequest) {
  return verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

function allowedLegacySecrets() {
  return [process.env.ADMIN_UPDATE_SECRET, process.env.CRON_SECRET].filter(
    (value): value is string => Boolean(value)
  );
}

export function hasLegacyAdminSecret(req: NextRequest, body?: any) {
  const secrets = allowedLegacySecrets();
  if (!secrets.length) return false;

  const authorization = req.headers.get("authorization") || "";
  const headerSecret =
    req.headers.get("x-admin-secret") || authorization.replace(/^Bearer\s+/i, "");
  const querySecret = req.nextUrl.searchParams.get("secret") || "";
  const bodySecret = String(body?.secret || "");

  return [headerSecret, querySecret, bodySecret].some((value) =>
    secrets.some((secret) => safeEqual(value, secret))
  );
}

export function isAdminAuthorized(req: NextRequest, body?: any) {
  return Boolean(readAdminSession(req) || hasLegacyAdminSecret(req, body));
}

export function setAdminSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: number
) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt * 1000),
    maxAge: Math.max(expiresAt - Math.floor(Date.now() / 1000), 0),
  });
  return response;
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
