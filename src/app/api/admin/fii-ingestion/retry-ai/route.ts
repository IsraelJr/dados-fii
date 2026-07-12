import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { extractPilotInsightsV2 } from "@/lib/cvmPilotAi";
import { validatePilotRunV2 } from "@/lib/cvmMonthlyIngestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

async function findRun(runId?: string) {
  if (runId) {
    const snapshot = await adminDb.collection("FiiIngestionRuns").doc(runId).get();
    return snapshot.exists ? snapshot : null;
  }

  const query = await adminDb
    .collection("FiiIngestionRuns")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  return query.docs.find((doc) => {
    const data = doc.data() || {};
    return data.ticker === "TGAR11"
      && data.status === "completed"
      && Number(data.parserVersion || data.result?.parserVersion || 0) >= 2;
  }) || null;
}

async function retryAi(req: NextRequest, body?: Record<string, any>) {
  if (!isAdminAuthorized(req, body)) {
    return response({ ok: false, error: "Não autorizado." }, 401);
  }

  try {
    const requestedRunId = String(
      body?.runId || req.nextUrl.searchParams.get("runId") || ""
    ).trim();
    const runSnapshot = await findRun(requestedRunId || undefined);
    if (!runSnapshot) {
      return response({
        ok: false,
        error: "Nenhuma execução TGAR11 concluída com parser v2 foi encontrada.",
      }, 404);
    }

    const runId = runSnapshot.id;
    const run = (runSnapshot.data() || {}) as Record<string, any>;
    const result = (run.result || {}) as Record<string, any>;
    const documentsQuery = await adminDb
      .collection("FiiIngestionStaging")
      .doc(runId)
      .collection("Documents")
      .orderBy("deliveryDate", "desc")
      .limit(40)
      .get();
    const documents = documentsQuery.docs.map((doc) => ({
      id: doc.id,
      ...((doc.data() || {}) as Record<string, any>),
    }));

    await runSnapshot.ref.set({
      currentStep: "ai_retry",
      aiRetryStartedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    const ai = await extractPilotInsightsV2({
      runId,
      ticker: "TGAR11",
      documents,
    });
    const validation = await validatePilotRunV2({
      runId,
      ticker: "TGAR11",
      cnpj: String(run.cnpj || result.cnpj || ""),
      monthly: result.monthly || run.monthly || {},
      documents: result.documents || run.documents || {
        documentsSaved: documents.length,
      },
      ai,
    });

    const nextResult = {
      ...result,
      parserVersion: 2,
      ai,
      validation,
    };
    await runSnapshot.ref.set({
      currentStep: "completed",
      result: nextResult,
      ai,
      validation,
      aiRetryFinishedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    return response({
      ok: true,
      runId,
      ticker: "TGAR11",
      parserVersion: 2,
      ai: {
        status: ai.status,
        quality: ai.quality,
        reason: ai.reason,
        documentsSubmitted: ai.documentsSubmitted,
        sourceUrlsUsed: ai.sourceUrlsUsed,
        sourceCoverage: ai.sourceCoverage,
        externalSourceUrls: ai.externalSourceUrls,
      },
      validation: {
        readyForReview: validation.readyForReview,
        blockingIssues: validation.blockingIssues,
        warnings: validation.warnings,
        aiSourceCoverage: validation.aiSourceCoverage,
      },
      publishToOfficialBase: false,
      next: `/api/admin/fii-ingestion/qa?runId=${encodeURIComponent(runId)}&persist=1`,
    });
  } catch (error: any) {
    return response({
      ok: false,
      error: error?.message || "Erro ao repetir a extração por IA.",
    }, 500);
  }
}

export async function GET(req: NextRequest) {
  return retryAi(req);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, any>));
  return retryAi(req, body);
}
