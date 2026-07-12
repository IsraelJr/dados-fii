import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PILOT_TICKER = "TGAR11";
const OFFICIAL_SOURCE_HOSTS = [
  "cvm.gov.br",
  "dados.cvm.gov.br",
  "fnet.bmfbovespa.com.br",
  "rad.cvm.gov.br",
];

type CheckLevel = "pass" | "warn" | "fail";

type QaCheck = {
  id: string;
  level: CheckLevel;
  title: string;
  detail: string;
  evidence?: unknown;
};

type PlainDocument = Record<string, any> & { id: string };

function toIso(value: any) {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serializeValue(value: any): any {
  if (value === undefined || value === null) return null;
  if (typeof value?.toDate === "function") return toIso(value);
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeValue(item)])
    );
  }
  return value;
}

function normalizeCnpj(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 14 ? digits : "";
}

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function fieldCoverage(items: PlainDocument[], field: string) {
  if (!items.length) return 0;
  const present = items.filter((item) => {
    const value = item[field];
    return value !== undefined && value !== null && value !== "";
  }).length;
  return Number(((present / items.length) * 100).toFixed(1));
}

function percentage(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function validDate(value: unknown) {
  if (!value) return false;
  return !Number.isNaN(new Date(String(value)).getTime());
}

function hostnameOf(value: unknown) {
  try {
    return new URL(String(value || "")).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isOfficialSource(value: unknown) {
  const hostname = hostnameOf(value);
  return Boolean(
    hostname && OFFICIAL_SOURCE_HOSTS.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`))
  );
}

function snapshotSample(data: PlainDocument) {
  return {
    referenceDate: data.referenceDate || null,
    cnpj: data.cnpj || null,
    fundName: data.fundName || null,
    netWorth: numeric(data.netWorth),
    sharesOutstanding: numeric(data.sharesOutstanding),
    numberShareholders: numeric(data.numberShareholders),
    vpCota: numeric(data.vpCota),
    sourceUrl: data.source?.url || null,
  };
}

function documentSample(data: PlainDocument) {
  return {
    documentType: data.documentType || null,
    documentName: data.documentName || null,
    referenceDate: data.referenceDate || null,
    deliveryDate: data.deliveryDate || null,
    documentUrl: data.documentUrl || null,
    sourceUrl: data.source?.url || null,
  };
}

function check(
  checks: QaCheck[],
  id: string,
  level: CheckLevel,
  title: string,
  detail: string,
  evidence?: unknown
) {
  checks.push({ id, level, title, detail, evidence });
}

async function findRun(runId?: string) {
  if (runId) {
    const snapshot = await adminDb.collection("FiiIngestionRuns").doc(runId).get();
    return snapshot.exists ? snapshot : null;
  }

  const snapshot = await adminDb
    .collection("FiiIngestionRuns")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  return snapshot.docs.find((doc) => {
    const data = doc.data() || {};
    return data.ticker === PILOT_TICKER && data.status === "completed";
  }) || snapshot.docs.find((doc) => (doc.data() || {}).ticker === PILOT_TICKER) || null;
}

function recommendationsFor(checks: QaCheck[]) {
  const recommendations: string[] = [];
  const failures = checks.filter((item) => item.level === "fail");
  const warnings = checks.filter((item) => item.level === "warn");

  if (failures.length) {
    recommendations.push("Não publicar dados. Corrigir as verificações com nível fail antes de avançar.");
  }
  if (warnings.some((item) => item.id === "monthly-coverage")) {
    recommendations.push("Revisar o mapeamento dos campos do informe mensal da CVM.");
  }
  if (warnings.some((item) => item.id === "documents" || item.id === "document-sources")) {
    recommendations.push("Revisar os documentos eventuais e os links oficiais retornados.");
  }
  if (warnings.some((item) => item.id === "ai-extraction")) {
    recommendations.push("Revisar a configuração da OpenAI e a disponibilidade dos documentos oficiais.");
  }
  if (!failures.length) {
    recommendations.push("Realizar revisão humana dos valores e fontes antes de qualquer publicação oficial.");
  }
  return recommendations;
}

async function runQa(runId?: string, persist = false) {
  const runSnapshot = await findRun(runId);
  if (!runSnapshot) {
    return { found: false as const, error: "Nenhuma execução TGAR11 encontrada." };
  }

  const selectedRunId = runSnapshot.id;
  const run = (runSnapshot.data() || {}) as Record<string, any>;
  const stagingRef = adminDb.collection("FiiIngestionStaging").doc(selectedRunId);
  const [stagingSnapshot, monthlySnapshot, documentsSnapshot, officialSnapshot] = await Promise.all([
    stagingRef.get(),
    stagingRef.collection("MonthlySnapshots").limit(1000).get(),
    stagingRef.collection("Documents").limit(200).get(),
    adminDb.collection("Fiis").doc(PILOT_TICKER).get(),
  ]);

  const staging = (stagingSnapshot.data() || {}) as Record<string, any>;
  const monthly: PlainDocument[] = monthlySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...((doc.data() || {}) as Record<string, any>),
  }));
  const documents: PlainDocument[] = documentsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...((doc.data() || {}) as Record<string, any>),
  }));

  const result = (run.result || {}) as Record<string, any>;
  const validation = (staging.validation || result.validation || run.validation || {}) as Record<string, any>;
  const ai = (result.ai || run.ai || {}) as Record<string, any>;
  const aiExtraction = (staging.aiExtraction || ai.extraction || null) as Record<string, any> | null;
  const expectedCnpj = normalizeCnpj(run.cnpj || result.cnpj || staging.cnpj);
  const expectedMonthly = numeric(result.monthly?.snapshotsSaved ?? run.monthly?.snapshotsSaved);
  const expectedDocuments = numeric(result.documents?.documentsSaved ?? run.documents?.documentsSaved);
  const checks: QaCheck[] = [];

  check(
    checks,
    "run-status",
    run.status === "completed" && run.currentStep === "completed" ? "pass" : "fail",
    "Execução concluída",
    run.status === "completed" ? "A execução terminou com status completed." : `Status atual: ${run.status || "ausente"}.`,
    { status: run.status || null, currentStep: run.currentStep || null, error: run.error || null }
  );

  check(
    checks,
    "ticker-scope",
    run.ticker === PILOT_TICKER ? "pass" : "fail",
    "Escopo restrito ao TGAR11",
    run.ticker === PILOT_TICKER ? "O piloto permaneceu restrito ao ticker autorizado." : `Ticker inesperado: ${run.ticker || "ausente"}.`,
    { ticker: run.ticker || null }
  );

  const publicationFlags = [run.publishToOfficialBase, validation.publishToOfficialBase]
    .filter((value) => value !== undefined);
  const publicationBlocked = publicationFlags.length > 0 && publicationFlags.every((value) => value === false);
  check(
    checks,
    "publication-safety",
    publicationBlocked ? "pass" : "fail",
    "Proteção da base oficial",
    publicationBlocked
      ? "Os indicadores confirmam que o piloto não publica na coleção oficial."
      : "Não foi possível confirmar publishToOfficialBase=false.",
    { run: run.publishToOfficialBase ?? null, validation: validation.publishToOfficialBase ?? null }
  );

  check(
    checks,
    "staging-root",
    stagingSnapshot.exists ? "pass" : "fail",
    "Documento de staging",
    stagingSnapshot.exists
      ? "O documento raiz da execução existe em FiiIngestionStaging."
      : "O documento raiz de staging não foi encontrado."
  );

  check(
    checks,
    "cnpj",
    expectedCnpj ? "pass" : "fail",
    "CNPJ resolvido",
    expectedCnpj ? `CNPJ válido com 14 dígitos: ${expectedCnpj}.` : "O CNPJ da execução está ausente ou inválido."
  );

  const monthlyCnpjMismatch = expectedCnpj
    ? monthly.filter((item) => normalizeCnpj(item.cnpj) && normalizeCnpj(item.cnpj) !== expectedCnpj).length
    : monthly.length;
  const documentCnpjMismatch = expectedCnpj
    ? documents.filter((item) => normalizeCnpj(item.cnpj) && normalizeCnpj(item.cnpj) !== expectedCnpj).length
    : documents.length;
  check(
    checks,
    "cnpj-consistency",
    monthlyCnpjMismatch === 0 && documentCnpjMismatch === 0 ? "pass" : "fail",
    "Consistência do CNPJ",
    monthlyCnpjMismatch === 0 && documentCnpjMismatch === 0
      ? "Nenhum registro apresenta CNPJ divergente."
      : "Foram encontrados registros associados a outro CNPJ.",
    { monthlyCnpjMismatch, documentCnpjMismatch }
  );

  check(
    checks,
    "monthly-count",
    monthly.length > 0 ? "pass" : "fail",
    "Informes mensais encontrados",
    monthly.length > 0 ? `${monthly.length} snapshots mensais foram encontrados.` : "Nenhum snapshot mensal foi encontrado.",
    { actual: monthly.length, expected: expectedMonthly }
  );

  if (expectedMonthly !== null) {
    check(
      checks,
      "monthly-count-match",
      monthly.length === expectedMonthly ? "pass" : "warn",
      "Contagem mensal consistente",
      monthly.length === expectedMonthly
        ? "A quantidade gravada corresponde ao resumo da execução."
        : "A quantidade no staging difere do resumo do workflow.",
      { actual: monthly.length, expected: expectedMonthly }
    );
  }

  const coverage = {
    referenceDate: fieldCoverage(monthly, "referenceDate"),
    netWorth: fieldCoverage(monthly, "netWorth"),
    sharesOutstanding: fieldCoverage(monthly, "sharesOutstanding"),
    numberShareholders: fieldCoverage(monthly, "numberShareholders"),
    vpCota: fieldCoverage(monthly, "vpCota"),
  };
  const essentialCoverage = [coverage.referenceDate, coverage.netWorth, coverage.sharesOutstanding, coverage.vpCota];
  const minimumCoverage = essentialCoverage.length ? Math.min(...essentialCoverage) : 0;
  check(
    checks,
    "monthly-coverage",
    minimumCoverage >= 80 ? "pass" : minimumCoverage > 0 ? "warn" : "fail",
    "Cobertura dos campos mensais",
    minimumCoverage >= 80
      ? "Os campos essenciais possuem cobertura igual ou superior a 80%."
      : `A menor cobertura entre os campos essenciais é ${minimumCoverage}%.`,
    coverage
  );

  const rowsWithDate = monthly.filter((item) => item.referenceDate);
  const invalidDates = rowsWithDate.filter((item) => !validDate(item.referenceDate)).length;
  check(
    checks,
    "monthly-dates",
    invalidDates === 0 && coverage.referenceDate >= 80 ? "pass" : invalidDates < rowsWithDate.length ? "warn" : "fail",
    "Datas de referência",
    invalidDates === 0 ? "As datas preenchidas são interpretáveis." : `${invalidDates} datas não puderam ser interpretadas.`,
    { invalidDates, rowsWithDate: rowsWithDate.length }
  );

  const positiveNetWorth = monthly.filter((item) => numeric(item.netWorth) !== null && Number(item.netWorth) > 0).length;
  const positiveShares = monthly.filter((item) => numeric(item.sharesOutstanding) !== null && Number(item.sharesOutstanding) > 0).length;
  const positiveVpCota = monthly.filter((item) => numeric(item.vpCota) !== null && Number(item.vpCota) > 0).length;
  const plausibleRatio = Math.min(
    percentage(positiveNetWorth, monthly.length),
    percentage(positiveShares, monthly.length),
    percentage(positiveVpCota, monthly.length)
  );
  check(
    checks,
    "monthly-values",
    plausibleRatio >= 80 ? "pass" : plausibleRatio > 0 ? "warn" : "fail",
    "Plausibilidade dos valores mensais",
    plausibleRatio >= 80
      ? "A maioria dos registros possui patrimônio, cotas e VP/cota positivos."
      : `A menor taxa de valores positivos é ${plausibleRatio}%.`,
    { positiveNetWorth, positiveShares, positiveVpCota, total: monthly.length }
  );

  check(
    checks,
    "documents",
    documents.length > 0 ? "pass" : "warn",
    "Documentos eventuais",
    documents.length > 0 ? `${documents.length} documentos foram indexados.` : "Nenhum documento eventual foi indexado.",
    { actual: documents.length, expected: expectedDocuments }
  );

  if (expectedDocuments !== null) {
    check(
      checks,
      "document-count-match",
      documents.length === expectedDocuments ? "pass" : "warn",
      "Contagem de documentos consistente",
      documents.length === expectedDocuments
        ? "A quantidade gravada corresponde ao resumo da execução."
        : "A quantidade atual difere do resumo do workflow.",
      { actual: documents.length, expected: expectedDocuments }
    );
  }

  const datasetUrls = documents.map((item) => item.source?.url).filter(Boolean);
  const documentUrls = documents.map((item) => item.documentUrl).filter(Boolean);
  const officialDatasetUrls = datasetUrls.filter(isOfficialSource).length;
  const officialDocumentUrls = documentUrls.filter(isOfficialSource).length;
  const sourceCheckPassed = documents.length > 0
    && officialDatasetUrls === datasetUrls.length
    && (documentUrls.length === 0 || officialDocumentUrls === documentUrls.length);
  check(
    checks,
    "document-sources",
    sourceCheckPassed ? "pass" : "warn",
    "Fontes dos documentos",
    documents.length === 0 ? "Sem documentos para validar as fontes." : "As origens dos catálogos e documentos foram verificadas.",
    {
      datasetUrls: datasetUrls.length,
      officialDatasetUrls,
      documentUrls: documentUrls.length,
      officialDocumentUrls,
      acceptedHosts: OFFICIAL_SOURCE_HOSTS,
    }
  );

  const aiCompleted = ai.status === "completed" && Boolean(aiExtraction);
  check(
    checks,
    "ai-extraction",
    aiCompleted ? "pass" : "warn",
    "Extração por IA",
    aiCompleted
      ? "A extração por IA terminou e foi armazenada no staging."
      : `Extração não concluída ou não armazenada: ${ai.reason || ai.status || "estado desconhecido"}.`,
    { status: ai.status || null, reason: ai.reason || null, hasExtraction: Boolean(aiExtraction) }
  );

  check(
    checks,
    "workflow-validation",
    validation.readyForReview === true ? "pass" : "warn",
    "Validação do workflow",
    validation.readyForReview === true
      ? "O workflow marcou os dados como prontos para revisão humana."
      : "O workflow não marcou os dados como prontos para revisão humana.",
    serializeValue(validation)
  );

  const passCount = checks.filter((item) => item.level === "pass").length;
  const warnCount = checks.filter((item) => item.level === "warn").length;
  const failCount = checks.filter((item) => item.level === "fail").length;
  const score = Math.max(0, Math.min(100, 100 - failCount * 25 - warnCount * 6));
  const verdict = failCount > 0
    ? "failed"
    : warnCount > 0
      ? "approved_with_warnings"
      : "approved_for_human_review";

  const sortedMonthly = [...monthly]
    .sort((left, right) => String(right.referenceDate || "").localeCompare(String(left.referenceDate || "")));
  const sortedDocuments = [...documents]
    .sort((left, right) => String(right.deliveryDate || right.referenceDate || "")
      .localeCompare(String(left.deliveryDate || left.referenceDate || "")));

  const assistantReviewPayload = {
    instruction: "Revise este QA do piloto TGAR11. Identifique inconsistências, riscos de qualidade e campos ausentes. Diga se o próximo passo deve ser corrigir, repetir a ingestão ou iniciar revisão humana. Não autorize publicação automática.",
    verdict,
    score,
    runId: selectedRunId,
    counts: { monthly: monthly.length, documents: documents.length },
    coverage,
    failures: checks.filter((item) => item.level === "fail"),
    warnings: checks.filter((item) => item.level === "warn"),
    samples: {
      monthly: sortedMonthly.slice(0, 3).map(snapshotSample),
      documents: sortedDocuments.slice(0, 3).map(documentSample),
    },
    aiSummary: aiExtraction ? {
      summary: aiExtraction.summary || null,
      warnings: Array.isArray(aiExtraction.warnings) ? aiExtraction.warnings : [],
      risks: Array.isArray(aiExtraction.risks) ? aiExtraction.risks : [],
      sourceUrls: Array.isArray(aiExtraction.sourceUrls) ? aiExtraction.sourceUrls : [],
    } : null,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    runId: selectedRunId,
    ticker: run.ticker || null,
    cnpj: expectedCnpj || null,
    year: run.year || result.year || null,
    verdict,
    score,
    canProceedToHumanReview: failCount === 0 && monthly.length > 0,
    canPublishToOfficialBase: false,
    publicationDecision: "blocked_pending_human_review",
    summary: { pass: passCount, warn: warnCount, fail: failCount },
    counts: {
      monthlySnapshots: monthly.length,
      expectedMonthlySnapshots: expectedMonthly,
      documents: documents.length,
      expectedDocuments,
    },
    coverage,
    checks,
    recommendations: recommendationsFor(checks),
    run: {
      status: run.status || null,
      currentStep: run.currentStep || null,
      requestedAt: toIso(run.requestedAt),
      createdAt: toIso(run.createdAt),
      updatedAt: toIso(run.updatedAt),
      finishedAt: toIso(run.finishedAt),
      requestedBy: run.requestedBy || null,
      publishToOfficialBase: run.publishToOfficialBase ?? null,
      error: run.error || null,
    },
    staging: {
      exists: stagingSnapshot.exists,
      updatedAt: toIso(staging.updatedAt),
      aiExtractionUpdatedAt: toIso(staging.aiExtractionUpdatedAt),
      validation: serializeValue(validation),
    },
    officialBaseObservation: {
      documentExists: officialSnapshot.exists,
      code: officialSnapshot.data()?.code || officialSnapshot.id,
      updatedAt: toIso(officialSnapshot.data()?.updatedAt),
      note: "Esta API não altera Fiis/TGAR11. Ela valida os indicadores de não publicação do piloto, mas não afirma ausência de alterações externas concorrentes.",
    },
    samples: {
      latestMonthlySnapshots: sortedMonthly.slice(0, 5).map(snapshotSample),
      latestDocuments: sortedDocuments.slice(0, 5).map(documentSample),
    },
    aiReview: aiExtraction ? {
      summary: aiExtraction.summary || null,
      warnings: Array.isArray(aiExtraction.warnings) ? aiExtraction.warnings : [],
      risks: Array.isArray(aiExtraction.risks) ? aiExtraction.risks : [],
      sourceUrls: Array.isArray(aiExtraction.sourceUrls) ? aiExtraction.sourceUrls : [],
    } : null,
    assistantReviewPayload,
  };

  if (persist) {
    await Promise.all([
      stagingRef.set(
        { manualQa: report, manualQaUpdatedAt: adminFieldValue.serverTimestamp() },
        { merge: true }
      ),
      runSnapshot.ref.set(
        { manualQa: report, manualQaUpdatedAt: adminFieldValue.serverTimestamp() },
        { merge: true }
      ),
    ]);
  }

  return { found: true as const, report, persisted: persist };
}

async function handle(req: NextRequest, body?: Record<string, any>) {
  if (!isAdminAuthorized(req, body)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const runId = String(body?.runId || req.nextUrl.searchParams.get("runId") || "").trim();
    const persistValue = body?.persist ?? req.nextUrl.searchParams.get("persist");
    const persist = persistValue === true
      || persistValue === 1
      || persistValue === "1"
      || persistValue === "true";
    const result = await runQa(runId || undefined, persist);

    if (!result.found) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Erro ao validar o piloto." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, any>));
  return handle(req, body);
}
