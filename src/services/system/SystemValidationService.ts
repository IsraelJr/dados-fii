import { randomUUID } from "crypto";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { listIngestionAdapters } from "@/lib/fiiIngestionAdapters";
import { regulatoryDataService } from "@/services/regulatory";
import { calculateRegulatoryScores } from "@/services/score";

export type SystemValidationLevel = "pass" | "warn" | "fail";

export type SystemValidationCheck = {
  id: string;
  title: string;
  level: SystemValidationLevel;
  weight: number;
  detail: string;
  evidence?: Record<string, unknown>;
};

export type SystemValidationReport = {
  runId: string;
  version: "system-validation-v1";
  generatedAt: string;
  requestedBy: string;
  status: "healthy" | "attention" | "degraded";
  score: number;
  summary: { pass: number; warn: number; fail: number };
  checks: SystemValidationCheck[];
  recommendations: string[];
  persisted: boolean;
};

function trueEnv(name: string) {
  return String(process.env[name] || "").trim().toLowerCase() === "true";
}

function check(
  id: string,
  title: string,
  level: SystemValidationLevel,
  weight: number,
  detail: string,
  evidence?: Record<string, unknown>
): SystemValidationCheck {
  return { id, title, level, weight, detail, evidence };
}

function calculateScore(checks: SystemValidationCheck[]) {
  const totalWeight = checks.reduce((total, item) => total + item.weight, 0);
  if (!totalWeight) return 0;
  const earned = checks.reduce((total, item) => {
    if (item.level === "pass") return total + item.weight;
    if (item.level === "warn") return total + item.weight * 0.5;
    return total;
  }, 0);
  return Math.round((earned / totalWeight) * 100);
}

function reportStatus(score: number, checks: SystemValidationCheck[]) {
  if (checks.some((item) => item.level === "fail") || score < 70) return "degraded" as const;
  if (checks.some((item) => item.level === "warn") || score < 90) return "attention" as const;
  return "healthy" as const;
}

async function validatePublishedRegulatoryData() {
  const candidates = ["KNCA11", "MXRF11", "VGIA11", "TGAR11"];
  const results = [] as Array<{ ticker: string; found: boolean; reportAvailable: boolean; reason: string | null }>;

  for (const ticker of candidates) {
    const result = await regulatoryDataService.getReportInput(ticker, { bypassCache: true });
    results.push({
      ticker: result.ticker,
      found: result.found,
      reportAvailable: result.reportAvailable,
      reason: result.reason,
    });
  }

  return results;
}

