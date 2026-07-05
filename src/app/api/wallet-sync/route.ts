import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WalletItem = {
  ticker: string;
  quotas: number;
};

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function walletDocId(email: string) {
  return Buffer.from(email).toString("base64url");
}

function sanitizeWallet(value: unknown): WalletItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any) => ({
      ticker: String(item?.ticker || "").trim().toUpperCase(),
      quotas: Number(item?.quotas),
    }))
    .filter((item) => /^[A-Z0-9]{4,8}$/.test(item.ticker) && Number.isFinite(item.quotas) && item.quotas > 0)
    .slice(0, 120)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "save");
    const email = normalizeEmail(body?.email);

    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
    }

    const ref = adminDb.collection("Wallets").doc(walletDocId(email));

    if (action === "load") {
      const snap = await ref.get();
      if (!snap.exists) {
        return NextResponse.json({ ok: false, error: "Nenhuma carteira encontrada para este e-mail." }, { status: 404 });
      }

      const data = snap.data() || {};
      return NextResponse.json({
        ok: true,
        email,
        wallet: sanitizeWallet(data.wallet || []),
        updatedAt: data.updatedAt || null,
      });
    }

    const wallet = sanitizeWallet(body?.wallet);
    if (!wallet.length) {
      return NextResponse.json({ ok: false, error: "Adicione pelo menos um FII antes de salvar." }, { status: 400 });
    }

    await ref.set({
      email,
      wallet,
      updatedAt: adminFieldValue.serverTimestamp(),
      createdAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true, email, saved: wallet.length });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao sincronizar carteira." }, { status: 500 });
  }
}
