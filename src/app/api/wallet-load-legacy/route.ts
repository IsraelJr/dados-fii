import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WalletItem = { ticker: string; quotas: number };

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function emailOf(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function tickerOf(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function quotaOf(value: unknown) {
  const parsed = Number(String(value ?? "1").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isExpired(value: any) {
  if (!value) return true;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return !date || Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

function validItem(item: WalletItem) {
  return /^[A-Z0-9]{4,8}$/.test(item.ticker) && Number.isFinite(item.quotas) && item.quotas > 0;
}

function parseEntry(value: any): WalletItem {
  if (typeof value === "string") return { ticker: tickerOf(value), quotas: 1 };

  const directTicker = tickerOf(value?.ticker || value?.code || value?.fii || value?.symbol);
  if (directTicker) {
    return { ticker: directTicker, quotas: quotaOf(value?.quotas ?? value?.quantity ?? value?.qtd ?? value?.shares ?? value?.cotas) };
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length === 1) {
      const [ticker, quotas] = entries[0];
      return { ticker: tickerOf(ticker), quotas: quotaOf(quotas) };
    }
  }

  return { ticker: "", quotas: 0 };
}

function walletFrom(value: unknown): WalletItem[] {
  if (Array.isArray(value)) {
    return value.map(parseEntry).filter(validItem).slice(0, 120).sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, any>)
      .map(([key, item]) => ({
        ticker: tickerOf(item?.ticker || item?.code || item?.fii || item?.symbol || key),
        quotas: quotaOf(item?.quotas ?? item?.quantity ?? item?.qtd ?? item?.shares ?? item?.cotas ?? item),
      }))
      .filter(validItem)
      .slice(0, 120)
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  return [];
}

function extractWallet(data: any): WalletItem[] {
  const candidates = [
    data?.wallet,
    data?.wallet?.items,
    data?.carteira,
    data?.carteira?.items,
    data?.carteira?.fiis,
    data?.fiis,
    data?.funds,
    data?.portfolio,
    data?.portfolio?.items,
    data?.portfolio?.fiis,
    data?.monitored?.fiis,
    data?.monitoredFiis,
    data?.selectedFiis,
    data?.favorites,
  ];

  for (const candidate of candidates) {
    const wallet = walletFrom(candidate);
    if (wallet.length) return wallet;
  }

  return [];
}

async function hasSession(email: string, token: unknown) {
  const sessionToken = String(token || "");
  if (!sessionToken) return false;

  const snap = await adminDb.collection("WalletSessions").doc(hash(`${email}:${sessionToken}`)).get();
  if (!snap.exists) return false;

  const data = snap.data() || {};
  return data.email === email && !isExpired(data.expiresAt);
}

async function findUser(email: string) {
  const users = adminDb.collection("User");
  const ref = users.doc(email);
  const snap = await ref.get();
  if (snap.exists) return { docId: email, data: snap.data() || {} };

  const query = await users.where("email", "==", email).limit(1).get();
  if (!query.empty) {
    const doc = query.docs[0];
    return { docId: doc.id, data: doc.data() || {} };
  }

  return null;
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

    const wallet = extractWallet(user.data);
    if (!wallet.length) {
      return NextResponse.json({ ok: false, error: "Carteira não encontrada no formato esperado.", docId: user.docId, fields: Object.keys(user.data || {}) }, { status: 404 });
    }

    return NextResponse.json({ ok: true, email, docId: user.docId, wallet, source: "UserLegacy" });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao carregar carteira." }, { status: 500 });
  }
}
