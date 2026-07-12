import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  isSupportedIngestionTicker,
  normalizeIngestionTicker,
} from "@/lib/fiiIngestionConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function safeValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > 180 ? `${text.slice(0, 180)}…` : text;
}

function diagnosticFragment(fragment: Record<string, any>) {
  const raw = fragment?.raw && typeof fragment.raw === "object" ? fragment.raw : {};
  const entries = Object.entries(raw);
  const nonEmpty = Object.fromEntries(
    entries
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
      .slice(0, 120)
      .map(([key, value]) => [key, safeValue(value)])
  );

  return {
    sourceKind: fragment?.sourceKind || null,
    sourceFile: fragment?.sourceFile || null,
    sourceRowIndex: fragment?.sourceRowIndex ?? null,
    headers: entries.map(([key]) => key),
    nonEmpty,
  };
}

async function findRun(runId?: string, tickerValue?: string) {
  if (runId) {
    const snapshot = await adminDb.collection("FiiIngestionRuns").doc(runId).get();
    return snapshot.exists ? snapshot : null;
  }

  const ticker = normalizeIngestionTicker(tickerValue || "VGIA11");
  if (!isSupportedIngestionTicker(ticker)) return null;

  const snapshot = await adminDb
    .collection("FiiIngestionRuns")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  return snapshot.docs.find((doc) => {
    const data = doc.data() || {};
    return data.ticker === ticker && data.status === "completed";
  }) || null;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return reply({ ok: false, error: "Não autorizado." }, 401);
  }

  try {
    const runId = String(req.nextUrl.searchParams.get("runId") || "").trim();
    const tickerValue = String(req.nextUrl.searchParams.get("ticker") || "VGIA11").trim();
    const runSnapshot = await findRun(runId || undefined, tickerValue);
    if (!runSnapshot) {
      return reply({ ok: false, error: "Execução não encontrada." }, 404);
    }

    const run = (runSnapshot.data() || {}) as Record<string, any>;
    const ticker = normalizeIngestionTicker(run.ticker);
    if (!isSupportedIngestionTicker(ticker)) {
      return reply({ ok: false, error: "Ticker não autorizado." }, 400);
    }

    const monthlySnapshot = await adminDb
      .collection("FiiIngestionStaging")
      .doc(runSnapshot.id)
      .collection("MonthlySnapshots")
      .orderBy("referenceDate", "desc")
      .limit(2)
      .get();

    const monthly = monthlySnapshot.docs.map((doc) => {
      const data = (doc.data() || {}) as Record<string, any>;
      const fragments = Array.isArray(data.rawFragments) ? data.rawFragments : [];
      return {
        id: doc.id,
        referenceDate: data.referenceDate || null,
        cnpj: data.cnpj || null,
        parsed: {
          fundName: data.fundName ?? null,
          netWorth: data.netWorth ?? null,
          sharesOutstanding: data.sharesOutstanding ?? null,
          numberShareholders: data.numberShareholders ?? null,
          vpCota: data.vpCota ?? null,
        },
        sourceFiles: Array.isArray(data.source?.files) ? data.source.files : [],
        fragments: fragments.map(diagnosticFragment),
      };
    });

    return reply({
      ok: true,
      runId: runSnapshot.id,
      ticker,
      parserVersion: run.parserVersion || run.result?.parserVersion || null,
      monthly,
      publishToOfficialBase: false,
    });
  } catch (error: any) {
    return reply({
      ok: false,
      error: error?.message || "Erro ao gerar diagnóstico de esquema.",
    }, 500);
  }
}
