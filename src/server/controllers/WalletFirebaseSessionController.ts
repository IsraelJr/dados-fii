import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { walletIdentityService } from "@/lib/users/WalletIdentityService";
import {
  normalizeWalletSessionEmail,
  walletSessionExpiration,
} from "@/server/auth/WalletSessionPolicy";
import {
  WalletSessionFamilyRevokedError,
} from "@/server/auth/WalletSessionStore";
import { walletSessionStore } from "@/server/auth/FirebaseWalletSessionStore";

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
  try {
    await walletSessionStore.issueFirebaseSession({
      email,
      uid: authorization.identity.uid || "",
      firebaseAuthTime: authorization.identity.firebaseAuthTime || 0,
      token,
      expiresAt,
    });
  } catch (error) {
    if (error instanceof WalletSessionFamilyRevokedError) {
      return NextResponse.json({ ok: false, error: "Faça login novamente para iniciar uma nova sessão." }, {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }
    throw error;
  }

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

  await walletSessionStore.revokeFamily(email, token);

  return NextResponse.json({ ok: true }, {
    headers: { "Cache-Control": "no-store" },
  });
}
