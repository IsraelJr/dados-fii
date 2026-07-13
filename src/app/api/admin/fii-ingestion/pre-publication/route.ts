import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, readAdminSession } from "@/lib/adminSession";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import {
  buildRegulatoryDataProposal,
  diffRegulatoryData,
} from "@/lib/fiiPrePublication";
import { mergeRegulatoryHistory } from "@/lib/regulatoryHistoryMerge";
import {
  getIngestionFundConfig,
  isSupportedIngestionTicker,
  normalizeIngestionTicker,
} from "@/lib/fiiIngestionConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function reply(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function trueValue(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

async function handle(req: NextRequest, body?: Record<string, any>) {
  if (!isAdminAuthorized(req, body)) {
    return reply({ ok: false, error: "Não autorizado." }, 401);
  }

  try {
    const runId = String(body?.runId || req.nextUrl.searchParams.get("runId") || "").trim();
    if (!runId) return reply({ ok: false, error: "Informe o runId." }, 400);

    const runRef = adminDb.collection("FiiIngestionRuns").doc(runId);
    const stagingRef = adminDb.collection("FiiIngestionStaging").doc(runId);
    const [runSnapshot, stagingSnapshot, monthlySnapshot, documentsSnapshot] = await Promise.all([
      runRef.get(),
      stagingRef.get(),
      stagingRef.collection("MonthlySnapshots").limit(1000).get(),
      stagingRef.collection("Documents").limit(300).get(),
    ]);

    if (!runSnapshot.exists) {
      return reply({ ok: false, error: "Execução não encontrada." }, 404);
    }

    const run = (runSnapshot.data() || {}) as Record<string, any>;
    const staging = (stagingSnapshot.data() || {}) as Record<string, any>;
    const result = (run.result || {}) as Record<string, any>;
    const ticker = normalizeIngestionTicker(run.ticker || result.ticker);
    const fundConfig = getIngestionFundConfig(ticker);

    if (!isSupportedIngestionTicker(ticker) || !fundConfig?.adapterId) {
      return reply({ ok: false, error: "A execução não pertence a um fundo operacional." }, 400);
    }

    const qa = (run.manualQa || staging.manualQa || {}) as Record<string, any>;
    const qaApproved = qa.verdict === "approved_for_human_review"
      && Number(qa.score) === 100
      && qa.canProceedToHumanReview === true
      && Number(qa.summary?.fail || 0) === 0;

    if (!qaApproved) {
      return reply({
        ok: false,
        error: "A execução ainda não possui QA 100 aprovado para revisão humana.",
        qa: {
          verdict: qa.verdict || null,
          score: Number.isFinite(Number(qa.score)) ? Number(qa.score) : null,
          canProceedToHumanReview: qa.canProceedToHumanReview === true,
        },
        canPublishToOfficialBase: false,
      }, 409);
    }

    const cnpj = String(run.cnpj || result.cnpj || staging.cnpj || fundConfig.cnpj || "")
      .replace(/\D/g, "");
    if (cnpj.length !== 14) {
      return reply({ ok: false, error: "CNPJ inválido na execução." }, 400);
    }

    const officialRef = adminDb.collection("Fiis").doc(ticker);
    const officialSnapshot = await officialRef.get();
    const officialData = (officialSnapshot.data() || {}) as Record<string, any>;
    const existingRegulatoryData = officialData.regulatoryData || null;
    const monthly = monthlySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    const documents = documentsSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    const generatedAt = new Date().toISOString();
    const incomingProposal = buildRegulatoryDataProposal({
      ticker,
      cnpj,
      fundType: fundConfig.fundType,
      adapterId: fundConfig.adapterId,
      parserVersion: Number(run.parserVersion || result.parserVersion || 2),
      runId,
      year: Number(run.year || result.year || new Date().getFullYear()),
      monthly,
      documents,
      generatedAt,
    });
    const mergedHistory = mergeRegulatoryHistory({
      existingMonthly: Array.isArray(existingRegulatoryData?.monthlyHistory)
        ? existingRegulatoryData.monthlyHistory
        : [],
      incomingMonthly: incomingProposal.monthlyHistory,
      existingDocuments: Array.isArray(existingRegulatoryData?.documents)
        ? existingRegulatoryData.documents
        : [],
      incomingDocuments: incomingProposal.documents,
    });
    const proposal = {
      ...incomingProposal,
      referenceYears: mergedHistory.years,
      latestSnapshot: mergedHistory.latestSnapshot,
      monthlyHistory: mergedHistory.monthlyHistory,
      documents: mergedHistory.documents,
      quality: {
        ...incomingProposal.quality,
        monthlySnapshots: mergedHistory.monthlyHistory.length,
        documents: mergedHistory.documents.length,
      },
      historyMerge: {
        mode: "incremental_idempotent",
        ...mergedHistory.stats,
      },
    };
    const differences = diffRegulatoryData(existingRegulatoryData, proposal);
    const legacyFields = Object.keys(officialData)
      .filter((key) => key !== "regulatoryData")
      .sort();
    const reviewPackage = {
      generatedAt,
      runId,
      ticker,
      cnpj,
      fundType: fundConfig.fundType,
      adapterId: fundConfig.adapterId,
      status: "awaiting_human_review",
      targetDocument: `Fiis/${ticker}`,
      targetNamespace: "regulatoryData",
      officialDocumentExists: officialSnapshot.exists,
      existingRegulatoryData,
      proposedRegulatoryData: proposal,
      differences,
      protectedLegacyFields: legacyFields,
      historyMerge: {
        years: mergedHistory.years,
        ...mergedHistory.stats,
      },
      safeguards: {
        qaScore: Number(qa.score),
        qaVerdict: qa.verdict,
        monthlyCoverage: qa.coverage || null,
        conflictCount: Number(qa.validation?.conflictCount ?? qa.checks?.find?.((item: any) => item.id === "monthly-conflicts")?.evidence?.conflictCount ?? 0),
        officialWritePerformed: false,
        officialWriteEndpointAvailable: false,
        legacyFieldsWillBeOverwritten: false,
        priorRegulatoryHistoryWillBePreserved: true,
        backupRequiredBeforePublication: true,
        rollbackRequiredBeforePublication: true,
        explicitAuthorizationRequired: true,
      },
      canProceedToHumanReview: true,
      canPublishToOfficialBase: false,
      publicationDecision: "blocked_prepublication_review_only",
    };

    const persist = trueValue(body?.persist ?? req.nextUrl.searchParams.get("persist"));
    if (persist) {
      const session = readAdminSession(req);
      await adminDb.collection("FiiIngestionPrePublication").doc(runId).set({
        ...reviewPackage,
        requestedBy: session?.user || run.requestedBy || "admin",
        persistedAt: adminFieldValue.serverTimestamp(),
        officialWritePerformed: false,
      }, { merge: false });
      await Promise.all([
        runRef.set({
          prePublicationStatus: "awaiting_human_review",
          prePublicationUpdatedAt: adminFieldValue.serverTimestamp(),
          publishToOfficialBase: false,
        }, { merge: true }),
        stagingRef.set({
          prePublicationStatus: "awaiting_human_review",
          prePublicationUpdatedAt: adminFieldValue.serverTimestamp(),
          publishToOfficialBase: false,
        }, { merge: true }),
      ]);
    }

    return reply({ ok: true, persisted: persist, reviewPackage });
  } catch (error: any) {
    return reply({
      ok: false,
      error: error?.message || "Erro ao gerar pré-publicação.",
      canPublishToOfficialBase: false,
    }, 500);
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, any>));
  return handle(req, body);
}
