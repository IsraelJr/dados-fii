import { createHash } from "node:crypto";

const SENSITIVE_KEY = /authorization|cookie|email|token|secret|password|otp|verification.?code|session/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const INLINE_SECRET = /\b(token|secret|password|otp|verification.?code|session|cookie)\s*[:=]\s*[^\s,;]+/gi;

function cleanString(value: string) {
  return value
    .replace(INLINE_SECRET, "$1=[redacted]")
    .replace(EMAIL, "[redacted-email]")
    .replace(BEARER, "Bearer [redacted]")
    .replace(JWT, "[redacted-jwt]")
    .slice(0, 1_000);
}

export function sanitizeForLog(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (depth > 4) return "[truncated]";
  if (typeof value === "string") return cleanString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (value instanceof Error) return { name: cleanString(value.name), message: cleanString(value.message) };
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeForLog(item, key, depth + 1));
  if (!value || typeof value !== "object") return String(value);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 50)
      .map(([itemKey, item]) => [itemKey, sanitizeForLog(item, itemKey, depth + 1)]),
  );
}

export function pseudonymousLogId(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized
    ? createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 16)
    : "unknown";
}

export function safeLog(
  level: "info" | "warn" | "error",
  event: string,
  metadata: Record<string, unknown> = {},
) {
  const payload = JSON.stringify({
    event,
    at: new Date().toISOString(),
    ...sanitizeForLog(metadata) as Record<string, unknown>,
  });
  console[level](payload);
}
