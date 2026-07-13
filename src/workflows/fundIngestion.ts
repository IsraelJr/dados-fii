import { sleep } from "workflow";
import type { IngestionAdapterId } from "@/lib/fiiIngestionConfig";

export type FundIngestionInput = {
  runId: string;
  ticker: string;
  cnpj?: string;
  year?: number;
  delayMinutes?: number;
  enableAi?: boolean;
};

const DEFAULT_LEASE_MINUTES = 60;

function leaseExpiresAt(minutes: number) {
  return new Date(Date.now() + Math.max(minutes, DEFAULT_LEASE_MINUTES) * 60 * 1000).toISOString();
}

async function updateRun(
  ticker: string,
  runId: string,
  payload: Record<string, unknown>,
  leaseMinutes = DEFAULT_LEASE_MINUTES
) {
  "use step";
  const { adminDb, adminFieldValue } = await import("@/lib/firebaseAdmin");
  const runRef = adminDb.collection("FiiIngestionRuns").doc(runId);
  const lockRef = adminDb.collection("FiiIngestionActiveRuns").doc(ticker);

  await adminDb.runTransaction(async (transaction) => {
    const lockSnapshot = await transaction.get(lockRef);
    transaction.set(runRef, {
      ...payload,
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    if (lockSnapshot.exists && lockSnapshot.data()?.runId === runId) {
      transaction.set(lockRef, {
        status: payload.status || lockSnapshot.data()?.status || "running",
        currentStep: payload.currentStep || lockSnapshot.data()?.currentStep || null,
        heartbeatAt: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
        expiresAt: leaseExpiresAt(leaseMinutes),
      }, { merge: true });
    }
  });
}

async function resolveCnpj(input: FundIngestionInput) {
  "use step";
  const { resolvePilotCnpj } = await import("@/lib/cvmIngestion");
  const { getKnownIngestionCnpj, normalizeIngestionTicker } = await import("@/lib/fiiIngestionConfig");
  const ticker = normalizeIngestionTicker(input.ticker);
  const environmentName = `${ticker}_CNPJ`;
  const environmentCnpj = String(process.env[environmentName] || "").replace(/\D/g, "");
  const knownCnpj = getKnownIngestionCnpj(ticker);
  const fallback = input.cnpj || (environmentCnpj.length === 14 ? environmentCnpj : "") || knownCnpj;

  try {
    return await resolvePilotCnpj(ticker, fallback || undefined);
  } catch {
    throw new Error(`CNPJ não encontrado para ${ticker}. Informe no disparo, em Fiis/${ticker} ou na variável ${environmentName}.`);
  }
}

async function importMonthly(input: { runId: string; ticker: string; cnpj: string; year: number; adapterId: IngestionAdapterId }) {
  "use step";
  const { runMonthlyIngestionAdapter } = await import("@/lib/fiiIngestionAdapters");
  return runMonthlyIngestionAdapter(input.adapterId, input);
}

async function importDocuments(input: { runId: string; ticker: string; cnpj: string; year: number }) {
  "use step";
  const { importEventualDocuments } = await import("@/lib/cvmIngestion");
  return importEventualDocuments({ ...input, limit: 40 });
}

async function extractDocuments(input: {
  runId: string;
  ticker: string;
  documents: Array<Record<string, unknown>>;
  enabled: boolean;
}) {
  "use step";
  if (!input.enabled) {
    return {
      enabled: false,
      status: "disabled",
      quality: "not_requested",
      reason: "disabled_by_configuration",
      documentsSubmitted: 0,
      sourceUrlsUsed: 0,
      sourceCoverage: 0,
      externalSourceUrls: [],
    };
  }

  try {
    const { extractPilotInsightsV2 } = await import("@/lib/cvmPilotAi");
    return { enabled: true, ...await extractPilotInsightsV2(input) };
  } catch (error: any) {
    const message = String(error?.message || "Falha opcional na extração documental por IA.");
    const normalized = message.toLowerCase();
    const errorCode = normalized.includes("insufficient_quota") || normalized.includes("exceeded your current quota")
      ? "quota_exhausted"
      : "ai_optional_failure";

    return {
      enabled: true,
      status: "failed_optional",
      quality: "incomplete",
      reason: message,
      errorCode,
      documentsSubmitted: Math.min(input.documents.length, 8),
      sourceUrlsUsed: 0,
      sourceCoverage: 0,
      externalSourceUrls: [],
    };
  }
}

async function validate(input: { runId: string; ticker: string; cnpj: string; monthly: any; documents: any; ai: any }) {
  "use step";
  const { validateOperationalRun } = await import("@/lib/cvmOperationalValidation");
  return validateOperationalRun(input);
}

async function markCompleted(ticker: string, runId: string, result: Record<string, unknown>) {
  "use step";
  const { adminDb, adminFieldValue } = await import("@/lib/firebaseAdmin");
  const runRef = adminDb.collection("FiiIngestionRuns").doc(runId);
  const lockRef = adminDb.collection("FiiIngestionActiveRuns").doc(ticker);

  await adminDb.runTransaction(async (transaction) => {
    const lockSnapshot = await transaction.get(lockRef);
    transaction.set(runRef, {
      status: "completed",
      currentStep: "completed",
      result,
      finishedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });
    if (lockSnapshot.exists && lockSnapshot.data()?.runId === runId) transaction.delete(lockRef);
  });
}

async function markFailed(ticker: string, runId: string, error: string) {
  "use step";
  const { adminDb, adminFieldValue } = await import("@/lib/firebaseAdmin");
  const runRef = adminDb.collection("FiiIngestionRuns").doc(runId);
  const lockRef = adminDb.collection("FiiIngestionActiveRuns").doc(ticker);

  await adminDb.runTransaction(async (transaction) => {
    const lockSnapshot = await transaction.get(lockRef);
    transaction.set(runRef, {
      status: "failed",
      currentStep: "failed",
      error,
      finishedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });
    if (lockSnapshot.exists && lockSnapshot.data()?.runId === runId) transaction.delete(lockRef);
  });
}

export async function fundIngestionWorkflow(input: FundIngestionInput) {
  "use workflow";

  const rawTicker = String(input.ticker || "").trim().toUpperCase();
  let ticker = rawTicker;

  try {
    const { assertSupportedIngestionTicker, getIngestionAdapterId, getIngestionFundConfig } = await import("@/lib/fiiIngestionConfig");
    if (!input.runId) throw new Error("O runId é obrigatório para iniciar a ingestão.");
    if (!rawTicker) throw new Error("O ticker é obrigatório para iniciar a ingestão.");

    ticker = assertSupportedIngestionTicker(rawTicker);
    const fundConfig = getIngestionFundConfig(ticker);
    const adapterId = getIngestionAdapterId(ticker);
    const fundType = fundConfig?.fundType || "FII";
    const year = Number(input.year ?? new Date().getFullYear());
    const delayMinutes = Number(input.delayMinutes ?? 0);
    if (!Number.isInteger(year) || year < 2016 || year > new Date().getFullYear()) {
      throw new Error("Ano de ingestão inválido.");
    }
    if (!Number.isFinite(delayMinutes) || delayMinutes < 0 || delayMinutes > 1440) {
      throw new Error("Atraso de ingestão inválido.");
    }
    const enableAi = input.enableAi === true;

    await updateRun(ticker, input.runId, {
      status: delayMinutes > 0 ? "scheduled" : "running",
      currentStep: delayMinutes > 0 ? "waiting" : "resolve_cnpj",
      ticker,
      fundType,
      adapterId,
      year,
      parserVersion: 2,
      workflowVersion: 3,
      enableAi,
      publishToOfficialBase: false,
    }, delayMinutes + DEFAULT_LEASE_MINUTES);

    if (delayMinutes > 0) await sleep(`${delayMinutes}m`);

    await updateRun(ticker, input.runId, { status: "running", currentStep: "resolve_cnpj" });
    const cnpj = await resolveCnpj({ ...input, ticker, year });
    await updateRun(ticker, input.runId, { cnpj, currentStep: "cvm_monthly" });

    const monthly = await importMonthly({ runId: input.runId, ticker, cnpj, year, adapterId });
    await updateRun(ticker, input.runId, { monthly, currentStep: "cvm_documents" });

    const documents = await importDocuments({ runId: input.runId, ticker, cnpj, year });
    await updateRun(ticker, input.runId, { documents, currentStep: enableAi ? "ai_extraction" : "validation" });

    const ai = await extractDocuments({ runId: input.runId, ticker, documents: documents.documents, enabled: enableAi });
    await updateRun(ticker, input.runId, { ai, currentStep: "validation" });

    const validation = await validate({ runId: input.runId, ticker, cnpj, monthly, documents, ai });
    const result = {
      ticker,
      cnpj,
      fundType,
      adapterId,
      year,
      parserVersion: 2,
      workflowVersion: 3,
      enableAi,
      monthly,
      documents,
      ai,
      validation,
    };
    await markCompleted(ticker, input.runId, result);
    return result;
  } catch (error: any) {
    const message = error?.message || "Erro desconhecido no modo operacional de ingestão.";
    if (input.runId && ticker) await markFailed(ticker, input.runId, message);
    throw error;
  }
}

export const fiiIngestionWorkflow = fundIngestionWorkflow;
