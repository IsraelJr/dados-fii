import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowedSecrets() {
  return [process.env.ADMIN_UPDATE_SECRET, process.env.CRON_SECRET].filter(Boolean);
}

function isAuthorized(req: NextRequest, body?: any) {
  const secrets = allowedSecrets();
  if (!secrets.length) return false;

  const authHeader = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-admin-secret") || authHeader.replace(/^Bearer\s+/i, "");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const bodySecret = body?.secret;

  return [headerSecret, querySecret, bodySecret].some((value) => Boolean(value && secrets.includes(value)));
}

function safeTimestamp(value: any) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function checkCollection(name: string) {
  try {
    const snapshot = await adminDb.collection(name).limit(1).get();
    return {
      ok: true,
      hasSample: !snapshot.empty,
      sampleId: snapshot.docs[0]?.id || null,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || `Erro ao consultar ${name}`,
    };
  }
}

async function getLatestBenchmark() {
  try {
    const snap = await adminDb.collection("MarketBenchmarks").doc("latest").get();
    const data = snap.data() || {};

    return {
      ok: snap.exists,
      updatedAt: safeTimestamp(data.updatedAt),
      date: data.date || null,
      ifix: {
        currentReady: Boolean(data?.ifix?.currentReady),
        comparisonReady: Boolean(data?.ifix?.comparisonReady),
        partialComparisonReady: Boolean(data?.ifix?.partialComparisonReady),
        close: data?.ifix?.close ?? null,
        lastDate: data?.ifix?.lastDate || null,
        provider: data?.ifix?.provider || null,
      },
      cdi: {
        comparisonReady: Boolean(data?.cdi?.comparisonReady),
        lastDate: data?.cdi?.lastDate || null,
      },
      ipca: {
        comparisonReady: Boolean(data?.ipca?.comparisonReady),
        lastDate: data?.ipca?.lastDate || null,
      },
      selic: {
        comparisonReady: Boolean(data?.selic?.comparisonReady),
        rate: data?.selic?.rate ?? null,
        date: data?.selic?.date || null,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || "Erro ao consultar MarketBenchmarks/latest",
    };
  }
}

async function buildDiagnostics() {
  const [fiis, userReports, walletSessions, benchmarks] = await Promise.all([
    checkCollection("Fiis"),
    checkCollection("UserRiskReports"),
    checkCollection("WalletSessions"),
    getLatestBenchmark(),
  ]);

  return {
    ok: Boolean(fiis.ok && benchmarks.ok),
    generatedAt: new Date().toISOString(),
    collections: {
      fiis,
      userReports,
      walletSessions,
    },
    benchmarks,
    notes: [
      "Este diagnóstico não expõe dados pessoais nem lista carteiras de usuários.",
      "Use para verificar se as bases essenciais existem e se os benchmarks têm atualização recente.",
      "Para atualização forçada de CDI, IPCA, Selic e IFIX, use diagnose-market-benchmarks.",
    ],
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    return NextResponse.json(await buildDiagnostics(), { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao diagnosticar fontes de dados." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  try {
    if (!isAuthorized(req, body)) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    return NextResponse.json(await buildDiagnostics(), { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao diagnosticar fontes de dados." }, { status: 500 });
  }
}
