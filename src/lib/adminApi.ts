import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type AdminIdentity } from "@/lib/adminSecurity";

export function adminJson(payload: unknown, status = 200, retryAfter?: number) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
    },
  });
}

export async function authorizeAdminRequest(
  req: NextRequest,
  scope: string,
  options?: { limit?: number; windowMs?: number }
): Promise<{ identity: AdminIdentity; rejection?: never } | { identity?: never; rejection: NextResponse }> {
  const authorization = await requireAdmin(req, { scope, ...options });
  if (!authorization.ok) {
    return { rejection: adminJson({ ok: false, error: authorization.error }, authorization.status, authorization.retryAfter) };
  }
  return { identity: authorization.identity };
}
