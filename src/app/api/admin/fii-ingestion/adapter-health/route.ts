import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { adminDb } from "@/lib/firebaseAdmin";
import { buildAdapterHealth } from "@/lib/fiiAdapterHealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return reply({ ok: false, error: "Não autorizado." }, 401);

  try {
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 100), 1), 300);
    const snapshot = await adminDb.collection("FiiIngestionRuns")
      .orderBy("requestedAt", "desc")
      .limit(limit)
      .get();
    const runs = snapshot.docs.map((doc) => {
      const data = (doc.data() || {}) as Record<string, any>;
      return {
        adapterId: data.adapterId || data.result?.adapterId || null,
        fundType: data.fundType || data.result?.fundType || null,
        ticker: data.ticker || data.result?.ticker || null,
        status: data.status || null,
        requestedAt: data.requestedAt || data.createdAt || null,
        finishedAt: data.finishedAt || null,
        parserVersion: data.parserVersion || data.result?.parserVersion || null,
        manualQa: data.manualQa || null,
        error: data.error || null,
      };
    });

    const adapters = buildAdapterHealth(runs);
    return reply({
      ok: true,
      generatedAt: new Date().toISOString(),
      runsAnalyzed: runs.length,
      adapters,
      summary: {
        totalAdapters: adapters.length,
        healthy: adapters.filter((item) => item.status === "healthy").length,
        attention: adapters.filter((item) => item.status === "attention").length,
        degraded: adapters.filter((item) => item.status === "degraded").length,
      },
    });
  } catch (error: any) {
    return reply({ ok: false, error: error?.message || "Erro ao calcular health check dos adaptadores." }, 500);
  }
}
