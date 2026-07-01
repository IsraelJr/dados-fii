import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TIME_ZONE = "America/Sao_Paulo";

type UpdateResult = {
  ticker: string;
  status: "updated" | "still_missing" | "error" | "skipped";
  fetchedMonths?: string[];
  error?: string;
};

function adminSecret() {
  return process.env.ADMIN_UPDATE_SECRET || process.env.CRON_SECRET || "";
}

function isAuthorized(req: NextRequest, body?: any) {
  const expected = adminSecret();
  if (!expected) return false;

  const headerSecret = req.headers.get("x-admin-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const bodySecret = body?.secret;

  return [headerSecret, querySecret, bodySecret].some((value) => value === expected);
}

function saoPauloParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function currentYear() {
  return Number(saoPauloParts().year);
}

function currentMonthKey() {
  return MONTHS[Number(saoPauloParts().month) - 1];
}

function clean(html: string) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function noAccent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tickerOf(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

async function getStatusInvestPage(ticker: string) {
  const code = ticker.toLowerCase();
  const urls = [
    `https://statusinvest.com.br/fundos-imobiliarios/${code}`,
    `https://statusinvest.com.br/fiagros/${code}`,
    `https://statusinvest.com.br/fiinfras/${code}`,
  ];
  const ignored: string[] = [];

  for (const url of urls) {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    });

    if (!res.ok) {
      ignored.push(`${url} HTTP ${res.status}`);
      continue;
    }

    const html = await res.text();
    const text = clean(html);
    const upperText = text.toUpperCase();
    const normalized = noAccent(upperText);

    if (normalized.includes("OPS") && normalized.includes("NAO ENCONTRAMOS")) {
      ignored.push(`${url} não encontrado`);
      continue;
    }

    if (!upperText.includes(ticker)) {
      ignored.push(`${url} sem ticker`);
      continue;
    }

    if (!upperText.includes("TIPO DATA COM") && !upperText.includes("DIVIDENDOS DO")) {
      ignored.push(`${url} sem dividendos`);
      continue;
    }

    return { text, url };
  }

  throw new Error(`Nenhuma página válida encontrada. ${ignored.join(" | ")}`);
}

function parseDividends(text: string, year: number) {
  const output: Record<string, any> = {};
  const parts = text.split("Rendimento ").slice(1);

  for (const part of parts) {
    const tokens = part.trim().split(" ");
    const dateWith = tokens[0];
    const paymentDate = tokens[1];
    const value = tokens[2];

    if (!dateWith || !paymentDate || !value) continue;
    if (!paymentDate.includes(`/${year}`)) continue;

    const [, month] = paymentDate.match(/\d{2}\/(\d{2})\/\d{4}/) || [];
    const monthName = MONTHS[Number(month) - 1];
    if (!monthName) continue;

    output[monthName] = {
      payment_date: paymentDate,
      date_with: dateWith,
      earnings: value.startsWith("R$") ? value : `R$ ${value}`,
      price_date_with: "R$ 0,0",
    };
  }

  return output;
}

async function updateDocDividends(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot, ticker: string): Promise<UpdateResult> {
  try {
    const year = currentYear();
    const monthKey = currentMonthKey();
    const previous = doc.data() || {};
    const field = `earnings${year}`;
    const previousYear = previous[field] || {};

    if (previousYear?.[monthKey]) {
      return { ticker, status: "skipped", fetchedMonths: Object.keys(previousYear) };
    }

    const page = await getStatusInvestPage(ticker);
    const fetched = parseDividends(page.text, year);
    const fetchedMonths = Object.keys(fetched).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));

    if (!fetchedMonths.length) {
      return { ticker, status: "still_missing", fetchedMonths: [] };
    }

    const merged = { ...previousYear, ...fetched };

    await adminDb.collection("Fiis_Backup").doc(`${ticker}_${Date.now()}`).set({
      ...previous,
      backup_date: adminFieldValue.serverTimestamp(),
      backup_reason: "admin-pending-month-dividend-update",
    }, { merge: false });

    await doc.ref.set({
      [field]: merged,
      modified_in: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      ticker,
      status: merged?.[monthKey] ? "updated" : "still_missing",
      fetchedMonths,
    };
  } catch (err: any) {
    return { ticker, status: "error", error: err.message || "Erro desconhecido" };
  }
}

async function runPendingUpdate(limit: number, tickersFilter?: string[]) {
  const year = currentYear();
  const monthKey = currentMonthKey();
  const field = `earnings${year}`;
  const normalizedFilter = Array.isArray(tickersFilter)
    ? tickersFilter.map(tickerOf).filter(Boolean)
    : [];

  const snapshot = await adminDb.collection("Fiis").limit(5000).get();
  const pending = snapshot.docs
    .filter((doc) => {
      const data = doc.data() || {};
      const ticker = tickerOf(data.code || doc.id);
      if (!ticker) return false;
      if (normalizedFilter.length && !normalizedFilter.includes(ticker)) return false;
      return !data?.[field]?.[monthKey];
    })
    .slice(0, limit);

  const results: UpdateResult[] = [];

  for (const doc of pending) {
    const data = doc.data() || {};
    const ticker = tickerOf(data.code || doc.id);
    results.push(await updateDocDividends(doc, ticker));
  }

  const summary = results.reduce((acc: Record<string, number>, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  await adminDb.collection("Parameters").doc("PendingDividendUpdateRuns").collection("runs").add({
    year,
    monthKey,
    limit,
    requestedTickers: normalizedFilter,
    pendingFound: pending.length,
    summary,
    createdAt: adminFieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    year,
    monthKey,
    limit,
    pendingFound: pending.length,
    summary,
    results,
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 30), 1), 100);
  const tickers = req.nextUrl.searchParams.get("tickers")?.split(",").map((item) => item.trim()) || [];
  const result = await runPendingUpdate(limit, tickers);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (!isAuthorized(req, body)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const limit = Math.min(Math.max(Number(body?.limit || 30), 1), 100);
  const tickers = Array.isArray(body?.tickers) ? body.tickers : [];
  const result = await runPendingUpdate(limit, tickers);
  return NextResponse.json(result);
}
