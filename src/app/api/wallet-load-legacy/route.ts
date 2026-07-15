import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { extractUserWallet } from "@/lib/userWallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function emailOf(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isExpired(value: unknown) {
  if (!value) return true;
  const date = typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate(): Date }).toDate()
    : new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

async function hasSession(email: string, token: unknown) {
  const sessionToken = String(token || "");
  if (!sessionToken) return false;
  const snapshot = await adminDb.collection("WalletSessions").doc(hash(`${email}:${sessionToken}`)).get();
  if (!snapshot.exists) return false;
  const data = snapshot.data() || {};
  return data.email === email && !isExpired(data.expiresAt);
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
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao carregar carteira." }, { status: 500 });
  }
}
