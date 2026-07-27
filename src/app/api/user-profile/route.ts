import { NextRequest, NextResponse } from "next/server";
import { userRepository } from "@/lib/users/UserRepository";
import { walletIdentityService } from "@/lib/users/WalletIdentityService";

export async function POST(request: NextRequest) {
  const authorization = await walletIdentityService.require(request);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  if (authorization.identity.source !== "firebase" || !authorization.identity.uid) {
    return NextResponse.json({ error: "Autenticação Firebase obrigatória." }, { status: 403 });
  }
  const anonId = String(request.cookies.get("anonId")?.value || "").trim();
  if (anonId && !/^[A-Za-z0-9-]{16,80}$/.test(anonId)) {
    return NextResponse.json({ error: "Identificador anônimo inválido." }, { status: 400 });
  }
  await userRepository.upsertAuthenticatedProfile({
    uid: authorization.identity.uid,
    email: authorization.identity.email,
    anonId: anonId || null,
  });
  return NextResponse.json({ ok: true });
}
