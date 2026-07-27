import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { saveMonthlyPortfolioSnapshot } from "@/lib/portfolioSnapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEB_WALLET_VERSION = 2;

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
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isFiiTicker(ticker: string) {
  return /^[A-Z0-9]{4,6}11$/.test(ticker);
}

function isExpired(value: any) {
  if (!value) return true;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return !date || Number.isNaN(date.getTime()) || date.getTime() < Date.now();
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

function cleanWallet(value: unknown): WalletItem[] {
  const items = Array.isArray(value)
    ? value.map(parseEntry)
    : value && typeof value === "object"
      ? Object.entries(value as Record<string, any>).map(([key, item]) => ({
          ticker: tickerOf(item?.ticker || item?.code || item?.fii || item?.symbol || key),
          quotas: quotaOf(item?.quotas ?? item?.quantity ?? item?.qtd ?? item?.shares ?? item?.cotas ?? item),
        }))
      : [];

  return items
    .filter((item) => isFiiTicker(item.ticker) && Number.isFinite(item.quotas) && item.quotas > 0)
    .slice(0, 120)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
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
  if (snap.exists) return { ref, snap, data: snap.data() || {}, docId: email };

  const query = await users.where("email", "==", email).limit(1).get();
  if (!query.empty) {
    const doc = query.docs[0];
    return { ref: doc.ref, snap: doc, data: doc.data() || {}, docId: doc.id };
  }

  return { ref, snap, data: {}, docId: email };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = emailOf(body?.email);

    if (!isEmail(email)) return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
    if (!(await hasSession(email, body?.sessionToken))) {
      return NextResponse.json({ ok: false, error: "Confirme o código antes de salvar a carteira." }, { status: 401 });
    }

    const wallet = cleanWallet(body?.wallet);
    const user = await findUser(email);

    await user.ref.set({
      email,
      wallet,
      source: user.data?.source || "web",
      walletSource: "web",
      version: user.data?.version || WEB_WALLET_VERSION,
      walletVersion: WEB_WALLET_VERSION,
      walletUpdatedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
      createdAt: user.snap.exists ? user.data?.createdAt || adminFieldValue.serverTimestamp() : adminFieldValue.serverTimestamp(),
    }, { merge: true });

    const snapshotResult = await saveMonthlyPortfolioSnapshot({ userDocId: user.docId, email, wallet }).catch((err) => {
      console.error("Wallet monthly snapshot error:", err);
      return { saved: false, reason: "snapshot_error" };
    });

    return NextResponse.json({
      ok: true,
      email,
      docId: user.docId,
      saved: wallet.length,
      incoming: wallet.length,
      walletVersion: WEB_WALLET_VERSION,
      mode: "replace",
      snapshot: snapshotResult,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao salvar carteira." }, { status: 500 });
  }
}
