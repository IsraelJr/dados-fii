import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  isSupportedIngestionTicker,
  normalizeIngestionTicker,
  SUPPORTED_INGESTION_TICKERS,
} from "@/lib/fiiIngestionConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toIso(value: any) {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serialize(doc: any) {
  const data = doc.data() || {};
  return {
    ...data,
    id: doc.id,
    requestedAt: toIso(data.requestedAt),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    finishedAt: toIso(data.finishedAt),
    heartbeatAt: toIso(data.heartbeatAt),
  };
}

async function readActiveLock(tickerValue: unknown) {
  const ticker = normalizeIngestionTicker(tickerValue);
  if (!ticker || !isSupportedIngestionTicker(ticker)) return null;
  const snapshot = await adminDb.collection("FiiIngestionActiveRuns").doc(ticker).get();
  return snapshot.exists ? serialize(snapshot) : null;
}

async function readStatus(runId?: string, tickerValue?: string) {
  if (runId) {
    const snap = await adminDb.collection("FiiIngestionRuns").doc(runId).get();
    if (!snap.exists) return null;
    const run = serialize(snap);
    return isSupportedIngestionTicker(run.ticker) ? run : null;
  }

  const ticker = normalizeIngestionTicker(tickerValue);
  const snapshot = await adminDb
    .collection("FiiIngestionRuns")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  return snapshot.docs
    .map(serialize)
    .filter((run) => isSupportedIngestionTicker(run.ticker))
    .filter((run) => !ticker || run.ticker === ticker)
    .slice(0, 15);
}

function invalidTickerResponse(value: unknown) {
  const ticker = normalizeIngestionTicker(value);
  if (!ticker || isSupportedIngestionTicker(ticker)) return null;
  return NextResponse.json({
    ok: false,
    error: "Ticker não autorizado para consulta operacional.",
    supportedTickers: SUPPORTED_INGESTION_TICKERS,
  }, { status: 400 });
}

async function buildResponse(runId: string, tickerValue: string) {
  const data = await readStatus(runId || undefined, tickerValue || undefined);
  if (runId && !data) return NextResponse.json({ ok: false, error: "Execução não encontrada." }, { status: 404 });
  const lockTicker = runId ? String((data as any)?.ticker || "") : tickerValue;
  const activeLock = await readActiveLock(lockTicker);
  return NextResponse.json(
    { ok: true, run: runId ? data : undefined, runs: runId ? undefined : data, activeLock },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const runId = String(req.nextUrl.searchParams.get("runId") || "").trim();
    const ticker = String(req.nextUrl.searchParams.get("ticker") || "").trim();
    const invalid = invalidTickerResponse(ticker);
    if (invalid) return invalid;
    return buildResponse(runId, ticker);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Erro ao consultar execução." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isAdminAuthorized(req, body)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const runId = String(body?.runId || "").trim();
    const ticker = String(body?.ticker || "").trim();
    const invalid = invalidTickerResponse(ticker);
    if (invalid) return invalid;
    return buildResponse(runId, ticker);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Erro ao consultar execução." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}