import { NextRequest, NextResponse } from "next/server";
import { getMarketBenchmarks } from "@/lib/marketBenchmarks";

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

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }

    const benchmarkData = await getMarketBenchmarks({ forceRefresh: true });
    return NextResponse.json({ ok: true, benchmarkData });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao atualizar benchmarks." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    if (!isAuthorized(req, body)) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }

    const benchmarkData = await getMarketBenchmarks({ forceRefresh: true });
    return NextResponse.json({ ok: true, benchmarkData });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao atualizar benchmarks." }, { status: 500 });
  }
}
