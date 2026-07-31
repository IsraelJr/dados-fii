import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { walletIdentityService } from "@/lib/users/WalletIdentityService";
import {
  normalizeWalletSessionEmail,
  WALLET_SESSION_COLLECTION,
  walletSessionDocumentId,
  walletSessionExpiration,
} from "@/server/auth/WalletSessionPolicy";

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
  const expiresAt = walletSessionExpiration();
  await adminDb.collection(WALLET_SESSION_COLLECTION).doc(walletSessionDocumentId(email, token)).set({
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
  const email = normalizeWalletSessionEmail(body.email);
  const token = String(body.token || "");
  if (!email || !token) {
    return NextResponse.json({ ok: false, error: "Sessão da carteira inválida." }, { status: 400 });
  }

  const reference = adminDb.collection(WALLET_SESSION_COLLECTION).doc(walletSessionDocumentId(email, token));
  const snapshot = await reference.get();
  if (snapshot.exists && normalizeWalletSessionEmail(snapshot.data()?.email) === email) {
    await reference.delete();
  }

  return NextResponse.json({ ok: true }, {
    headers: { "Cache-Control": "no-store" },
  });
}
