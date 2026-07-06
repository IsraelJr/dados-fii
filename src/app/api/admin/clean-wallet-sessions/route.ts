import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowedSecrets() {
  return [process.env.ADMIN_UPDATE_SECRET, process.env.CRON_SECRET].filter(Boolean);
}

function isAuthorized(req: NextRequest) {
  const secrets = allowedSecrets();
  if (!secrets.length) return false;

  const authHeader = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-admin-secret") || authHeader.replace(/^Bearer\s+/i, "");
  const querySecret = req.nextUrl.searchParams.get("secret");

  return [headerSecret, querySecret].some((value) => Boolean(value && secrets.includes(value)));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

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
