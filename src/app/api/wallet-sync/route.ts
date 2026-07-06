import { createHash, randomBytes, randomInt } from "crypto";
import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_TTL_MINUTES = 10;
const SESSION_TTL_DAYS = 30;
const WEB_WALLET_VERSION = 1;

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

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function makeCode() {
  return String(randomInt(100000, 1000000));
}

function makeSessionToken() {
  return randomBytes(32).toString("base64url");
}

function futureDate(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function futureDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function normalizeTicker(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeQuotas(value: unknown) {
  const parsed = Number(String(value ?? "1").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function sanitizeWallet(value: unknown): WalletItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any) => {
      if (typeof item === "string") return { ticker: normalizeTicker(item), quotas: 1 };
      return {
        ticker: normalizeTicker(item?.ticker || item?.code || item?.fii || item?.symbol),
        quotas: normalizeQuotas(item?.quotas ?? item?.quantity ?? item?.qtd ?? item?.shares),
      };
    })
    .filter((item) => /^[A-Z0-9]{4,8}$/.test(item.ticker) && Number.isFinite(item.quotas) && item.quotas > 0)
    .slice(0, 120)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function extractUserWallet(data: any): WalletItem[] {
  const candidates = [
    data?.wallet,
    data?.carteira,
    data?.fiis,
    data?.funds,
    data?.portfolio,
    data?.monitored?.fiis,
  ];

  for (const candidate of candidates) {
    const wallet = sanitizeWallet(candidate);
    if (wallet.length) return wallet;
  }

  return [];
}

function mergeWallets(existing: WalletItem[], incoming: WalletItem[]) {
  const map = new Map<string, WalletItem>();

  existing.forEach((item) => map.set(item.ticker, item));
  incoming.forEach((item) => map.set(item.ticker, item));

  return Array.from(map.values())
    .slice(0, 120)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function isExpired(value: any) {
  if (!value) return true;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return !date || Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

async function requireVerifiedSession(email: string, token: unknown) {
  const sessionToken = String(token || "");
  if (!sessionToken) return false;

  const snap = await adminDb.collection("WalletSessions").doc(hash(`${email}:${sessionToken}`)).get();
  if (!snap.exists) return false;

  const data = snap.data() || {};
  return data.email === email && !isExpired(data.expiresAt);
}

async function sendWalletCode(email: string, code: string) {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.WALLET_EMAIL_FROM || "Dados FII <no-reply@dadosfii.com.br>";

  if (!resendKey) {
    console.log(`[wallet-sync] Código de verificação para ${email}: ${code}`);
    return { sent: false, provider: "console" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Código para acessar sua carteira Dados FII",
      text: `Seu código para acessar sua carteira Dados FII é ${code}. Ele expira em ${CODE_TTL_MINUTES} minutos.`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[wallet-sync] Resend error", {
      status: response.status,
      from,
      error: errorText,
    });

    throw new Error(`Não foi possível enviar o código por e-mail. Resend HTTP ${response.status}. ${errorText}`.trim());
  }

  return { sent: true, provider: "resend" };
}

async function getUserDoc(email: string) {
  const ref = adminDb.collection("User").doc(email);
  const snap = await ref.get();
  return { ref, snap, data: snap.exists ? snap.data() || {} : {} };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "save");
    const email = normalizeEmail(body?.email);

    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
    }

    if (action === "request-code") {
      const code = makeCode();
      await adminDb.collection("WalletVerificationCodes").doc(hash(email)).set({
        email,
        codeHash: hash(`${email}:${code}`),
        expiresAt: futureDate(CODE_TTL_MINUTES),
        createdAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });

      const delivery = await sendWalletCode(email, code);
      return NextResponse.json({
        ok: true,
        email,
        sent: delivery.sent,
        message: delivery.sent
          ? "Código enviado para o seu e-mail."
          : "Código gerado. Configure RESEND_API_KEY para envio real por e-mail.",
      });
    }

    if (action === "verify-code") {
      const code = String(body?.code || "").trim();
      const codeRef = adminDb.collection("WalletVerificationCodes").doc(hash(email));
      const snap = await codeRef.get();

      if (!snap.exists) {
        return NextResponse.json({ ok: false, error: "Solicite um novo código." }, { status: 401 });
      }

      const data = snap.data() || {};
      const valid = data.email === email && data.codeHash === hash(`${email}:${code}`) && !isExpired(data.expiresAt);

      if (!valid) {
        return NextResponse.json({ ok: false, error: "Código inválido ou expirado." }, { status: 401 });
      }

      const sessionToken = makeSessionToken();
      await adminDb.collection("WalletSessions").doc(hash(`${email}:${sessionToken}`)).set({
        email,
        createdAt: adminFieldValue.serverTimestamp(),
        expiresAt: futureDays(SESSION_TTL_DAYS),
      });
      await codeRef.delete();

      return NextResponse.json({ ok: true, email, sessionToken, expiresInDays: SESSION_TTL_DAYS });
    }

    const verified = await requireVerifiedSession(email, body?.sessionToken);
    if (!verified) {
      return NextResponse.json({ ok: false, error: "Confirme o código enviado para o e-mail antes de acessar a carteira." }, { status: 401 });
    }

    const { ref: userRef, snap: userSnap, data: userData } = await getUserDoc(email);

    if (action === "load") {
      const wallet = extractUserWallet(userData);
      if (!wallet.length) {
        return NextResponse.json({ ok: false, error: "Nenhuma carteira encontrada para este e-mail." }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        email,
        wallet,
        source: "User",
        updatedAt: userData.walletUpdatedAt || userData.updatedAt || null,
      });
    }

    if (action === "save") {
      const incomingWallet = sanitizeWallet(body?.wallet);
      if (!incomingWallet.length) {
        return NextResponse.json({ ok: false, error: "Adicione pelo menos um FII antes de salvar." }, { status: 400 });
      }

      const existingWallet = extractUserWallet(userData);
      const wallet = mergeWallets(existingWallet, incomingWallet);

      await userRef.set({
        email,
        wallet,
        source: userData.source || "web",
        walletSource: "web",
        version: userData.version || WEB_WALLET_VERSION,
        walletVersion: WEB_WALLET_VERSION,
        walletUpdatedAt: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
        createdAt: userSnap.exists ? userData.createdAt || adminFieldValue.serverTimestamp() : adminFieldValue.serverTimestamp(),
      }, { merge: true });

      return NextResponse.json({
        ok: true,
        email,
        source: "User",
        saved: wallet.length,
        existing: existingWallet.length,
        incoming: incomingWallet.length,
        walletVersion: WEB_WALLET_VERSION,
      });
    }

    return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao sincronizar carteira." }, { status: 500 });
  }
}
