import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { reconcileFiagroMonthlyFields } from "@/lib/cvmFiagroPostProcessing";
import { validateOperationalRun } from "@/lib/cvmOperationalValidation";

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

async function handle(req: NextRequest, body?: Record<string, any>) {
  if (!isAdminAuthorized(req, body)) {
    return reply({ ok: false, error: "Não autorizado." }, 401);
  }

  try {
    const runId = String(
      body?.runId || req.nextUrl.searchParams.get("runId") || ""
    ).trim();
    if (!runId) {
      return reply({ ok: false, error: "Informe o runId." }, 400);
    }

    const runRef = adminDb.collection("FiiIngestionRuns").doc(runId);
    const runSnapshot = await runRef.get();
    if (!runSnapshot.exists) {
      return reply({ ok: false, error: "Execução não encontrada." }, 404);
    }

    const run = (runSnapshot.data() || {}) as Record<string, any>;
    const result = (run.result || {}) as Record<string, any>;
    const ticker = String(run.ticker || result.ticker || "").toUpperCase();
    if (ticker !== "VGIA11") {
      return reply({
        ok: false,
        error: "O reprocessamento FIAGRO está restrito ao VGIA11 neste piloto.",
      }, 400);
    }

    const cnpj = String(run.cnpj || result.cnpj || "").replace(/\D/g, "");
    if (cnpj.length !== 14) {
      return reply({ ok: false, error: "CNPJ inválido na execução." }, 400);
    }

    await runRef.set({
      currentStep: "fiagro_reparse",
      fiagroReparseStatus: "running",
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    const reconciliation = await reconcileFiagroMonthlyFields({ runId, ticker });
    const monthly = {
      ...(result.monthly || run.monthly || {}),
      reconciliation,
    };
    const documents = result.documents || run.documents || { documentsSaved: 0 };
    const ai = result.ai || run.ai || {
      enabled: false,
      status: "disabled",
      quality: "not_requested",
      reason: "disabled_by_configuration",
      documentsSubmitted: 0,
      sourceUrlsUsed: 0,
      sourceCoverage: 0,
      externalSourceUrls: [],
    };
    const validation = await validateOperationalRun({
      runId,
      ticker,
      cnpj,
      monthly,
      documents,
      ai,
    });

    const nextResult = {
      ...result,
      ticker,
      cnpj,
      parserVersion: 2,
      monthly,
      documents,
      ai,
      validation,
    };

    await runRef.set({
      status: "completed",
      currentStep: "completed",
      result: nextResult,
      validation,
      fiagroReparseStatus: "completed",
      fiagroReparseResult: reconciliation,
      fiagroReparsedAt: adminFieldValue.serverTimestamp(),
      publishToOfficialBase: false,
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    return reply({
      ok: true,
      runId,
      ticker,
      reconciliation,
      validation: {
        readyForReview: validation.readyForReview,
        coverage: validation.coverage,
        minimumCoverage: validation.minimumCoverage,
        conflictCount: validation.conflictCount,
        blockingIssues: validation.blockingIssues,
        warnings: validation.warnings,
      },
      monthlyDataReused: true,
      documentsPreserved: true,
      publishToOfficialBase: false,
      next: `/api/admin/fii-ingestion/operational-qa?runId=${encodeURIComponent(runId)}&persist=1`,
    });
  } catch (error: any) {
    return reply({
      ok: false,
      error: error?.message || "Falha ao reprocessar o staging FIAGRO.",
      publishToOfficialBase: false,
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
