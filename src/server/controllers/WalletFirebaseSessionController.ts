import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { walletIdentityService } from "@/lib/users/WalletIdentityService";

const SESSION_COLLECTION = "WalletSessions";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export async function POST(request: NextRequest) {
  const authorization = await walletIdentityService.require(request);
  if (!authorization.ok) {
    return NextResponse.json({ ok: false, error: authorization.error }, { status: authorization.status });
  }
  if (authorization.identity.source !== "firebase") {
    return NextResponse.json({ ok: false, error: "Autenticação Firebase obrigatória." }, { status: 403 });
  }

  const token = randomBytes(32).toString("base64url");
  const email = authorization.identity.email;
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await adminDb.collection(SESSION_COLLECTION).doc(sha256(`${email}:${token}`)).set({
    email,
    uid: authorization.identity.uid,
    source: "firebase",
    createdAt: new Date(),
    expiresAt,
  });

  return NextResponse.json({
    ok: true,
    token,
    expiresAt: expiresAt.toISOString(),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const email = normalizedEmail(body.email);
  const token = String(body.token || "");
  if (!email || !token) {
    return NextResponse.json({ ok: false, error: "Sessão da carteira inválida." }, { status: 400 });
  }

  const reference = adminDb.collection(SESSION_COLLECTION).doc(sha256(`${email}:${token}`));
  const snapshot = await reference.get();
  if (snapshot.exists && normalizedEmail(snapshot.data()?.email) === email) {
    await reference.delete();
  }

  return NextResponse.json({ ok: true }, {
    headers: { "Cache-Control": "no-store" },
  });
}
