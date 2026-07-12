import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { isAdminAuthorized, readAdminSession } from "@/lib/adminSession";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { normalizeCnpj } from "@/lib/cvmIngestion";
import {
  assertSupportedIngestionTicker,
  SUPPORTED_INGESTION_TICKERS,
} from "@/lib/fiiIngestionConfig";
import { fiiIngestionWorkflow } from "@/workflows/tgar11Ingestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trueValue(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

async function findActiveRun(ticker: string) {
  const snapshot = await adminDb
    .collection("FiiIngestionRuns")
    .orderBy("createdAt", "desc")
    .limit(30)
    .get();

  return snapshot.docs.find((doc) => {
    const data = doc.data() || {};
    return data.ticker === ticker
      && ["queued", "scheduled", "running"].includes(String(data.status || ""));
  }) || null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isAdminAuthorized(req, body)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  let ticker: string;
  try {
    ticker = assertSupportedIngestionTicker(body?.ticker || "TGAR11");
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error?.message || "Ticker não autorizado.",
      supportedTickers: SUPPORTED_INGESTION_TICKERS,
    }, { status: 400 });
  }

  const activeRun = await findActiveRun(ticker);
  if (activeRun) {
    const data = activeRun.data() || {};
    return NextResponse.json({
      ok: false,
      error: `Já existe uma execução ativa para ${ticker}.`,
      runId: activeRun.id,
      status: data.status || null,
      currentStep: data.currentStep || null,
    }, { status: 409 });
  }

  const delayMinutes = Math.min(Math.max(Number(body?.delayMinutes || 0), 0), 1440);
  const currentYear = new Date().getFullYear();
  const year = Math.min(Math.max(Number(body?.year || currentYear), 2016), currentYear);
  const cnpj = normalizeCnpj(body?.cnpj) || undefined;
  const enableAi = trueValue(body?.enableAi);
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
      enableAi,
      mode: "operational_staging",
      publishToOfficialBase: false,
      requestedBy: session?.user || "legacy-admin-secret",
      status: delayMinutes > 0 ? "scheduled" : "queued",
      currentStep: delayMinutes > 0 ? "waiting" : "queued",
      requestedAt: adminFieldValue.serverTimestamp(),
      createdAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    });

    const workflowRun = await start(fiiIngestionWorkflow, [{
      runId,
      ticker,
      cnpj,
      year,
      delayMinutes,
      enableAi,
    }]);
    await runRef.set({
      workflowRunId: workflowRun.runId,
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({
      ok: true,
      runId,
      workflowRunId: workflowRun.runId,
      ticker,
      year,
      delayMinutes,
      enableAi,
      mode: "operational_staging",
      status: delayMinutes > 0 ? "scheduled" : "queued",
      publishToOfficialBase: false,
      qaUrl: `/api/admin/fii-ingestion/operational-qa?runId=${encodeURIComponent(runId)}&persist=1`,
    });
  } catch (error: any) {
    await runRef.set({
      status: "failed",
      currentStep: "start_failed",
      error: error?.message || "Falha ao iniciar workflow.",
      finishedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => undefined);

    return NextResponse.json({
      ok: false,
      runId,
      error: error?.message || "Falha ao iniciar workflow.",
    }, { status: 500 });
  }
}
