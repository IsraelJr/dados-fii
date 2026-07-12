import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PILOT_TICKER = "TGAR11";
const ESSENTIAL_FIELDS = [
  "referenceDate",
  "netWorth",
  "sharesOutstanding",
  "numberShareholders",
  "vpCota",
] as const;
const OFFICIAL_SOURCE_HOSTS = [
  "cvm.gov.br",
  "dados.cvm.gov.br",
  "fnet.bmfbovespa.com.br",
  "rad.cvm.gov.br",
];

type CheckLevel = "pass" | "warn" | "fail";
type PlainDocument = Record<string, any> & { id: string };
type QaCheck = {
  id: string;
  level: CheckLevel;
  title: string;
  detail: string;
  evidence?: unknown;
};

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function toIso(value: any) {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
    hostname && OFFICIAL_SOURCE_HOSTS.some((allowed) =>
      hostname === allowed || hostname.endsWith(`.${allowed}`)
    )
  );
}

function addCheck(
  checks: QaCheck[],
  id: string,
  level: CheckLevel,
  title: string,
  detail: string,
  evidence?: unknown
) {
  checks.push(evidence === undefined
    ? { id, level, title, detail }
    : { id, level, title, detail, evidence });
}

function monthlySample(item: PlainDocument) {
  return {
    referenceDate: item.referenceDate || null,
    cnpj: item.cnpj || null,
    fundName: item.fundName || null,
    netWorth: numeric(item.netWorth),
    sharesOutstanding: numeric(item.sharesOutstanding),
    numberShareholders: numeric(item.numberShareholders),
    vpCota: numeric(item.vpCota),
    sourceFiles: Array.isArray(item.source?.files) ? item.source.files : [],
    sourceKinds: Array.isArray(item.source?.kinds) ? item.source.kinds : [],
    conflicts: Array.isArray(item.conflicts) ? item.conflicts : [],
  };
}

