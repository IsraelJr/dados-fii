import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  listBlockedIngestionFunds,
  listOperationalIngestionFunds,
} from "@/lib/fiiIngestionConfig";

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

function timestampMs(value: any) {
  if (!value) return 0;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  const time = date?.getTime?.();
  return Number.isFinite(time) ? time : 0;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return reply({ ok: false, error: "Não autorizado." }, 401);

  try {
    const operational = listOperationalIngestionFunds();
    const blocked = listBlockedIngestionFunds();
    const officialSnapshots = await adminDb.getAll(
      ...operational.map((fund) => adminDb.collection("Fiis").doc(fund.ticker))
    );

    const funds = await Promise.all(operational.map(async (fund, index) => {
      const official = (officialSnapshots[index]?.data() || {}) as Record<string, any>;
      const regulatoryData = official.regulatoryData || null;
      const runsQuery = await adminDb.collection("FiiIngestionRuns")
        .where("ticker", "==", fund.ticker)
        .limit(20)
        .get()
        .catch(() => null);
      const latestRun = runsQuery && !runsQuery.empty
        ? runsQuery.docs
            .map((document) => document.data() || {})
            .sort((left, right) => timestampMs(right.requestedAt) - timestampMs(left.requestedAt))[0] || null
        : null;

      return {
        ticker: fund.ticker,
        fundType: fund.fundType,
        adapterId: fund.adapterId,
        operational: fund.operational,
        published: Boolean(regulatoryData),
        regulatoryStatus: regulatoryData?.status || null,
        referenceYears: regulatoryData?.referenceYears || (regulatoryData?.referenceYear ? [regulatoryData.referenceYear] : []),
        monthlySnapshots: Number(regulatoryData?.quality?.monthlySnapshots || regulatoryData?.monthlyHistory?.length || 0),
        documents: Number(regulatoryData?.quality?.documents || regulatoryData?.documents?.length || 0),
        qaScore: Number(regulatoryData?.quality?.qaScore || 0) || null,
        conflictCount: Number(regulatoryData?.quality?.conflictCount || 0),
        latestReferenceDate: regulatoryData?.latestSnapshot?.referenceDate || null,
        latestRun: latestRun ? {
          runId: latestRun.runId || null,
          status: latestRun.status || null,
          currentStep: latestRun.currentStep || null,
          requestedAt: latestRun.requestedAt || null,
          error: latestRun.error || null,
          prePublicationStatus: latestRun.prePublicationStatus || null,
        } : null,
      };
    }));

    const summary = {
      operationalFunds: funds.length,
      publishedFunds: funds.filter((fund) => fund.published).length,
      pendingPublication: funds.filter((fund) => !fund.published).length,
      blockedRegulatoryFamilies: blocked.length,
      totalMonthlySnapshots: funds.reduce((total, fund) => total + fund.monthlySnapshots, 0),
      totalDocuments: funds.reduce((total, fund) => total + fund.documents, 0),
      fundsWithConflicts: funds.filter((fund) => fund.conflictCount > 0).length,
      failedLatestRuns: funds.filter((fund) => fund.latestRun?.status === "failed").length,
    };

    return reply({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary,
      funds,
      blockedFunds: blocked.map((fund) => ({
        ticker: fund.ticker,
        fundType: fund.fundType,
        reason: fund.blockReason || "Adaptador não disponível.",
      })),
    });
  } catch (error: any) {
    return reply({ ok: false, error: error?.message || "Erro ao carregar dashboard regulatório." }, 500);
  }
}
