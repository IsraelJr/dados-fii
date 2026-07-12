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

function toIso(value: any) {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serializeValue(value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
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

function coverage(items: Record<string, any>[], field: string) {
  if (!items.length) return 0;
  const present = items.filter((item) => item[field] !== undefined && item[field] !== null && item[field] !== "").length;
  return Number(((present / items.length) * 100).toFixed(1));
}

function percentage(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function validDate(value: unknown) {
  if (!value) return false;
  const date = new Date(String(value));
  return !Number.isNaN(date.getTime());
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
  return Boolean(hostname && OFFICIAL_SOURCE_HOSTS.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)));
}

function sampleSnapshot(data: Record<string, any>) {
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

function sampleDocument(data: Record<string, any>) {
  return {
    documentType: data.documentType || null,
    documentName: data.documentName || null,
    referenceDate: data.referenceDate || null,
    deliveryDate: data.deliveryDate || null,
    documentUrl: data.documentUrl || null,
    sourceUrl: data.source?.url || null,
  };
}

function addCheck(checks: QaCheck[], check: QaCheck) {
  checks.push(check);
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
  const recommendations: string[] = [];
  const failed = checks.filter((check) => check.level === "fail");
  const warnings = checks.filter((check) => check.level === "warn");

  if (failed.length) recommendations.push("Não publicar dados. Corrigir todas as verificações com nível fail e executar novamente o QA.");
  if (warnings.some((check) => check.id === "monthly-coverage")) recommendations.push("Revisar o mapeamento dos campos do informe mensal da CVM para elevar a cobertura.");
  if (warnings.some((check) => check.id === "documents" || check.id === "document-sources")) recommendations.push("Revisar o catálogo de documentos eventuais e os links oficiais retornados pela CVM.");
  if (warnings.some((check) => check.id === "ai-extraction")) recommendations.push("Revisar a configuração da OpenAI e a disponibilidade de documentos oficiais antes de confiar na extração por IA.");
  if (!failed.length) recommendations.push("Fazer revisão humana dos valores e fontes antes de criar qualquer rotina de publicação na coleção oficial.");
  return recommendations;
}

async function runQa(runId?: string, persist = false) {
  const runSnapshot = await findRun(runId);
  if (!runSnapshot) {
    return { found: false as const, error: "Nenhuma execução TGAR11 encontrada." };
  }

  const selectedRunId = runSnapshot.id;
  const run = runSnapshot.data() || {};
  const stagingRef = adminDb.collection("FiiIngestionStaging").doc(selectedRunId);
  const [stagingSnapshot, monthlySnapshot, documentsSnapshot, officialSnapshot] = await Promise.all([
    stagingRef.get(),
    stagingRef.collection("MonthlySnapshots").limit(1000).get(),
    stagingRef.collection("Documents").limit(200).get(),
    adminDb.collection("Fiis").doc(PILOT_TICKER).get(),
  ]);

  const staging = stagingSnapshot.data() || {};
  const monthly = monthlySnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const documents = documentsSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const result = run.result || {};
  const validation = staging.validation || result.validation || run.validation || {};
  const ai = result.ai || run.ai || {};
  const aiExtraction = staging.aiExtraction || ai.extraction || null;
  const expectedCnpj = normalizeCnpj(run.cnpj || result.cnpj || staging.cnpj);
  const expectedMonthly = numeric(result.monthly?.snapshotsSaved ?? run.monthly?.snapshotsSaved);
  const expectedDocuments = numeric(result.documents?.documentsSaved ?? run.documents?.documentsSaved);
  const checks: QaCheck[] = [];

  addCheck(checks, {
    id: "run-status",
    level: run.status === "completed" && run.currentStep === "completed" ? "pass" : "fail",
    title: "Execução concluída",
    detail: run.status === "completed" ? "A execução terminou com status completed." : `Status atual: ${run.status || "ausente"}.`,
    evidence: { status: run.status || null, currentStep: run.currentStep || null, error: run.error || null },
  });

  addCheck(checks, {
    id: "ticker-scope",
    level: run.ticker === PILOT_TICKER ? "pass" : "fail",
    title: "Escopo restrito ao TGAR11",
    detail: run.ticker === PILOT_TICKER ? "O piloto permaneceu restrito ao ticker autorizado." : `Ticker inesperado: ${run.ticker || "ausente"}.`,
    evidence: { ticker: run.ticker || null },
  });

  const publicationFlags = [run.publishToOfficialBase, validation.publishToOfficialBase].filter((value) => value !== undefined);
  const publicationBlocked = publicationFlags.length > 0 && publicationFlags.every((value) => value === false);
  addCheck(checks, {
    id: "publication-safety",
    level: publicationBlocked ? "pass" : "fail",
    title: "Proteção da base oficial",
    detail: publicationBlocked ? "Os indicadores confirmam que a execução não publica na coleção oficial." : "Não foi possível confirmar publishToOfficialBase=false em todos os resultados disponíveis.",
    evidence: { run: run.publishToOfficialBase ?? null, validation: validation.publishToOfficialBase ?? null },
  });

  addCheck(checks, {
    id: "staging-root",
    level: stagingSnapshot.exists ? "pass" : "fail",
    title: "Documento de staging",
    detail: stagingSnapshot.exists ? "O documento raiz da execução existe em FiiIngestionStaging." : "O documento raiz de staging não foi encontrado.",
  });

  addCheck(checks, {
    id: "cnpj",
    level: expectedCnpj ? "pass" : "fail",
    title: "CNPJ resolvido",
    detail: expectedCnpj ? `CNPJ válido com 14 dígitos: ${expectedCnpj}.` : "O CNPJ da execução está ausente ou inválido.",
  });

  const mismatchedMonthlyCnpj = expectedCnpj
    ? monthly.filter((item) => normalizeCnpj(item.cnpj) && normalizeCnpj(item.cnpj) !== expectedCnpj).length
    : monthly.length;
  const mismatchedDocumentCnpj = expectedCnpj
    ? documents.filter((item) => normalizeCnpj(item.cnpj) && normalizeCnpj(item.cnpj) !== expectedCnpj).length
    : documents.length;
  addCheck(checks, {
    id: "cnpj-consistency",
    level: mismatchedMonthlyCnpj === 0 && mismatchedDocumentCnpj === 0 ? "pass" : "fail",
    title: "Consistência do CNPJ",
    detail: mismatchedMonthlyCnpj === 0 && mismatchedDocumentCnpj === 0
      ? "Nenhum registro de staging apresenta CNPJ divergente."
      : "Foram encontrados registros associados a outro CNPJ.",
    evidence: { mismatchedMonthlyCnpj, mismatchedDocumentCnpj },
  });

  addCheck(checks, {
    id: "monthly-count",
    level: monthly.length > 0 ? "pass" : "fail",
    title: "Informes mensais encontrados",
    detail: monthly.length > 0 ? `${monthly.length} snapshots mensais foram encontrados.` : "Nenhum snapshot mensal foi encontrado.",
    evidence: { actual: monthly.length, expected: expectedMonthly },
  });

  if (expectedMonthly !== null) {
    addCheck(checks, {
      id: "monthly-count-match",
      level: monthly.length === expectedMonthly ? "pass" : "warn",
      title: "Contagem mensal consistente",
      detail: monthly.length === expectedMonthly
        ? "A quantidade gravada corresponde ao resumo da execução."
        : "A quantidade atual no staging difere do resumo retornado pelo workflow.",
      evidence: { actual: monthly.length, expected: expectedMonthly },
    });
  }

  const monthlyCoverage = {
    referenceDate: coverage(monthly, "referenceDate"),
    netWorth: coverage(monthly, "netWorth"),
    sharesOutstanding: coverage(monthly, "sharesOutstanding"),
    numberShareholders: coverage(monthly, "numberShareholders"),
    vpCota: coverage(monthly, "vpCota"),
  };
  const essentialCoverage = [monthlyCoverage.referenceDate, monthlyCoverage.netWorth, monthlyCoverage.sharesOutstanding, monthlyCoverage.vpCota];
  const minimumEssentialCoverage = essentialCoverage.length ? Math.min(...essentialCoverage) : 0;
  addCheck(checks, {
    id: "monthly-coverage",
    level: minimumEssentialCoverage >= 80 ? "pass" : minimumEssentialCoverage > 0 ? "warn" : "fail",
    title: "Cobertura dos campos mensais",
    detail: minimumEssentialCoverage >= 80
      ? "Os campos essenciais possuem cobertura igual ou superior a 80%."
      : `A menor cobertura entre os campos essenciais é ${minimumEssentialCoverage}%.`,
    evidence: monthlyCoverage,
  });

  const datedRows = monthly.filter((item) => item.referenceDate);
  const invalidDates = datedRows.filter((item) => !validDate(item.referenceDate)).length;
  const dateFrequency = new Map<string, number>();
  datedRows.forEach((item) => {
    const key = String(item.referenceDate);
    dateFrequency.set(key, (dateFrequency.get(key) || 0) + 1);
  });
  const duplicateReferenceDates = [...dateFrequency.entries()].filter(([, count]) => count > 1).map(([date, count]) => ({ date, count }));
  addCheck(checks, {
    id: "monthly-dates",
    level: invalidDates === 0 && monthlyCoverage.referenceDate >= 80 ? "pass" : invalidDates < datedRows.length ? "warn" : "fail",
    title: "Datas de referência",
    detail: invalidDates === 0 ? "As datas preenchidas são interpretáveis." : `${invalidDates} datas não puderam ser interpretadas.`,
    evidence: { invalidDates, datedRows: datedRows.length, duplicateReferenceDates: duplicateReferenceDates.slice(0, 20) },
  });

  const positiveNetWorth = monthly.filter((item) => numeric(item.netWorth) !== null && Number(item.netWorth) > 0).length;
  const positiveShares = monthly.filter((item) => numeric(item.sharesOutstanding) !== null && Number(item.sharesOutstanding) > 0).length;
  const positiveVp = monthly.filter((item) => numeric(item.vpCota) !== null && Number(item.vpCota) > 0).length;
  const plausibleRatio = Math.min(
    percentage(positiveNetWorth, monthly.length),
    percentage(positiveShares, monthly.length),
    percentage(positiveVp, monthly.length)
  );
  addCheck(checks, {
    id: "monthly-values",
    level: plausibleRatio >= 80 ? "pass" : plausibleRatio > 0 ? "warn" : "fail",
    title: "Plausibilidade dos valores mensais",
    detail: plausibleRatio >= 80
      ? "A maioria dos registros possui patrimônio, cotas e VP/cota positivos."
      : `A menor taxa de valores positivos entre patrimônio, cotas e VP/cota é ${plausibleRatio}%.`,
    evidence: { positiveNetWorth, positiveShares, positiveVp, total: monthly.length },
  });

  addCheck(checks, {
    id: "documents",
    level: documents.length > 0 ? "pass" : "warn",
    title: "Documentos eventuais",
    detail: documents.length > 0 ? `${documents.length} documentos foram indexados.` : "Nenhum documento eventual foi indexado.",
    evidence: { actual: documents.length, expected: expectedDocuments },
  });

  if (expectedDocuments !== null) {
    addCheck(checks, {
      id: "document-count-match",
      level: documents.length === expectedDocuments ? "pass" : "warn",
      title: "Contagem de documentos consistente",
      detail: documents.length === expectedDocuments
        ? "A quantidade gravada corresponde ao resumo da execução."
        : "A quantidade atual de documentos difere do resumo do workflow.",
      evidence: { actual: documents.length, expected: expectedDocuments },
    });
  }

  const documentSourceUrls = documents.map((item) => item.source?.url).filter(Boolean);
  const officialDatasetSources = documentSourceUrls.filter(isOfficialSource).length;
  const documentUrls = documents.map((item) => item.documentUrl).filter(Boolean);
  const officialDocumentUrls = documentUrls.filter(isOfficialSource).length;
  addCheck(checks, {
    id: "document-sources",
    level: documents.length === 0
      ? "warn"
      : officialDatasetSources === documentSourceUrls.length && (documentUrls.length === 0 || officialDocumentUrls === documentUrls.length)
        ? "pass"
        : "warn",
    title: "Fontes dos documentos",
    detail: documents.length === 0
      ? "Sem documentos para validar as fontes."
      : "Foram verificadas as origens dos catálogos e links de documentos.",
    evidence: {
      datasetSources: documentSourceUrls.length,
      officialDatasetSources,
      documentUrls: documentUrls.length,
      officialDocumentUrls,
      acceptedHosts: OFFICIAL_SOURCE_HOSTS,
    },
  });

  const aiCompleted = ai.status === "completed" && Boolean(aiExtraction);
  addCheck(checks, {
    id: "ai-extraction",
    level: aiCompleted ? "pass" : documents.length > 0 ? "warn" : "warn",
    title: "Extração por IA",
    detail: aiCompleted
      ? "A extração por IA terminou e o conteúdo foi armazenado no staging."
      : `Extração por IA não concluída ou não armazenada: ${ai.reason || ai.status || "estado desconhecido"}.`,
    evidence: { status: ai.status || null, reason: ai.reason || null, hasExtraction: Boolean(aiExtraction) },
  });

  addCheck(checks, {
    id: "workflow-validation",
    level: validation.readyForReview === true ? "pass" : "warn",
    title: "Validação do workflow",
    detail: validation.readyForReview === true
      ? "O workflow marcou os dados como prontos para revisão humana."
      : "O workflow não marcou os dados como prontos para revisão humana.",
    evidence: serializeValue(validation),
  });

  const failCount = checks.filter((check) => check.level === "fail").length;
  const warnCount = checks.filter((check) => check.level === "warn").length;
  const passCount = checks.filter((check) => check.level === "pass").length;
  const score = Math.max(0, Math.min(100, 100 - failCount * 25 - warnCount * 6));
  const verdict = failCount > 0 ? "failed" : warnCount > 0 ? "approved_with_warnings" : "approved_for_human_review";
  const recommendations = buildRecommendations(checks);
  const sortedMonthly = [...monthly].sort((left, right) => String(right.referenceDate || "").localeCompare(String(left.referenceDate || "")));
  const sortedDocuments = [...documents].sort((left, right) => String(right.deliveryDate || right.referenceDate || "").localeCompare(String(left.deliveryDate || left.referenceDate || "")));

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
    coverage: monthlyCoverage,
    checks,
    recommendations,
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
      note: "Esta API não altera Fiis/TGAR11 e não afirma ausência de alterações externas concorrentes; ela valida os indicadores de não publicação do piloto.",
    },
    samples: {
      latestMonthlySnapshots: sortedMonthly.slice(0, 5).map(sampleSnapshot),
      latestDocuments: sortedDocuments.slice(0, 5).map(sampleDocument),
    },
    aiReview: aiExtraction ? {
      summary: aiExtraction.summary || null,
      warnings: Array.isArray(aiExtraction.warnings) ? aiExtraction.warnings : [],
      risks: Array.isArray(aiExtraction.risks) ? aiExtraction.risks : [],
      sourceUrls: Array.isArray(aiExtraction.sourceUrls) ? aiExtraction.sourceUrls : [],
      extraction: serializeValue(aiExtraction),
    } : null,
    assistantReviewPayload: {
      instruction: "Revise este QA do piloto TGAR11. Identifique inconsistências, riscos de qualidade, campos ausentes e diga se o próximo passo deve ser corrigir, repetir a ingestão ou iniciar revisão humana. Não autorize publicação automática.",
      verdict,
      score,
      runId: selectedRunId,
      counts: { monthly: monthly.length, documents: documents.length },
      coverage: monthlyCoverage,
      failures: checks.filter((check) => check.level === "fail"),
      warnings: checks.filter((check) => check.level === "warn"),
      samples: {
        monthly: sortedMonthly.slice(0, 3).map(sampleSnapshot),
        documents: sortedDocuments.slice(0, 3).map(sampleDocument),
      },
      aiSummary: aiExtraction ? {
        summary: aiExtraction.summary || null,
        warnings: aiExtraction.warnings || [],
        risks: aiExtraction.risks || [],
        sourceUrls: aiExtraction.sourceUrls || [],
      } : null,
    },
  };

  if (persist) {
    await Promise.all([
      stagingRef.set({ manualQa: report, manualQaUpdatedAt: adminFieldValue.serverTimestamp() }, { merge: true }),
      runSnapshot.ref.set({ manualQa: report, manualQaUpdatedAt: adminFieldValue.serverTimestamp() }, { merge: true }),
    ]);
  }

  return { found: true as const, report, persisted: persist };
}

async function handle(req: NextRequest, body?: any) {
  if (!isAdminAuthorized(req, body)) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  try {
    const runId = String(body?.runId || req.nextUrl.searchParams.get("runId") || "").trim();
    const persistParam = body?.persist ?? req.nextUrl.searchParams.get("persist");
    const persist = persistParam === true || persistParam === 1 || persistParam === "1" || persistParam === "true";
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
  const body = await req.json().catch(() => ({}));
  return handle(req, body);
}
