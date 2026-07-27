import { NextRequest, NextResponse } from "next/server";
import { getMarketBenchmarks } from "@/lib/marketBenchmarks";
import { internalAuthError, requireAdminOrCron } from "@/lib/security/InternalRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authorization = await requireAdminOrCron(req, { scope: "update-market-benchmarks" });
    if (!authorization.ok) return internalAuthError(authorization);

    const benchmarkData = await getMarketBenchmarks({ forceRefresh: true });
    return NextResponse.json({ ok: true, benchmarkData });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao atualizar benchmarks." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await requireAdminOrCron(req, { scope: "update-market-benchmarks" });
    if (!authorization.ok) return internalAuthError(authorization);

    const benchmarkData = await getMarketBenchmarks({ forceRefresh: true });
    return NextResponse.json({ ok: true, benchmarkData });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao atualizar benchmarks." }, { status: 500 });
  }
}
