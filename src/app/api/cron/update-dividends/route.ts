import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_DOC = "dividendRoutineState";
const DEFAULT_INTERVAL_DAYS = 5;

function envInt(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysSince(value: any) {
  const date = toDate(value);
  if (!date) return Number.POSITIVE_INFINITY;
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

function isAuthorized(req: NextRequest) {
  const expected = process.env.CRON_SECRET || process.env.ADMIN_UPDATE_SECRET;
  const auth = req.headers.get("authorization") || "";
  const querySecret = new URL(req.url).searchParams.get("secret") || "";
  return Boolean(expected && (auth === `Bearer ${expected}` || querySecret === expected));
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const url = new URL(req.url);
    const intervalDays = envInt("DIVIDEND_UPDATE_INTERVAL_DAYS", DEFAULT_INTERVAL_DAYS);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 10), 1), 50);
    const year = Number(url.searchParams.get("year") || new Date().getFullYear());
    const stateRef = adminDb.collection("Parameters").doc(STATE_DOC);
    const stateSnap = await stateRef.get();
    const state = stateSnap.data() || {};
    const cursor = typeof state.cursor === "string" && state.cursor ? state.cursor : "";
    const intervalReference = state.lastCycleStartedAt || state.completedCycleAt || state.lastRunAt;
    const intervalElapsed = daysSince(intervalReference);

    if (!cursor && intervalElapsed < intervalDays) {
      await stateRef.set({
        skippedAt: adminFieldValue.serverTimestamp(),
        skipReason: `Intervalo de ${intervalDays} dias ainda não atingido.`,
        intervalDays,
        daysSinceLastCycle: Number(intervalElapsed.toFixed(2)),
      }, { merge: true });

      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: `Intervalo de ${intervalDays} dias ainda não atingido.`,
        intervalDays,
        daysSinceLastCycle: Number(intervalElapsed.toFixed(2)),
      });
    }

    const batchUrl = new URL("/api/admin/update-dividends-batch", req.url);
    const response = await fetch(batchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": process.env.ADMIN_UPDATE_SECRET || process.env.CRON_SECRET || "",
      },
      body: JSON.stringify({
        secret: process.env.ADMIN_UPDATE_SECRET || process.env.CRON_SECRET || "",
        year,
        limit,
        cursor: cursor || undefined,
      }),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });

    const hasMore = Boolean(data.hasMore);
    const nextCursor = hasMore ? data.nextCursor : null;

    await stateRef.set({
      year,
      intervalDays,
      cursor: nextCursor,
      lastCursor: data.nextCursor || null,
      lastCycleStartedAt: cursor ? state.lastCycleStartedAt || adminFieldValue.serverTimestamp() : adminFieldValue.serverTimestamp(),
      completedCycleAt: hasMore ? state.completedCycleAt || null : adminFieldValue.serverTimestamp(),
      lastRunAt: adminFieldValue.serverTimestamp(),
      lastProcessed: data.processed || 0,
      updated: data.updated || 0,
      failed: data.failed || 0,
      lastResults: data.results || [],
    }, { merge: true });

    return NextResponse.json({
      ok: true,
      skipped: false,
      intervalDays,
      previousCursor: cursor || null,
      nextCursor,
      batch: data,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro na rotina de dividendos." }, { status: 500 });
  }
}
