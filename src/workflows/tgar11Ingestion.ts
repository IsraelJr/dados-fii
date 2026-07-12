import { sleep } from "workflow";

type FiiIngestionInput = {
  runId: string;
  ticker: string;
  cnpj?: string;
  year?: number;
  delayMinutes?: number;
};

function normalizeTicker(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function updateRun(runId: string, payload: Record<string, unknown>) {
  "use step";
  const { adminDb, adminFieldValue } = await import("@/lib/firebaseAdmin");
  await adminDb.collection("FiiIngestionRuns").doc(runId).set({
    ...payload,
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });
}

async function resolveCnpj(input: FiiIngestionInput) {
  "use step";
  const { resolvePilotCnpj } = await import("@/lib/cvmIngestion");
  return resolvePilotCnpj(input.ticker, input.cnpj);
}

async function importMonthly(input: { runId: string; ticker: string; cnpj: string; year: number }) {
  "use step";
  const { importMonthlyCvmDataV2 } = await import("@/lib/cvmMonthlyIngestion");
  return importMonthlyCvmDataV2(input);
}

async function importDocuments(input: { runId: string; ticker: string; cnpj: string; year: number }) {
  "use step";
  const { importEventualDocuments } = await import("@/lib/cvmIngestion");
  return importEventualDocuments({ ...input, limit: 40 });
}

async function extractDocuments(input: { runId: string; ticker: string; documents: Array<Record<string, unknown>> }) {
  "use step";
  const { extractPilotInsightsV2 } = await import("@/lib/cvmPilotAi");
  return extractPilotInsightsV2(input);
}

async function validate(input: { runId: string; ticker: string; cnpj: string; monthly: any; documents: any; ai: any }) {
  "use step";
  const { validatePilotRunV2 } = await import("@/lib/cvmMonthlyIngestion");
  return validatePilotRunV2(input);
}

async function markCompleted(runId: string, result: Record<string, unknown>) {
  "use step";
  const { adminDb, adminFieldValue } = await import("@/lib/firebaseAdmin");
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
  const { adminDb, adminFieldValue } = await import("@/lib/firebaseAdmin");
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
      parserVersion: 2,
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
    const result = { ticker, cnpj, year, parserVersion: 2, monthly, documents, ai, validation };
    await markCompleted(input.runId, result);
    return result;
  } catch (error: any) {
    const message = error?.message || "Erro desconhecido no piloto de ingestão.";
    await markFailed(input.runId, message);
    throw error;
  }
}
