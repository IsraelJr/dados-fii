import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WalletItem = {
  ticker: string;
  quotas: number;
};

function allowedSecrets() {
  return [process.env.ADMIN_UPDATE_SECRET, process.env.CRON_SECRET].filter(Boolean);
}

function isAuthorized(req: NextRequest) {
  const secrets = allowedSecrets();
  if (!secrets.length) return false;

  const authHeader = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-admin-secret") || authHeader.replace(/^Bearer\s+/i, "");
  const querySecret = req.nextUrl.searchParams.get("secret");

  return [headerSecret, querySecret].some((value) => Boolean(value && secrets.includes(value)));
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeTicker(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeQuotas(value: unknown) {
  const parsed = Number(String(value ?? "1").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function typeOfValue(value: any): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value?.toDate === "function") return "timestamp";
  if (typeof value === "object") return `map(${Object.keys(value).length})`;
  return typeof value;
}

function safePreview(value: any, depth = 0): any {
  if (depth > 2) return typeOfValue(value);
  if (value === null || value === undefined) return value;
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.slice(0, 5).map((item) => safePreview(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 12)
        .map(([key, item]) => [key, safePreview(item, depth + 1)])
    );
  }
  return String(value);
}

function walletFromObjectMap(value: Record<string, any>): WalletItem[] {
  return Object.entries(value)
    .map(([key, item]) => {
      const ticker = normalizeTicker((item as any)?.ticker || (item as any)?.code || (item as any)?.fii || (item as any)?.symbol || key);
      const quotas = normalizeQuotas((item as any)?.quotas ?? (item as any)?.quantity ?? (item as any)?.qtd ?? (item as any)?.shares ?? (item as any)?.cotas ?? item);
      return { ticker, quotas };
    })
    .filter((item) => /^[A-Z0-9]{4,8}$/.test(item.ticker) && Number.isFinite(item.quotas) && item.quotas > 0);
}

function sanitizeWallet(value: unknown): WalletItem[] {
  if (Array.isArray(value)) {
    return value
      .map((item: any) => {
        if (typeof item === "string") return { ticker: normalizeTicker(item), quotas: 1 };
        return {
          ticker: normalizeTicker(item?.ticker || item?.code || item?.fii || item?.symbol),
          quotas: normalizeQuotas(item?.quotas ?? item?.quantity ?? item?.qtd ?? item?.shares ?? item?.cotas),
        };
      })
      .filter((item) => /^[A-Z0-9]{4,8}$/.test(item.ticker) && Number.isFinite(item.quotas) && item.quotas > 0)
      .slice(0, 120)
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  if (value && typeof value === "object") {
    return walletFromObjectMap(value as Record<string, any>)
      .slice(0, 120)
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  return [];
}

function inspectCandidates(data: any) {
  const candidates: Array<{ path: string; value: any }> = [
    { path: "wallet", value: data?.wallet },
    { path: "wallet.items", value: data?.wallet?.items },
    { path: "carteira", value: data?.carteira },
    { path: "carteira.items", value: data?.carteira?.items },
    { path: "carteira.fiis", value: data?.carteira?.fiis },
    { path: "fiis", value: data?.fiis },
    { path: "funds", value: data?.funds },
    { path: "portfolio", value: data?.portfolio },
    { path: "portfolio.items", value: data?.portfolio?.items },
    { path: "portfolio.fiis", value: data?.portfolio?.fiis },
    { path: "monitored.fiis", value: data?.monitored?.fiis },
    { path: "monitoredFiis", value: data?.monitoredFiis },
    { path: "selectedFiis", value: data?.selectedFiis },
    { path: "favorites", value: data?.favorites },
  ];

  return candidates
    .filter((candidate) => candidate.value !== undefined)
    .map((candidate) => {
      const parsed = sanitizeWallet(candidate.value);
      return {
        path: candidate.path,
        type: typeOfValue(candidate.value),
        parsedCount: parsed.length,
        parsedPreview: parsed.slice(0, 10),
        preview: safePreview(candidate.value),
      };
    });
}

async function findUserDoc(email: string) {
  const users = adminDb.collection("User");
  const candidates = Array.from(new Set([email, normalizeEmail(email)]));

  for (const docId of candidates) {
    const ref = users.doc(docId);
    const snap = await ref.get();
    if (snap.exists) return { docId, data: snap.data() || {} };
  }

  const querySnap = await users.where("email", "==", normalizeEmail(email)).limit(1).get();
  if (!querySnap.empty) {
    const doc = querySnap.docs[0];
    return { docId: doc.id, data: doc.data() || {} };
  }

  return null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const email = normalizeEmail(req.nextUrl.searchParams.get("email"));
  if (!email) {
    return NextResponse.json({ ok: false, error: "Informe o parâmetro email." }, { status: 400 });
  }

  const result = await findUserDoc(email);
  if (!result) {
    return NextResponse.json({ ok: false, error: "Documento não encontrado.", email }, { status: 404 });
  }

  const fields = Object.entries(result.data).map(([key, value]) => ({
    key,
    type: typeOfValue(value),
    preview: safePreview(value),
  }));

  return NextResponse.json({
    ok: true,
    email,
    docId: result.docId,
    fieldCount: fields.length,
    fields,
    walletCandidates: inspectCandidates(result.data),
  });
}
