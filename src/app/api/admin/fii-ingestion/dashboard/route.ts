import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { adminDb } from "@/lib/firebaseAdmin";
import { buildAdapterHealth } from "@/lib/fiiAdapterHealth";
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

function iso(value: any) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return reply({ ok: false, error: "Não autorizado." }, 401);

  try {
    const operational = listOperationalIngestionFunds();
    const blocked = listBlockedIngestionFunds();
    const officialSnapshots = await adminDb.getAll(
      ...operational.map((fund) => adminDb.collection("Fiis").doc(fund.ticker))
    );

    const allRuns: Record<string, any>[] = [];
    const funds = await Promise.all(operational.map(async (fund, index) => {
      const official = (officialSnapshots[index]?.data() || {}) as Record<string, any>;
      const regulatoryData = official.regulatoryData || null;
      const runsQuery = await adminDb.collection("FiiIngestionRuns")
        .where("ticker", "==", fund.ticker)
        .limit(30)
        .get()
        .catch(() => null);
      const runs = runsQuery
        ? runsQuery.docs.map((document) => ({ id: document.id, ...(document.data() || {}) }))
        : [];
      allRuns.push(...runs);
      const latestRun = [...runs].sort((left, right) => timestampMs(right.requestedAt) - timestampMs(left.requestedAt))[0] || null;
      const latestRunId = String(latestRun?.runId || latestRun?.id || regulatoryData?.publication?.runId || "").trim();

      let publication: Record<string, any> | null = null;
      let postValidation: Record<string, any> | null = null;
      if (latestRunId) {
        const [publicationSnapshot, validationSnapshot] = await adminDb.getAll(
          adminDb.collection("FiiIngestionPublications").doc(latestRunId),
          adminDb.collection("FiiIngestionPostPublicationValidations").doc(latestRunId)
        );
        publication = publicationSnapshot.exists ? publicationSnapshot.data() || {} : null;
        postValidation = validationSnapshot.exists ? validationSnapshot.data() || {} : null;
      }

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
        publication: publication ? {
          status: publication.status || null,
          publishedAt: iso(publication.publishedAt),
          rollbackAvailable: publication.rollbackAvailable === true,
          rollbackPerformed: publication.rollbackPerformed === true,
        } : null,
        postPublicationValidation: postValidation ? {
          verdict: postValidation.verdict || null,
          score: Number(postValidation.score || 0) || null,
          generatedAt: iso(postValidation.generatedAt),
          failCount: Number(postValidation.summary?.fail || 0),
        } : null,
        latestRun: latestRun ? {
          runId: latestRunId || null,
          status: latestRun.status || null,
          currentStep: latestRun.currentStep || null,
          requestedAt: iso(latestRun.requestedAt),
          finishedAt: iso(latestRun.finishedAt),
          error: latestRun.error || null,
          prePublicationStatus: latestRun.prePublicationStatus || null,
        } : null,
      };
    }));

    const adapterHealth = buildAdapterHealth(allRuns.map((run) => ({
      adapterId: run.adapterId || null,
      fundType: run.fundType || null,
      ticker: run.ticker || null,
      status: run.status || null,
      requestedAt: iso(run.requestedAt),
      finishedAt: iso(run.finishedAt),
      parserVersion: Number(run.parserVersion || 0) || null,
      manualQa: run.manualQa || null,
      error: run.error || null,
    })));

    const summary = {
      operationalFunds: funds.length,
      publishedFunds: funds.filter((fund) => fund.published).length,
      pendingPublication: funds.filter((fund) => !fund.published).length,
      blockedRegulatoryFamilies: blocked.length,
      totalMonthlySnapshots: funds.reduce((total, fund) => total + fund.monthlySnapshots, 0),
      totalDocuments: funds.reduce((total, fund) => total + fund.documents, 0),
      fundsWithConflicts: funds.filter((fund) => fund.conflictCount > 0).length,
      failedLatestRuns: funds.filter((fund) => fund.latestRun?.status === "failed").length,
      postPublicationValidated: funds.filter((fund) => fund.postPublicationValidation?.verdict === "passed").length,
      adaptersDegraded: adapterHealth.filter((adapter) => adapter.status === "degraded").length,
    };

    return reply({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary,
      adapterHealth,
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
