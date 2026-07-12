import { sleep } from "workflow";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import {
  extractPilotInsights,
  importEventualDocuments,
  importMonthlyCvmData,
  normalizeTicker,
  resolvePilotCnpj,
  validatePilotRun,
  type FiiIngestionInput,
} from "@/lib/cvmIngestion";

async function updateRun(runId: string, payload: Record<string, unknown>) {
  "use step";
  await adminDb.collection("FiiIngestionRuns").doc(runId).set({
    ...payload,
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });
}

async function resolveCnpj(input: FiiIngestionInput) {
  "use step";
  return resolvePilotCnpj(input.ticker, input.cnpj);
}

async function importMonthly(input: { runId: string; ticker: string; cnpj: string; year: number }) {
  "use step";
  return importMonthlyCvmData(input);
}

async function importDocuments(input: { runId: string; ticker: string; cnpj: string; year: number }) {
  "use step";
  return importEventualDocuments({ ...input, limit: 40 });
}

async function extractDocuments(input: { runId: string; ticker: string; documents: Array<Record<string, unknown>> }) {
  "use step";
  return extractPilotInsights(input);
}

async function validate(input: { runId: string; ticker: string; cnpj: string; monthly: any; documents: any; ai: any }) {
  "use step";
  return validatePilotRun(input);
}

async function markCompleted(runId: string, result: Record<string, unknown>) {
  "use step";
  await adminDb.collection("FiiIngestionRuns").doc(runId).set({
    status: "completed",
    currentStep: "completed",
    result,
    finishedAt: adminFieldValue.serverTimestamp(),
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });
}

async function markFailed(runId: string, error: string) {
  "use step";
  await adminDb.collection("FiiIngestionRuns").doc(runId).set({
    status: "failed",
    currentStep: "failed",
    error,
    finishedAt: adminFieldValue.serverTimestamp(),
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function tgar11IngestionWorkflow(input: FiiIngestionInput) {
  "use workflow";

  const ticker = normalizeTicker(input.ticker || "TGAR11");
  const year = Number(input.year || 2026);
  const delayMinutes = Math.min(Math.max(Number(input.delayMinutes || 0), 0), 1440);

  try {
    await updateRun(input.runId, {
      status: delayMinutes > 0 ? "scheduled" : "running",
      currentStep: delayMinutes > 0 ? "waiting" : "resolve_cnpj",
      ticker,
      year,
      publishToOfficialBase: false,
    });

    if (delayMinutes > 0) await sleep(`${delayMinutes}m`);

    await updateRun(input.runId, { status: "running", currentStep: "resolve_cnpj" });
    const cnpj = await resolveCnpj({ ...input, ticker, year });
    await updateRun(input.runId, { cnpj, currentStep: "cvm_monthly" });

    const monthly = await importMonthly({ runId: input.runId, ticker, cnpj, year });
    await updateRun(input.runId, { monthly, currentStep: "cvm_documents" });

    const documents = await importDocuments({ runId: input.runId, ticker, cnpj, year });
    await updateRun(input.runId, { documents, currentStep: "ai_extraction" });

    const ai = await extractDocuments({ runId: input.runId, ticker, documents: documents.documents });
    await updateRun(input.runId, { ai, currentStep: "validation" });

    const validation = await validate({ runId: input.runId, ticker, cnpj, monthly, documents, ai });
    const result = { ticker, cnpj, year, monthly, documents, ai, validation };
    await markCompleted(input.runId, result);
    return result;
  } catch (error: any) {
    const message = error?.message || "Erro desconhecido no piloto de ingestão.";
    await markFailed(input.runId, message);
    throw error;
  }
}
