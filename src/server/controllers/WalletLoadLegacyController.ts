import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { extractUserWallet } from "@/lib/userWallet";
import { walletSessionStore } from "@/server/auth/FirebaseWalletSessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emailOf(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function hasSession(email: string, token: unknown) {
  return walletSessionStore.verify(email, token);
}

async function findUser(email: string) {
  const users = adminDb.collection("User");
  const direct = await users.doc(email).get();
  if (direct.exists) return { docId: direct.id, data: direct.data() || {} };
  const query = await users.where("email", "==", email).limit(1).get();
  if (query.empty) return null;
  const document = query.docs[0];
  return { docId: document.id, data: document.data() || {} };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = emailOf(body?.email);
    if (!isEmail(email)) return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
    if (!(await hasSession(email, body?.sessionToken))) {
      return NextResponse.json({ ok: false, error: "Confirme o código antes de carregar a carteira." }, { status: 401 });
    }
    const user = await findUser(email);
    if (!user) return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
    const wallet = extractUserWallet(user.data);
    if (!wallet.length) {
      return NextResponse.json({
        ok: false,
        error: "O usuário foi encontrado, mas não há posições com ticker e quantidade reconhecíveis.",
        code: "WALLET_FORMAT_UNRECOGNIZED",
        docId: user.docId,
        fields: Object.keys(user.data).slice(0, 40),
      }, { status: 422 });
    }
    return NextResponse.json({ ok: true, email, docId: user.docId, wallet, source: "UserLegacy" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Erro ao carregar carteira." }, { status: 500 });
  }
}
