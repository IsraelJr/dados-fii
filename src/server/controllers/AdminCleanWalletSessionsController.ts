// Controlador de aplicação; o Route Handler permanece sem acesso à persistência.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { internalAuthError, requireAdminOrCron } from "@/lib/security/InternalRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authorization = await requireAdminOrCron(req, { scope: "clean-wallet-sessions" });
  if (!authorization.ok) return internalAuthError(authorization);

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 100), 1), 500);
  const now = new Date();
  const snapshot = await adminDb
    .collection("WalletSessions")
    .where("expiresAt", "<", now)
    .limit(limit)
    .get();

  const batch = adminDb.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));

  if (!snapshot.empty) await batch.commit();

  return NextResponse.json({
    ok: true,
    checkedAt: now.toISOString(),
    deleted: snapshot.size,
    limit,
    hasMore: snapshot.size === limit,
  });
}