export async function runSystemValidation(input: {
  requestedBy: string;
  persist?: boolean;
}): Promise<SystemValidationReport> {
  const generatedAt = new Date().toISOString();
  const runId = randomUUID();
  const checks: SystemValidationCheck[] = [];

  const hasSessionSecret = Boolean(String(process.env.ADMIN_SESSION_SECRET || "").trim());
  checks.push(check(
    "admin-session-secret",
    "Segredo de sessão independente",
    hasSessionSecret ? "pass" : "fail",
    15,
    hasSessionSecret
      ? "ADMIN_SESSION_SECRET está configurado sem expor seu valor."
      : "ADMIN_SESSION_SECRET não está configurado.",
    { configured: hasSessionSecret }
  ));

  const publicationEnabled = trueEnv("FII_INGESTION_PUBLICATION_ENABLED");
  checks.push(check(
    "publication-gate",
    "Publicação protegida",
    publicationEnabled ? "warn" : "pass",
    15,
    publicationEnabled
      ? "A janela de publicação está habilitada neste ambiente e deve ser encerrada após o uso."
      : "A escrita oficial permanece desabilitada.",
    { enabled: publicationEnabled }
  ));

  const rollbackEnabled = trueEnv("FII_INGESTION_ROLLBACK_ENABLED");
  checks.push(check(
    "rollback-gate",
    "Rollback protegido",
    rollbackEnabled ? "warn" : "pass",
    10,
    rollbackEnabled
      ? "A janela de rollback está habilitada neste ambiente."
      : "O rollback permanece desabilitado.",
    { enabled: rollbackEnabled }
  ));

  const legacyEnabled = trueEnv("ADMIN_LEGACY_SECRET_ENABLED");
  checks.push(check(
    "legacy-admin",
    "Autenticação administrativa legada",
    legacyEnabled ? "warn" : "pass",
    10,
    legacyEnabled
      ? "O modo legado está habilitado e deve permanecer restrito a rotas de leitura."
      : "O modo legado está desabilitado.",
    { enabled: legacyEnabled }
  ));

  const adapters = listIngestionAdapters();
  const adaptersValid = adapters.length >= 2
    && adapters.every((adapter) => adapter.parserVersion >= 2 && adapter.capabilities.monthlyData);
  checks.push(check(
    "adapter-contracts",
    "Contratos dos adaptadores",
    adaptersValid ? "pass" : "fail",
    15,
    adaptersValid
      ? `${adapters.length} adaptadores regulatórios registrados com parser consolidado.`
      : "A lista de adaptadores não atende ao contrato mínimo.",
    { adapters }
  ));

  const scoreProbe = calculateRegulatoryScores({
    historyLength: 0,
    coverage: 100,
    conflictCount: 0,
    qaScore: 100,
    documentsCount: 0,
    documentTypesCount: 0,
    netWorthChangePct: null,
    shareholdersChangePct: null,
    vpCotaChangePct: null,
    delinquentValue: null,
  });
  const scoreEngineValid = scoreProbe.version === "regulatory-score-engine-v1"
    && scoreProbe.scores.dataQuality === 100
    && scoreProbe.scores.growth === null
    && scoreProbe.scores.liquidity === null
    && scoreProbe.unavailableDimensions.includes("growth")
    && scoreProbe.unavailableDimensions.includes("liquidity");
  checks.push(check(
    "score-engine-contract",
    "Contrato do Score Engine",
    scoreEngineValid ? "pass" : "fail",
    10,
    scoreEngineValid
      ? "O motor de scores preserva metodologia versionada e não estima dimensões sem dados."
      : "O motor de scores não atende ao contrato determinístico esperado.",
    {
      version: scoreProbe.version,
      methodologyVersion: scoreProbe.methodologyVersion,
      unavailableDimensions: scoreProbe.unavailableDimensions,
    }
  ));

  try {
    const regulatoryResults = await validatePublishedRegulatoryData();
    const published = regulatoryResults.filter((item) => item.reportAvailable);
    checks.push(check(
      "regulatory-repository",
      "Leitura da base regulatória",
      "pass",
      20,
      "A coleção oficial pôde ser consultada pelo RegulatoryDataService.",
      { checkedTickers: regulatoryResults.map((item) => item.ticker) }
    ));
    checks.push(check(
      "published-regulatory-data",
      "Dados publicados disponíveis",
      published.length >= 2 ? "pass" : published.length === 1 ? "warn" : "fail",
      15,
      published.length
        ? `${published.length} fundos de referência possuem relatório publicado e válido.`
        : "Nenhum fundo de referência possui dados regulatórios publicados válidos.",
      { results: regulatoryResults }
    ));
  } catch (error: any) {
    checks.push(check(
      "regulatory-repository",
      "Leitura da base regulatória",
      "fail",
      20,
      error?.message || "Falha ao consultar a base regulatória.",
    ));
    checks.push(check(
      "published-regulatory-data",
      "Dados publicados disponíveis",
      "fail",
      15,
      "A disponibilidade dos dados publicados não pôde ser confirmada.",
    ));
  }

  const score = calculateScore(checks);
  const summary = {
    pass: checks.filter((item) => item.level === "pass").length,
    warn: checks.filter((item) => item.level === "warn").length,
    fail: checks.filter((item) => item.level === "fail").length,
  };
  const status = reportStatus(score, checks);
  const recommendations = checks
    .filter((item) => item.level !== "pass")
    .map((item) => item.detail);
  const persist = input.persist !== false;
  const report: SystemValidationReport = {
    runId,
    version: "system-validation-v1",
    generatedAt,
    requestedBy: input.requestedBy,
    status,
    score,
    summary,
    checks,
    recommendations,
    persisted: persist,
  };

  if (persist) {
    await adminDb.collection("SystemValidationRuns").doc(runId).set({
      ...report,
      persistedAt: adminFieldValue.serverTimestamp(),
    }, { merge: false });
  }

  return report;
}

export async function getSystemValidationHistory(limitValue = 20) {
  const limit = Math.min(Math.max(Math.floor(limitValue), 1), 50);
  const snapshot = await adminDb.collection("SystemValidationRuns")
    .orderBy("generatedAt", "desc")
    .limit(limit)
    .get();
  return snapshot.docs.map((document) => ({ id: document.id, ...(document.data() || {}) }));
}

export async function getLatestSystemValidation() {
  const history = await getSystemValidationHistory(1);
  return history[0] || null;
}