function documentSample(item: PlainDocument) {
  return {
    documentType: item.documentType || null,
    documentName: item.documentName || null,
    referenceDate: item.referenceDate || null,
    deliveryDate: item.deliveryDate || null,
    documentUrl: item.documentUrl || null,
    sourceUrl: item.source?.url || null,
  };
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

function buildRecommendations(checks: QaCheck[]) {
  const failures = checks.filter((check) => check.level === "fail");
  const warnings = checks.filter((check) => check.level === "warn");
  const recommendations: string[] = [];

  if (failures.length) {
    recommendations.push("Não publicar. Corrigir todos os checks com nível fail e repetir a ingestão em staging.");
  }
  if (warnings.some((check) => check.id === "ai-coverage")) {
    recommendations.push("Tratar a análise documental da IA como parcial e revisar manualmente os documentos não acessados.");
  }
  if (!failures.length) {
    recommendations.push("Prosseguir somente para revisão humana dos valores e fontes; a publicação automática permanece bloqueada.");
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
  const result = (run.result || {}) as Record<string, any>;
  const stagingRef = adminDb.collection("FiiIngestionStaging").doc(selectedRunId);
  const [stagingSnapshot, monthlySnapshot, documentsSnapshot, officialSnapshot] = await Promise.all([
    stagingRef.get(),
    stagingRef.collection("MonthlySnapshots").limit(1000).get(),
    stagingRef.collection("Documents").limit(200).get(),
    adminDb.collection("Fiis").doc(PILOT_TICKER).get(),
  ]);

  const staging = (stagingSnapshot.data() || {}) as Record<string, any>;
  const validation = (staging.validation || result.validation || {}) as Record<string, any>;
  const ai = (result.ai || run.ai || {}) as Record<string, any>;
  const aiExtraction = (staging.aiExtraction || ai.extraction || null) as Record<string, any> | null;
  const monthly: PlainDocument[] = monthlySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...((doc.data() || {}) as Record<string, any>),
  }));
  const documents: PlainDocument[] = documentsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...((doc.data() || {}) as Record<string, any>),
  }));
  const expectedCnpj = normalizeCnpj(run.cnpj || result.cnpj || staging.cnpj);
  const parserVersion = Number(run.parserVersion || result.parserVersion || validation.parserVersion || 1);
  const checks: QaCheck[] = [];

  addCheck(
    checks,
    "run-status",
    run.status === "completed" && run.currentStep === "completed" ? "pass" : "fail",
    "Execução concluída",
    run.status === "completed"
      ? "A execução terminou com status completed."
      : `Status atual: ${run.status || "ausente"}.`,
    { status: run.status || null, currentStep: run.currentStep || null, error: run.error || null }
  );

  addCheck(
    checks,
    "parser-version",
    parserVersion >= 2 ? "pass" : "fail",
    "Parser mensal consolidado",
    parserVersion >= 2
      ? `A execução utilizou o parser v${parserVersion}.`
      : "A execução foi produzida pelo parser antigo e deve ser repetida.",
    { parserVersion }
  );

  const publicationBlocked = run.publishToOfficialBase === false
    && validation.publishToOfficialBase === false;
  addCheck(
    checks,
    "publication-safety",
    publicationBlocked ? "pass" : "fail",
    "Proteção da base oficial",
    publicationBlocked
      ? "A execução e a validação mantiveram publishToOfficialBase=false."
      : "Não foi possível comprovar o bloqueio de publicação.",
    {
      run: run.publishToOfficialBase ?? null,
      validation: validation.publishToOfficialBase ?? null,
    }
  );

  addCheck(
    checks,
    "staging-root",
    stagingSnapshot.exists ? "pass" : "fail",
    "Documento de staging",
    stagingSnapshot.exists
      ? "O documento raiz existe em FiiIngestionStaging."
      : "O documento raiz de staging não foi encontrado."
  );

  addCheck(
    checks,
    "cnpj",
    expectedCnpj ? "pass" : "fail",
    "CNPJ resolvido",
    expectedCnpj
      ? `CNPJ válido com 14 dígitos: ${expectedCnpj}.`
      : "O CNPJ da execução está ausente ou inválido."
  );

  const cnpjMismatch = monthly.filter((item) =>
    expectedCnpj && normalizeCnpj(item.cnpj) !== expectedCnpj
  ).length;
  addCheck(
    checks,
    "cnpj-consistency",
    cnpjMismatch === 0 ? "pass" : "fail",
    "Consistência do CNPJ",
    cnpjMismatch === 0
      ? "Todos os snapshots pertencem ao CNPJ esperado."
      : `${cnpjMismatch} snapshots apresentam CNPJ divergente.`,
    { cnpjMismatch }
  );

  const dateCounts = new Map<string, number>();
  for (const item of monthly) {
    const date = String(item.referenceDate || "");
    if (date) dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
  }
  const duplicateDates = [...dateCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([date, count]) => ({ date, count }));
  addCheck(
    checks,
    "monthly-uniqueness",
    monthly.length > 0 && duplicateDates.length === 0 ? "pass" : "fail",
    "Uma linha por competência",
    monthly.length === 0
      ? "Nenhum snapshot mensal foi encontrado."
      : duplicateDates.length
        ? "Existem competências duplicadas após a consolidação."
        : `${monthly.length} competências únicas foram encontradas.`,
    { monthlySnapshots: monthly.length, duplicateDates }
  );

  const coverage = Object.fromEntries(
    ESSENTIAL_FIELDS.map((field) => [field, fieldCoverage(monthly, field)])
  ) as Record<string, number>;
  const minimumCoverage = Math.min(...ESSENTIAL_FIELDS.map((field) => coverage[field] || 0));
  addCheck(
    checks,
    "monthly-coverage",
    minimumCoverage >= 80 ? "pass" : "fail",
    "Cobertura dos campos mensais",
    minimumCoverage >= 80
      ? `A cobertura mínima dos campos essenciais é ${minimumCoverage}%.`
      : `A cobertura mínima é ${minimumCoverage}%, abaixo do limite de 80%.`,
    coverage
  );

  const conflictCount = monthly.reduce(
    (total, item) => total + (Array.isArray(item.conflicts) ? item.conflicts.length : 0),
    0
  );
  addCheck(
    checks,
    "monthly-conflicts",
    conflictCount === 0 ? "pass" : "fail",
    "Conflitos entre subtipos",
    conflictCount === 0
      ? "Nenhum valor conflitante foi encontrado entre geral, complemento e ativo/passivo."
      : `${conflictCount} conflitos precisam de revisão.`,
    { conflictCount }
  );

  const expectedMonthly = numeric(result.monthly?.snapshotsSaved ?? run.monthly?.snapshotsSaved);
  addCheck(
    checks,
    "monthly-count-match",
    expectedMonthly === null || expectedMonthly === monthly.length ? "pass" : "fail",
    "Contagem mensal consistente",
    expectedMonthly === null || expectedMonthly === monthly.length
      ? "A quantidade gravada corresponde ao resumo do workflow."
      : "A quantidade no staging difere do resumo do workflow.",
    { actual: monthly.length, expected: expectedMonthly }
  );

  const expectedDocuments = numeric(result.documents?.documentsSaved ?? run.documents?.documentsSaved);
  addCheck(
    checks,
    "documents",
    documents.length > 0 ? "pass" : "warn",
    "Documentos eventuais",
    documents.length > 0
      ? `${documents.length} documentos foram indexados.`
      : "Nenhum documento eventual foi indexado.",
    { actual: documents.length, expected: expectedDocuments }
  );

  const datasetUrls = documents.map((item) => item.source?.url).filter(Boolean);
  const documentUrls = documents.map((item) => item.documentUrl).filter(Boolean);
  const officialDatasetUrls = datasetUrls.filter(isOfficialSource).length;
  const officialDocumentUrls = documentUrls.filter(isOfficialSource).length;
  const officialSources = documents.length > 0
    && officialDatasetUrls === datasetUrls.length
    && officialDocumentUrls === documentUrls.length;
  addCheck(
    checks,
    "document-sources",
    officialSources ? "pass" : "warn",
    "Fontes dos documentos",
    officialSources
      ? "Todos os catálogos e links de documentos usam hosts oficiais aceitos."
      : "Nem todas as fontes puderam ser confirmadas como oficiais.",
    {
      datasetUrls: datasetUrls.length,
      officialDatasetUrls,
      documentUrls: documentUrls.length,
      officialDocumentUrls,
    }
  );

  const aiCoverage = Number(ai.sourceCoverage || 0);
  const aiReviewable = ai.status === "completed" && aiCoverage >= 50 && Boolean(aiExtraction);
  addCheck(
    checks,
    "ai-coverage",
    aiReviewable ? "pass" : "warn",
    "Cobertura documental da IA",
    aiReviewable
      ? `A IA utilizou ${aiCoverage}% dos documentos submetidos.`
      : `A análise documental é parcial: ${aiCoverage}% de cobertura.`,
    {
      status: ai.status || null,
      quality: ai.quality || null,
      documentsSubmitted: ai.documentsSubmitted || 0,
      sourceUrlsUsed: ai.sourceUrlsUsed || 0,
      sourceCoverage: aiCoverage,
      reason: ai.reason || null,
    }
  );

  const workflowReady = validation.readyForReview === true
    && (!Array.isArray(validation.blockingIssues) || validation.blockingIssues.length === 0);
  addCheck(
    checks,
    "workflow-validation",
    workflowReady ? "pass" : "fail",
    "Validação do workflow",
    workflowReady
      ? "O workflow marcou os dados como prontos para revisão humana."
      : "O workflow encontrou bloqueios de qualidade.",
    {
      readyForReview: validation.readyForReview ?? null,
      blockingIssues: validation.blockingIssues || [],
      warnings: validation.warnings || [],
      minimumCoverage: validation.minimumCoverage ?? null,
      conflictCount: validation.conflictCount ?? null,
      duplicateDates: validation.duplicateDates || [],
    }
  );

  const passCount = checks.filter((check) => check.level === "pass").length;
  const warnCount = checks.filter((check) => check.level === "warn").length;
  const failCount = checks.filter((check) => check.level === "fail").length;
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
    instruction: "Revise este QA do piloto TGAR11. Não autorize publicação automática. Informe se o próximo passo é corrigir, repetir a ingestão ou iniciar revisão humana.",
    verdict,
    score,
    runId: selectedRunId,
    parserVersion,
    counts: {
      monthly: monthly.length,
      documents: documents.length,
    },
    coverage,
    failures: checks.filter((check) => check.level === "fail"),
    warnings: checks.filter((check) => check.level === "warn"),
    samples: {
      monthly: sortedMonthly.slice(0, 3).map(monthlySample),
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
    parserVersion,
    verdict,
    score,
    canProceedToHumanReview: failCount === 0 && workflowReady,
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
    recommendations: buildRecommendations(checks),
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
    validation,
    officialBaseObservation: {
      documentExists: officialSnapshot.exists,
      code: officialSnapshot.data()?.code || officialSnapshot.id,
      updatedAt: toIso(officialSnapshot.data()?.updatedAt),
      note: "Esta API não altera Fiis/TGAR11 e não autoriza publicação automática.",
    },
    samples: {
      latestMonthlySnapshots: sortedMonthly.slice(0, 5).map(monthlySample),
      latestDocuments: sortedDocuments.slice(0, 5).map(documentSample),
    },
    aiReview: aiExtraction ? {
      summary: aiExtraction.summary || null,
      warnings: Array.isArray(aiExtraction.warnings) ? aiExtraction.warnings : [],
      risks: Array.isArray(aiExtraction.risks) ? aiExtraction.risks : [],
      sourceUrls: Array.isArray(aiExtraction.sourceUrls) ? aiExtraction.sourceUrls : [],
      sourceCoverage: aiCoverage,
    } : null,
    assistantReviewPayload,
  };

  if (persist) {
    await Promise.all([
      stagingRef.set({
        manualQa: report,
        manualQaUpdatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true }),
      runSnapshot.ref.set({
        manualQa: report,
        manualQaUpdatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true }),
    ]);
  }

  return { found: true as const, report, persisted: persist };
}

async function handle(req: NextRequest, body?: Record<string, any>) {
  if (!isAdminAuthorized(req, body)) {
    return jsonResponse({ ok: false, error: "Não autorizado." }, 401);
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
      return jsonResponse({ ok: false, error: result.error }, 404);
    }

    return jsonResponse({ ok: true, ...result });
  } catch (error: any) {
    return jsonResponse({
      ok: false,
      error: error?.message || "Erro ao validar o piloto.",
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
