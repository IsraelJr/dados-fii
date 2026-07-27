// Controlador de aplicação; o Route Handler permanece sem acesso à persistência.
import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { DIVIDEND_MONTHS, mergeDividendYear, needsStatusInvestEnrichment, parseStatusInvestDividends, parseStatusInvestMarketIndicators } from "@/lib/market/StatusInvestParser";
import { internalAuthError, requireAdminOrCron } from "@/lib/security/InternalRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS: string[] = [...DIVIDEND_MONTHS];
const TIME_ZONE = "America/Sao_Paulo";
const STATE_DOC = "PendingDividendUpdateState";

type UpdateResult = {
  ticker: string;
  status: "updated" | "still_missing" | "error" | "skipped";
  fetchedMonths?: string[];
  error?: string;
};

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

function rotateDocs(docs: any[], limit: number, cursor?: string) {
  if (!docs.length) return [];
  const ordered = [...docs].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const startIndex = cursor ? ordered.findIndex((doc) => String(doc.id) > cursor) : 0;
  const safeStart = startIndex >= 0 ? startIndex : 0;
  const selected = ordered.slice(safeStart, safeStart + limit);

  if (selected.length >= limit || safeStart === 0) return selected;

  return selected.concat(ordered.slice(0, limit - selected.length));
}

async function updateDocDividends(doc: any, ticker: string): Promise<UpdateResult> {
  try {
    const year = currentYear();
    const monthKey = currentMonthKey();
    const previous = doc.data() || {};
    const field = `earnings${year}`;
    const previousYear = previous[field] || {};

    if (!needsStatusInvestEnrichment(previous, year, monthKey)) {
      return { ticker, status: "skipped", fetchedMonths: Object.keys(previousYear) };
    }

    const page = await getStatusInvestPage(ticker);
    const fetched = parseStatusInvestDividends(page.text, year);
    const fetchedMonths = Object.keys(fetched).sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));

    if (!fetchedMonths.length) {
      return { ticker, status: "still_missing", fetchedMonths: [] };
    }

    const merged = mergeDividendYear(previousYear, fetched);
    const marketIndicators = parseStatusInvestMarketIndicators(page.text, page.url, new Date().toISOString());

    await adminDb.collection("Fiis_Backup").doc(`${ticker}_${Date.now()}`).set({
      ...previous,
      backup_date: adminFieldValue.serverTimestamp(),
      backup_reason: "admin-pending-month-dividend-update",
    }, { merge: false });

    await doc.ref.set({
      [field]: merged,
      ...marketIndicators,
      modified_in: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      ticker,
      status: merged?.[monthKey] ? "updated" : "still_missing",
      fetchedMonths,
    };
  } catch (err: any) {
    return { ticker, status: "error", error: "Erro desconhecido" };
  }
}

async function runPendingUpdate(limit: number, tickersFilter?: string[], cursorOverride?: string) {
  const year = currentYear();
  const monthKey = currentMonthKey();
  const normalizedFilter = Array.isArray(tickersFilter)
    ? tickersFilter.map(tickerOf).filter(Boolean)
    : [];
  const useCursor = normalizedFilter.length === 0;
  const stateRef = adminDb.collection("Parameters").doc(STATE_DOC);
  const stateSnap = useCursor ? await stateRef.get() : null;
  const state = stateSnap?.data() || {};
  const cursor = useCursor ? String(cursorOverride || state.cursor || "") : "";

  const snapshot = await adminDb.collection("Fiis").limit(5000).get();
  const pendingAll = snapshot.docs.filter((doc) => {
    const data = doc.data() || {};
    const ticker = tickerOf(data.code || doc.id);
    if (!ticker) return false;
    if (normalizedFilter.length && !normalizedFilter.includes(ticker)) return false;
    return needsStatusInvestEnrichment(data, year, monthKey);
  });

  const pending = useCursor ? rotateDocs(pendingAll, limit, cursor) : pendingAll.slice(0, limit);
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
  const nextCursor = useCursor && pending.length ? String(pending[pending.length - 1].id) : null;

  await adminDb.collection("Parameters").doc("PendingDividendUpdateRuns").collection("runs").add({
    year,
    monthKey,
    limit,
    cursor: cursor || null,
    nextCursor,
    requestedTickers: normalizedFilter,
    pendingTotal: pendingAll.length,
    pendingProcessed: pending.length,
    summary,
    createdAt: adminFieldValue.serverTimestamp(),
  });

  if (useCursor) {
    await stateRef.set({
      year,
      monthKey,
      cursor: nextCursor,
      previousCursor: cursor || null,
      pendingTotal: pendingAll.length,
      lastProcessed: pending.length,
      summary,
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return {
    ok: true,
    year,
    monthKey,
    limit,
    cursor: cursor || null,
    nextCursor,
    pendingTotal: pendingAll.length,
    pendingProcessed: pending.length,
    summary,
    results,
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const authorization = await requireAdminOrCron(req, { scope: "update-pending-dividends" });
  if (!authorization.ok) return internalAuthError(authorization);

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 30), 1), 100);
  const tickers = req.nextUrl.searchParams.get("tickers")?.split(",").map((item) => item.trim()) || [];
  const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
  const result = await runPendingUpdate(limit, tickers, cursor);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const authorization = await requireAdminOrCron(req, { scope: "update-pending-dividends" });
  if (!authorization.ok) return internalAuthError(authorization);
  const body = await req.json().catch(() => ({}));

  const limit = Math.min(Math.max(Number(body?.limit || 30), 1), 100);
  const tickers = Array.isArray(body?.tickers) ? body.tickers : [];
  const cursor = body?.cursor ? String(body.cursor) : undefined;
  const result = await runPendingUpdate(limit, tickers, cursor);
  return NextResponse.json(result);
}
