import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { isAdminAuthorized, readAdminSession } from "@/lib/adminSession";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { normalizeCnpj } from "@/lib/cvmIngestion";
import {
  assertSupportedIngestionTicker,
  getIngestionAdapterId,
  getIngestionFundConfig,
  SUPPORTED_INGESTION_TICKERS,
} from "@/lib/fiiIngestionConfig";
import { fundIngestionWorkflow } from "@/workflows/fundIngestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store", "Content-Type": "application/json; charset=utf-8" };
const LOCK_LEASE_MINUTES = 60;

function reply(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE });
}

function trueValue(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function lockIsActive(data: Record<string, any>) {
  const expiresAt = new Date(String(data.expiresAt || ""));
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
}

function integerInRange(value: unknown, fallback: number, minimum: number, maximum: number) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) return null;
  return parsed;
}

function leaseExpiresAt(delayMinutes = 0) {
  return new Date(Date.now() + (delayMinutes + LOCK_LEASE_MINUTES) * 60 * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isAdminAuthorized(req, body)) return reply({ ok: false, error: "Não autorizado." }, 401);

  let ticker: string;
  try {
    ticker = assertSupportedIngestionTicker(body?.ticker);
  } catch (error: any) {
    return reply({
      ok: false,
      error: error?.message || "Ticker não autorizado.",
      supportedTickers: SUPPORTED_INGESTION_TICKERS,
    }, 400);
  }

  const fundConfig = getIngestionFundConfig(ticker);
  const fundType = fundConfig?.fundType || "FII";
  const adapterId = getIngestionAdapterId(ticker);
  const currentYear = new Date().getFullYear();
  const delayMinutes = integerInRange(body?.delayMinutes, 0, 0, 1440);
  const year = integerInRange(body?.year, currentYear, 2016, currentYear);
  if (delayMinutes === null) return reply({ ok: false, error: "delayMinutes deve ser um inteiro entre 0 e 1440." }, 400);
  if (year === null) return reply({ ok: false, error: `year deve ser um inteiro entre 2016 e ${currentYear}.` }, 400);

  const rawCnpj = String(body?.cnpj || "").trim();
  const cnpj = normalizeCnpj(rawCnpj) || undefined;
  if (rawCnpj && !cnpj) return reply({ ok: false, error: "CNPJ informado é inválido." }, 400);

  const enableAi = trueValue(body?.enableAi);
  const runId = randomUUID();
  const runRef = adminDb.collection("FiiIngestionRuns").doc(runId);
  const lockRef = adminDb.collection("FiiIngestionActiveRuns").doc(ticker);
  const session = readAdminSession(req);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const lockSnapshot = await transaction.get(lockRef);
      if (lockSnapshot.exists) {
        const lock = (lockSnapshot.data() || {}) as Record<string, any>;
        if (lockIsActive(lock)) {
          throw Object.assign(new Error(`Já existe uma execução ativa para ${ticker}.`), {
            status: 409,
            activeRunId: lock.runId || null,
            activeStatus: lock.status || null,
          });
        }
      }

      transaction.set(runRef, {
        runId,
        ticker,
        fundType,
        adapterId,
        cnpj: cnpj || null,
        year,
        delayMinutes,
        enableAi,
        mode: "operational_staging",
        workflowVersion: 3,
        publishToOfficialBase: false,
        requestedBy: session?.user || "legacy-admin-header",
        status: delayMinutes > 0 ? "scheduled" : "queued",
        currentStep: delayMinutes > 0 ? "waiting" : "queued",
        requestedAt: adminFieldValue.serverTimestamp(),
        createdAt: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
      });
      transaction.set(lockRef, {
        ticker,
        runId,
        status: delayMinutes > 0 ? "scheduled" : "queued",
        currentStep: delayMinutes > 0 ? "waiting" : "queued",
        createdAt: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
        heartbeatAt: adminFieldValue.serverTimestamp(),
        expiresAt: leaseExpiresAt(delayMinutes),
      }, { merge: false });
    });
  } catch (error: any) {
    const status = Number(error?.status) === 409 ? 409 : 500;
    return reply({
      ok: false,
      runId: status === 409 ? error?.activeRunId || null : runId,
      status: status === 409 ? error?.activeStatus || null : undefined,
      error: error?.message || "Falha ao reservar a execução.",
    }, status);
  }

  let workflowRunId: string | null = null;
  try {
    const workflowRun = await start(fundIngestionWorkflow, [{ runId, ticker, cnpj, year, delayMinutes, enableAi }]);
    workflowRunId = workflowRun.runId;
  } catch (error: any) {
    await Promise.all([
      runRef.set({
        status: "failed",
        currentStep: "workflow_start_failed",
        error: error?.message || "Falha ao iniciar workflow.",
        finishedAt: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => undefined),
      adminDb.runTransaction(async (transaction) => {
        const lockSnapshot = await transaction.get(lockRef);
        if (lockSnapshot.exists && lockSnapshot.data()?.runId === runId) transaction.delete(lockRef);
      }).catch(() => undefined),
    ]);
    return reply({ ok: false, runId, error: error?.message || "Falha ao iniciar workflow." }, 500);
  }

  try {
    await adminDb.runTransaction(async (transaction) => {
      const lockSnapshot = await transaction.get(lockRef);
      if (!lockSnapshot.exists || lockSnapshot.data()?.runId !== runId) {
        throw new Error("A trava da ingestão mudou durante a inicialização do workflow.");
      }
      transaction.set(runRef, {
        workflowRunId,
        workflowStartConfirmed: true,
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(lockRef, {
        workflowRunId,
        status: delayMinutes > 0 ? "scheduled" : "queued",
        currentStep: delayMinutes > 0 ? "waiting" : "queued",
        heartbeatAt: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
        expiresAt: leaseExpiresAt(delayMinutes),
      }, { merge: true });
    });
  } catch (error: any) {
    // O workflow já foi iniciado. O lock deve permanecer para impedir uma execução concorrente.
    await runRef.set({
      workflowRunId,
      workflowStartConfirmed: true,
      status: "workflow_started_metadata_pending",
      currentStep: "workflow_started_metadata_pending",
      metadataPersistenceError: error?.message || "Falha ao persistir metadados do workflow iniciado.",
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => undefined);
    return reply({
      ok: true,
      warning: "Workflow iniciado, mas os metadados ainda precisam ser reconciliados. A trava foi preservada.",
      runId,
      workflowRunId,
      ticker,
      status: "workflow_started_metadata_pending",
      publishToOfficialBase: false,
    }, 202);
  }

  return reply({
    ok: true,
    runId,
    workflowRunId,
    ticker,
    fundType,
    adapterId,
    year,
    delayMinutes,
    enableAi,
    mode: "operational_staging",
    workflowVersion: 3,
    status: delayMinutes > 0 ? "scheduled" : "queued",
    publishToOfficialBase: false,
    qaUrl: `/api/admin/fii-ingestion/operational-qa?runId=${encodeURIComponent(runId)}&persist=1`,
  });
}
