import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, type AdminIdentity } from "@/lib/adminSecurity";

export type InternalIdentity =
  | { type: "cron"; actor: "cron:vercel" }
  | { type: "admin"; actor: string; admin: AdminIdentity };

export type InternalAuthorization =
  | { ok: true; identity: InternalIdentity }
  | { ok: false; status: 401 | 403 | 429 | 503; error: string; retryAfter?: number };

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer ([^\s]+)$/);
  return match?.[1] || "";
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyCronBearer(request: NextRequest): InternalAuthorization {
  const expected = String(process.env.CRON_SECRET || "");
  if (!expected) return { ok: false, status: 503, error: "Autenticação interna não configurada." };
  const provided = bearerToken(request);
  if (!provided || !constantTimeEqual(provided, expected)) {
    return { ok: false, status: 401, error: "Credencial interna inválida." };
  }
  return { ok: true, identity: { type: "cron", actor: "cron:vercel" } };
}

export async function requireCron(request: NextRequest): Promise<InternalAuthorization> {
  return verifyCronBearer(request);
}

export async function requireAdminOrCron(
  request: NextRequest,
  options?: { scope?: string; limit?: number; windowMs?: number },
): Promise<InternalAuthorization> {
  if (request.headers.has("authorization")) return verifyCronBearer(request);
  const authorization = await requireAdmin(request, options);
  if (!authorization.ok) return authorization;
  return {
    ok: true,
    identity: {
      type: "admin",
      actor: `admin:${authorization.identity.uid}`,
      admin: authorization.identity,
    },
  };
}

export function internalAuthError(authorization: Extract<InternalAuthorization, { ok: false }>) {
  return NextResponse.json(
    { error: authorization.error },
    {
      status: authorization.status,
      headers: authorization.retryAfter ? { "Retry-After": String(authorization.retryAfter) } : undefined,
    },
  );
}
