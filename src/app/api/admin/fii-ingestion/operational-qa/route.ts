import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/adminSession";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import {
  isSupportedIngestionTicker,
  normalizeIngestionTicker,
  SUPPORTED_INGESTION_TICKERS,
} from "@/lib/fiiIngestionConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

type Level = "pass" | "warn" | "fail";
type Check = {
  id: string;
  level: Level;
  title: string;
  detail: string;
  evidence?: unknown;
};
type PlainDocument = Record<string, any> & { id: string };

function reply(payload: unknown, status = 200) {
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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coverage(items: PlainDocument[], field: string) {
  if (!items.length) return 0;
  const present = items.filter((item) => {
    const value = item[field];
    return value !== undefined && value !== null && value !== "";
  }).length;
  return Number(((present / items.length) * 100).toFixed(1));
}

function officialUrl(value: unknown) {
  try {
    const hostname = new URL(String(value || "")).hostname.toLowerCase();
    return OFFICIAL_SOURCE_HOSTS.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

function add(
  checks: Check[],
  id: string,
  level: Level,
  title: string,
  detail: string,
  evidence?: unknown
) {
  checks.push(evidence === undefined
    ? { id, level, title, detail }
    : { id, level, title, detail, evidence });
}

async function findRun(runId?: string, tickerValue?: string) {
  if (runId) {
    const snapshot = await adminDb.collection("FiiIngestionRuns").doc(runId).get();
    if (!snapshot.exists) return null;
    const ticker = normalizeIngestionTicker(snapshot.data()?.ticker);
    return isSupportedIngestionTicker(ticker) ? snapshot : null;
  }

  const ticker = normalizeIngestionTicker(tickerValue || "VGIA11");
  if (!isSupportedIngestionTicker(ticker)) return null;

  const snapshot = await adminDb
    .collection("FiiIngestionRuns")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  return snapshot.docs.find((doc) => {
    const data = doc.data() || {};
    return data.ticker === ticker && data.status === "completed";
  }) || snapshot.docs.find((doc) => (doc.data() || {}).ticker === ticker) || null;
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
    conflicts: Array.isArray(item.conflicts) ? item.conflicts : [],
  };
}

function documentSample(item: PlainDocument) {
  return {
    documentType: item.documentType || null,
    deliveryDate: item.deliveryDate || null,
    documentUrl: item.documentUrl || null,
    sourceUrl: item.source?.url || null,
  };
}

async function performQa(runId?: string, tickerValue?: string, persist = false) {
  const runSnapshot = await findRun(runId, tickerValue);
  if (!runSnapshot) {
    return {
      found: false as const,
      error: "Nenhuma execução operacional compatível foi encontrada.",
    };
  }

  const selectedRunId = runSnapshot.id;
  const run = (runSnapshot.data() || {}) as Record<string, any>;
  const result = (run.result || {}) as Record<string, any>;
  const ticker = normalizeIngestionTicker(run.ticker || result.ticker);
  if (!isSupportedIngestionTicker(ticker)) {
    return {
      found: false as const,
      error: "A execução não pertence a um ticker autorizado.",
    };
  }

  const stagingRef = adminDb.collection("FiiIngestionStaging").doc(selectedRunId);
  const [stagingSnapshot, monthlySnapshot, documentsSnapshot, officialSnapshot] = await Promise.all([
    stagingRef.get(),
    stagingRef.collection("MonthlySnapshots").limit(1000).get(),
    stagingRef.collection("Documents").limit(200).get(),
    adminDb.collection("Fiis").doc(ticker).get(),
  ]);

  const staging = (stagingSnapshot.data() || {}) as Record<string, any>;
  const validation = (staging.validation || result.validation || run.validation || {}) as Record<string, any>;
  const ai = (result.ai || run.ai || {}) as Record<string, any>;
  const monthly: PlainDocument[] = monthlySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...((doc.data() || {}) as Record<string, any>),
  }));
  const documents: PlainDocument[] = documentsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...((doc.data() || {}) as Record<string, any>),
  }));

  const cnpj = normalizeCnpj(run.cnpj || result.cnpj || staging.cnpj);
  const parserVersion = Number(run.parserVersion || result.parserVersion || validation.parserVersion || 1);
  const checks: Check[] = [];

  add(
    checks,
    "run-status",
    run.status === "completed" && run.currentStep === "completed" ? "pass" : "fail",
    "Execução concluída",
    run.status === "completed" && run.currentStep === "completed"
      ? "A execução operacional terminou corretamente."
      : `Estado atual: ${run.status || "ausente"}/${run.currentStep || "ausente"}.`,
    { status: run.status || null, currentStep: run.currentStep || null, error: run.error || null }
  );

  add(
    checks,
    "ticker-scope",
    isSupportedIngestionTicker(ticker) ? "pass" : "fail",
    "Ticker autorizado",
    `A execução está restrita a ${ticker}.`,
    { ticker, supportedTickers: SUPPORTED_INGESTION_TICKERS }
  );

  add(
    checks,
    "parser-version",
    parserVersion >= 2 ? "pass" : "fail",
    "Parser consolidado",
    parserVersion >= 2
      ? `A execução utilizou o parser v${parserVersion}.`
      : "A execução foi produzida pelo parser antigo.",
    { parserVersion }
  );

  const publicationBlocked = run.publishToOfficialBase === false
    && validation.publishToOfficialBase === false;
  add(
    checks,
    "publication-safety",
    publicationBlocked ? "pass" : "fail",
    "Base oficial protegida",
    publicationBlocked
      ? `A execução não publicou em Fiis/${ticker}.`
      : "Não foi possível comprovar o bloqueio da publicação.",
    {
      run: run.publishToOfficialBase ?? null,
      validation: validation.publishToOfficialBase ?? null,
    }
  );

  add(
    checks,
    "staging-root",
    stagingSnapshot.exists ? "pass" : "fail",
    "Staging disponível",
    stagingSnapshot.exists
      ? "O documento raiz da execução existe."
      : "O documento raiz de staging não foi encontrado."
  );

  add(
    checks,
    "cnpj",
    cnpj ? "pass" : "fail",
    "CNPJ resolvido",
    cnpj ? `CNPJ válido: ${cnpj}.` : "O CNPJ está ausente ou inválido."
  );

  const cnpjMismatch = monthly.filter((item) => cnpj && normalizeCnpj(item.cnpj) !== cnpj).length;
  add(
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
  add(
    checks,
    "monthly-uniqueness",
    monthly.length > 0 && duplicateDates.length === 0 ? "pass" : "fail",
    "Uma linha por competência",
    monthly.length === 0
      ? "Nenhuma competência mensal foi encontrada."
      : duplicateDates.length
        ? "Existem competências duplicadas."
        : `${monthly.length} competências únicas foram encontradas.`,
    { monthlySnapshots: monthly.length, duplicateDates }
  );

  const fieldCoverage = Object.fromEntries(
    ESSENTIAL_FIELDS.map((field) => [field, coverage(monthly, field)])
  ) as Record<string, number>;
  const minimumCoverage = Math.min(...ESSENTIAL_FIELDS.map((field) => fieldCoverage[field] || 0));
  add(
    checks,
    "monthly-coverage",
    minimumCoverage >= 80 ? "pass" : "fail",
    "Cobertura dos campos essenciais",
    minimumCoverage >= 80
      ? `A cobertura mínima é ${minimumCoverage}%.`
      : `A cobertura mínima é ${minimumCoverage}%, abaixo de 80%.`,
    fieldCoverage
  );

  const conflictCount = monthly.reduce(
    (total, item) => total + (Array.isArray(item.conflicts) ? item.conflicts.length : 0),
    0
  );
  add(
    checks,
    "monthly-conflicts",
    conflictCount === 0 ? "pass" : "fail",
    "Conflitos entre subtipos",
    conflictCount === 0
      ? "Nenhum conflito mensal foi encontrado."
      : `${conflictCount} conflitos precisam de revisão.`,
    { conflictCount }
  );

  const expectedMonthly = numeric(result.monthly?.snapshotsSaved ?? run.monthly?.snapshotsSaved);
  add(
    checks,
    "monthly-count-match",
    expectedMonthly === null || expectedMonthly === monthly.length ? "pass" : "fail",
    "Contagem mensal consistente",
    expectedMonthly === null || expectedMonthly === monthly.length
      ? "A quantidade gravada corresponde ao workflow."
      : "A quantidade gravada diverge do workflow.",
    { actual: monthly.length, expected: expectedMonthly }
  );

  const expectedDocuments = numeric(result.documents?.documentsSaved ?? run.documents?.documentsSaved);
  add(
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
  const officialDatasets = datasetUrls.filter(officialUrl).length;
  const officialDocuments = documentUrls.filter(officialUrl).length;
  const sourcesOk = documents.length > 0
    && officialDatasets === datasetUrls.length
    && officialDocuments === documentUrls.length;
  add(
    checks,
    "document-sources",
    sourcesOk ? "pass" : "warn",
    "Fontes oficiais",
    sourcesOk
      ? "Todos os catálogos e documentos usam hosts oficiais."
      : "Nem todas as fontes puderam ser confirmadas.",
    {
      datasetUrls: datasetUrls.length,
      officialDatasets,
      documentUrls: documentUrls.length,
      officialDocuments,
    }
  );

  const aiDisabled = ai.enabled === false || ai.status === "disabled" || run.enableAi === false;
  const aiCoverage = Number(ai.sourceCoverage || 0);
  if (aiDisabled) {
    add(
      checks,
      "ai-mode",
      "pass",
      "IA opcional desativada",
      "O modo operacional executou somente a coleta oficial estruturada, sem consumir créditos da OpenAI.",
      { enableAi: false, status: ai.status || "disabled" }
    );
  } else {
    const aiReviewable = ai.status === "completed" && aiCoverage >= 50;
    add(
      checks,
      "ai-mode",
      aiReviewable ? "pass" : "warn",
      "Enriquecimento documental por IA",
      aiReviewable
        ? `A IA utilizou ${aiCoverage}% dos documentos submetidos.`
        : `A análise documental ficou parcial em ${aiCoverage}%.`,
      {
        status: ai.status || null,
        errorCode: ai.errorCode || null,
        reason: ai.reason || null,
        sourceCoverage: aiCoverage,
      }
    );
  }

  const workflowReady = validation.readyForReview === true
    && (!Array.isArray(validation.blockingIssues) || validation.blockingIssues.length === 0);
  add(
    checks,
    "workflow-validation",
    workflowReady ? "pass" : "fail",
    "Validação do workflow",
    workflowReady
      ? "Os dados estão prontos para revisão humana."
      : "O workflow encontrou bloqueios de qualidade.",
    {
      readyForReview: validation.readyForReview ?? null,
      blockingIssues: validation.blockingIssues || [],
      warnings: validation.warnings || [],
    }
  );

  const pass = checks.filter((check) => check.level === "pass").length;
  const warn = checks.filter((check) => check.level === "warn").length;
  const fail = checks.filter((check) => check.level === "fail").length;
  const score = Math.max(0, Math.min(100, 100 - fail * 25 - warn * 6));
  const verdict = fail > 0
    ? "failed"
    : warn > 0
      ? "approved_with_warnings"
      : "approved_for_human_review";

  const sortedMonthly = [...monthly].sort((left, right) =>
    String(right.referenceDate || "").localeCompare(String(left.referenceDate || ""))
  );
  const sortedDocuments = [...documents].sort((left, right) =>
    String(right.deliveryDate || right.referenceDate || "")
      .localeCompare(String(left.deliveryDate || left.referenceDate || ""))
  );

  const report = {
    generatedAt: new Date().toISOString(),
    runId: selectedRunId,
    ticker,
    cnpj: cnpj || null,
    year: run.year || result.year || null,
    parserVersion,
    mode: run.mode || "operational_staging",
    verdict,
    score,
    canProceedToHumanReview: fail === 0 && workflowReady,
    canPublishToOfficialBase: false,
    publicationDecision: "blocked_pending_human_review",
    summary: { pass, warn, fail },
    counts: {
      monthlySnapshots: monthly.length,
      expectedMonthlySnapshots: expectedMonthly,
      documents: documents.length,
      expectedDocuments,
    },
    coverage: fieldCoverage,
    checks,
    recommendations: fail > 0
      ? ["Corrigir os checks com falha e repetir somente esta execução em staging."]
      : ["Prosseguir para revisão humana. A publicação oficial continua bloqueada."],
    run: {
      status: run.status || null,
      currentStep: run.currentStep || null,
      enableAi: run.enableAi === true,
      requestedAt: toIso(run.requestedAt),
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
      note: `Esta API não altera Fiis/${ticker}.`,
    },
    samples: {
      latestMonthlySnapshots: sortedMonthly.slice(0, 6).map(monthlySample),
      latestDocuments: sortedDocuments.slice(0, 5).map(documentSample),
    },
    assistantReviewPayload: {
      instruction: `Revise o QA operacional de ${ticker}. Não autorize publicação automática.`,
      verdict,
      score,
      runId: selectedRunId,
      ticker,
      parserVersion,
      counts: { monthly: monthly.length, documents: documents.length },
      coverage: fieldCoverage,
      failures: checks.filter((check) => check.level === "fail"),
      warnings: checks.filter((check) => check.level === "warn"),
      samples: {
        monthly: sortedMonthly.slice(0, 3).map(monthlySample),
        documents: sortedDocuments.slice(0, 3).map(documentSample),
      },
    },
  };

  if (persist) {
    await Promise.all([
      stagingRef.set({
        manualQa: report,
        operationalQaUpdatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true }),
      runSnapshot.ref.set({
        manualQa: report,
        operationalQaUpdatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: true }),
    ]);
  }

  return { found: true as const, report, persisted: persist };
}

async function handle(req: NextRequest, body?: Record<string, any>) {
  if (!isAdminAuthorized(req, body)) {
    return reply({ ok: false, error: "Não autorizado." }, 401);
  }

  try {
    const runId = String(body?.runId || req.nextUrl.searchParams.get("runId") || "").trim();
    const ticker = String(body?.ticker || req.nextUrl.searchParams.get("ticker") || "VGIA11").trim();
    const normalizedTicker = normalizeIngestionTicker(ticker);
    if (!runId && !isSupportedIngestionTicker(normalizedTicker)) {
      return reply({
        ok: false,
        error: "Ticker não autorizado para QA operacional.",
        supportedTickers: SUPPORTED_INGESTION_TICKERS,
      }, 400);
    }

    const persistValue = body?.persist ?? req.nextUrl.searchParams.get("persist");
    const persist = persistValue === true
      || persistValue === 1
      || persistValue === "1"
      || persistValue === "true";
    const result = await performQa(runId || undefined, normalizedTicker || undefined, persist);

    if (!result.found) {
      return reply({ ok: false, error: result.error }, 404);
    }

    return reply({ ok: true, ...result });
  } catch (error: any) {
    return reply({
      ok: false,
      error: error?.message || "Erro ao validar execução operacional.",
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
