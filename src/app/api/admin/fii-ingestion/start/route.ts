import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { isAdminAuthorized, readAdminSession } from "@/lib/adminSession";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { normalizeCnpj } from "@/lib/cvmIngestion";
import { tgar11IngestionWorkflow } from "@/workflows/tgar11Ingestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isAdminAuthorized(req, body)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const ticker = String(body?.ticker || "TGAR11").trim().toUpperCase();
  if (ticker !== "TGAR11") {
    return NextResponse.json({ ok: false, error: "O piloto está restrito ao TGAR11." }, { status: 400 });
  }

  const delayMinutes = Math.min(Math.max(Number(body?.delayMinutes || 0), 0), 1440);
  const currentYear = new Date().getFullYear();
  const year = Math.min(Math.max(Number(body?.year || currentYear), 2016), currentYear);
  const cnpj = normalizeCnpj(body?.cnpj) || undefined;
  const runId = randomUUID();
  const runRef = adminDb.collection("FiiIngestionRuns").doc(runId);
  const session = readAdminSession(req);

  try {
    await runRef.set({
      runId,
      ticker,
      cnpj: cnpj || null,
      year,
      delayMinutes,
      mode: "staging",
      publishToOfficialBase: false,
      requestedBy: session?.user || "legacy-admin-secret",
      status: delayMinutes > 0 ? "scheduled" : "queued",
      currentStep: delayMinutes > 0 ? "waiting" : "queued",
      requestedAt: adminFieldValue.serverTimestamp(),
      createdAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    });

    const workflowRun = await start(tgar11IngestionWorkflow, [{ runId, ticker, cnpj, year, delayMinutes }]);
    await runRef.set({ workflowRunId: workflowRun.runId, updatedAt: adminFieldValue.serverTimestamp() }, { merge: true });

    return NextResponse.json({
      ok: true,
      runId,
      workflowRunId: workflowRun.runId,
      ticker,
      year,
      delayMinutes,
      status: delayMinutes > 0 ? "scheduled" : "queued",
      publishToOfficialBase: false,
    });
  } catch (error: any) {
    await runRef.set({
      status: "failed",
      currentStep: "start_failed",
      error: error?.message || "Falha ao iniciar workflow.",
      finishedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => undefined);

    return NextResponse.json({ ok: false, runId, error: error?.message || "Falha ao iniciar workflow." }, { status: 500 });
  }
}
