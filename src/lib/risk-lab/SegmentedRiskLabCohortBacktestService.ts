import { createHash, randomUUID } from "node:crypto";
import cohortRaw from "@/lib/risk-lab/out-of-sample-cohort-v0.1.json";
import { ConcurrentAutomaticDividendSeriesService } from "@/lib/risk-lab/ConcurrentAutomaticDividendSeriesService";
import { PILOT_RISK_RULES } from "@/lib/risk-lab/rules";
import {
  RISK_LAB_COHORT_BACKTEST_RUN_ID,
  RiskLabCohortBacktestV2Service,
} from "@/lib/risk-lab/RiskLabCohortBacktestV2Service";
import {
  riskLabCohortBacktestStore,
  type RiskLabCohortBacktestStore,
} from "@/lib/risk-lab/RiskLabCohortBacktestStore";
import { loadOutOfSampleCohort } from "@/lib/risk-lab/ValidationCohortLoader";
import type {
  CohortBacktestCaseResult,
  CohortBacktestCheck,
  CohortBacktestMetrics,
  CohortBacktestOutcome,
  CohortStructuredBlocker,
  PublicRiskLabCohortBacktestEvidence,
  RiskLabCohortBacktestEvidence,
} from "@/types/riskLabCohortBacktest";
import type { OutOfSampleValidationCase } from "@/types/riskLabValidation";

const SUPERSEDED_RUN_ID = "risk-lab-3-5-20260720-v1";
const EXPECTED_COHORT_HASH = "620c26abbf30b4f96ef3de9dbfd8eb6c7b9e6d1fe56851d70079d39d0f490fd1";
const METHODOLOGY_VERSION = "2.0.0" as const;

const cohort = loadOutOfSampleCohort(cohortRaw);
export const SEGMENTED_COHORT_TICKERS = cohort.cases.map((item) => item.ticker);

type CohortStore = Pick<
  RiskLabCohortBacktestStore,
  "get" | "latest" | "acquireLock" | "releaseLock" | "save"
>;

type CaseExecutor = {
  executeCase(item: OutOfSampleValidationCase, runKnownAt: string): Promise<CohortBacktestCaseResult>;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function hashValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(value)), "utf8").digest("hex");
}

function cohortIdentityHash() {
  const bombDefinition = cohort.cases.find((item) => item.role === "severe_deterioration")?.bomb?.definition;
  const stressDefinition = cohort.cases.find((item) => item.role === "reversible_stress")?.stress?.definition;
  return hashValue({
    id: cohort.metadata.id,
    version: cohort.metadata.version,
    rulesetVersion: cohort.metadata.rulesetVersion,
    registeredAt: cohort.metadata.registeredAt,
    cases: cohort.cases.map((item) => [item.ticker, item.role]),
    bombDefinition,
    stressDefinition,
  });
}

function deploymentUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  return host ? `https://${host.replace(/^https?:\/\//, "")}` : null;
}

function metrics(cases: CohortBacktestCaseResult[]): CohortBacktestMetrics {
  const count = (outcome: CohortBacktestOutcome) => cases.filter((item) => item.outcome === outcome).length;
  const leads = cases
    .map((item) => item.leadTimeDays)
    .filter((value): value is number => typeof value === "number");
  const conclusiveCases = cases.length - count("inconclusive");
  return {
    totalCases: cases.length,
    conclusiveCases,
    truePositives: count("true_positive"),
    trueNegatives: count("true_negative"),
    falsePositives: count("false_positive"),
    falseNegatives: count("false_negative"),
    inconclusiveCases: count("inconclusive"),
    coveragePercent: cases.length ? Math.round(conclusiveCases / cases.length * 10_000) / 100 : 0,
    averageLeadTimeDays: leads.length
      ? Math.round(leads.reduce((sum, value) => sum + value, 0) / leads.length * 100) / 100
      : null,
    minimumLeadTimeDays: leads.length ? Math.min(...leads) : null,
    maximumLeadTimeDays: leads.length ? Math.max(...leads) : null,
  };
}

function check(
  id: string,
  passed: boolean,
  message: string,
  metadata: CohortBacktestCheck["metadata"] = {},
): CohortBacktestCheck {
  return { id, status: passed ? "passed" : "failed", message, metadata };
}

function currentRelease() {
  const release = process.env.VERCEL_GIT_COMMIT_SHA || "";
  return /^[a-f0-9]{40}$/.test(release) ? release : null;
}

function assertProductionRelease() {
  const release = currentRelease();
  if (process.env.VERCEL_ENV !== "production" || !release) {
    throw new Error("Execução segmentada permitida somente no deployment ativo de Produção.");
  }
  return release;
}

function sortCases(cases: CohortBacktestCaseResult[]) {
  const order = new Map(SEGMENTED_COHORT_TICKERS.map((ticker, index) => [ticker, index]));
  return [...cases].sort((left, right) => (order.get(left.ticker) ?? 99) - (order.get(right.ticker) ?? 99));
}

function lockOwner(stage: string) {
  return `risk-lab-cohort-segmented:${stage}:${randomUUID()}`;
}

export interface SegmentedRiskLabCohortBacktestDependencies {
  executor?: CaseExecutor;
  store?: CohortStore;
  now?: () => Date;
}

export class SegmentedRiskLabCohortBacktestService {
  private readonly executor: CaseExecutor;
  private readonly store: CohortStore;
  private readonly now: () => Date;

  constructor(dependencies: SegmentedRiskLabCohortBacktestDependencies = {}) {
    const defaultExecutor = new RiskLabCohortBacktestV2Service({
      dividendSeries: new ConcurrentAutomaticDividendSeriesService({ yearConcurrency: 3 }),
      store: dependencies.store,
      now: dependencies.now,
    });
    this.executor = dependencies.executor
      || (defaultExecutor as unknown as CaseExecutor);
    this.store = dependencies.store || riskLabCohortBacktestStore;
    this.now = dependencies.now || (() => new Date());
  }

  async getPublicEvidence(): Promise<PublicRiskLabCohortBacktestEvidence | null> {
    const evidence = await this.store.latest();
    return evidence ? { ...evidence, evidenceUrl: "/api/system/risk-lab-cohort-backtest" } : null;
  }

  async initialize(): Promise<RiskLabCohortBacktestEvidence> {
    const release = assertProductionRelease();
    const existing = await this.store.get(RISK_LAB_COHORT_BACKTEST_RUN_ID);
    if (existing?.releaseCommit === release && existing.methodologyVersion === METHODOLOGY_VERSION) {
      return existing;
    }

    const owner = lockOwner("initialize");
    const acquired = await this.store.acquireLock(RISK_LAB_COHORT_BACKTEST_RUN_ID, owner);
    if (!acquired) throw new Error("Backtest segmentado já está sendo inicializado.");
    try {
      const current = await this.store.get(RISK_LAB_COHORT_BACKTEST_RUN_ID);
      if (current?.releaseCommit === release && current.methodologyVersion === METHODOLOGY_VERSION) {
        return current;
      }
      const latest = await this.store.latest();
      const startedAt = this.now().toISOString();
      const attemptId = `risk-lab-3-5-attempt-${startedAt.replace(/\D/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
      const evidence: RiskLabCohortBacktestEvidence = {
        schemaVersion: 2,
        sprint: "3.5",
        runId: RISK_LAB_COHORT_BACKTEST_RUN_ID,
        attemptId,
        supersedesRunId: latest?.runId || SUPERSEDED_RUN_ID,
        previousEvidenceHash: latest?.evidenceHash || null,
        methodologyVersion: METHODOLOGY_VERSION,
        status: "running",
        releaseCommit: release,
        deploymentUrl: deploymentUrl(),
        environment: process.env.VERCEL_ENV || null,
        rulesetVersion: "0.1.0",
        cohortId: "risk-lab-credit-oos-v0.1",
        cohortVersion: "0.1.0",
        cohortIdentityHash: cohortIdentityHash(),
        sourceExecutionAllowed: false,
        executionAllowed: false,
        performanceReviewRequired: false,
        startedAt,
        completedAt: null,
        cases: [],
        metrics: metrics([]),
        checks: [],
        blockers: [],
        structuredBlockers: [],
        premiumIntegrated: false,
        notificationsSent: false,
        evidenceHash: null,
      };
      return await this.store.save(evidence);
    } finally {
      await this.store.releaseLock(RISK_LAB_COHORT_BACKTEST_RUN_ID, owner).catch(() => undefined);
    }
  }

  async runTicker(ticker: string): Promise<RiskLabCohortBacktestEvidence> {
    const release = assertProductionRelease();
    const item = cohort.cases.find((candidate) => candidate.ticker === ticker);
    if (!item) throw new Error(`Ticker ${ticker} não pertence à coorte pré-registrada.`);

    const owner = lockOwner(ticker.toLowerCase());
    const acquired = await this.store.acquireLock(RISK_LAB_COHORT_BACKTEST_RUN_ID, owner);
    if (!acquired) throw new Error("Outra etapa do backtest segmentado está em execução.");
    try {
      const current = await this.store.get(RISK_LAB_COHORT_BACKTEST_RUN_ID);
      if (!current || current.status !== "running" || current.releaseCommit !== release) {
        throw new Error("Backtest segmentado não foi inicializado para o release ativo.");
      }
      if (current.cases.some((candidate) => candidate.ticker === ticker)) return current;

      const result = await this.executor.executeCase(item, current.startedAt);
      const cases = sortCases([...current.cases, result]);
      return await this.store.save({
        ...current,
        cases,
        metrics: metrics(cases),
        evidenceHash: null,
      });
    } finally {
      await this.store.releaseLock(RISK_LAB_COHORT_BACKTEST_RUN_ID, owner).catch(() => undefined);
    }
  }

  async finalize(): Promise<RiskLabCohortBacktestEvidence> {
    const release = assertProductionRelease();
    const owner = lockOwner("finalize");
    const acquired = await this.store.acquireLock(RISK_LAB_COHORT_BACKTEST_RUN_ID, owner);
    if (!acquired) throw new Error("Outra etapa do backtest segmentado está em execução.");
    try {
      const current = await this.store.get(RISK_LAB_COHORT_BACKTEST_RUN_ID);
      if (!current || current.releaseCommit !== release) {
        throw new Error("Backtest segmentado não pertence ao release ativo.");
      }
      if (current.status !== "running") return current;
      const cases = sortCases(current.cases);
      if (cases.length !== SEGMENTED_COHORT_TICKERS.length) {
        throw new Error(`Backtest incompleto: ${cases.length}/${SEGMENTED_COHORT_TICKERS.length} fundos persistidos.`);
      }
      const uniqueTickers = new Set(cases.map((item) => item.ticker));
      if (uniqueTickers.size !== SEGMENTED_COHORT_TICKERS.length) {
        throw new Error("Backtest contém ticker duplicado ou ausente.");
      }

      const resultMetrics = metrics(cases);
      const identityHash = cohortIdentityHash();
      const rulesetFrozen = PILOT_RISK_RULES.length > 0
        && PILOT_RISK_RULES.every((rule) => rule.version === "0.1.0");
      const primaryAuthorized = cases.every((item) => item.groundTruth?.status === "verified");
      const primaryComplete = cases.every((item) => item.primaryEvidenceComplete);
      const noLookAhead = cases.every((item) => !item.lookAheadDetected);
      const isolated = cases.every((item) => !item.premiumIntegrated && !item.notificationsSent);
      const healthyControlsSafe = cases
        .filter((item) => item.role === "healthy_control")
        .every((item) => item.outcome === "true_negative");
      const checks = [
        check("deployment.production", current.environment === "production" && Boolean(current.releaseCommit) && Boolean(current.deploymentUrl), "O backtest deve executar no deployment exato de Produção.", {
          production: current.environment === "production",
          releaseCommitPresent: Boolean(current.releaseCommit),
          deploymentUrlPresent: Boolean(current.deploymentUrl),
        }),
        check("cohort.identity", identityHash === EXPECTED_COHORT_HASH, "A identidade pré-registrada da coorte deve permanecer imutável.", { identityHash }),
        check("ruleset.frozen", rulesetFrozen, "Todas as regras executadas devem permanecer na versão 0.1.0."),
        check("cohort.six-cases", cases.length === 6, "Os seis fundos pré-registrados devem ser executados.", { total: cases.length }),
        check("verification.primary-authorized", primaryAuthorized, "A verdade-terreno primária dos seis casos deve ser verificada antes do detector.", { verifiedCases: cases.filter((item) => item.groundTruth?.status === "verified").length }),
        check("evidence.primary-complete", primaryComplete, "Cada observação deve possuir fonte primária, knownAt, URL, trecho, página, hash e versão."),
        check("look-ahead.none", noLookAhead, "Nenhuma observação posterior à data simulada pode influenciar o resultado."),
        check("controls.no-unjustified-alert", healthyControlsSafe, "KNCR11 e KNSC11 não podem receber deterioração injustificada."),
        check("metrics.no-false-positive", resultMetrics.falsePositives === 0, "O backtest não pode encerrar com falso positivo nos controles.", { falsePositives: resultMetrics.falsePositives }),
        check("metrics.performance-measured", resultMetrics.conclusiveCases === 6, "Falsos negativos devem ser medidos e encaminhados ao gate formal da Sprint 3.6.", { falseNegatives: resultMetrics.falseNegatives }),
        check("metrics.no-inconclusive", resultMetrics.inconclusiveCases === 0, "Casos ambíguos ou incompletos impedem a conclusão da Sprint.", { inconclusiveCases: resultMetrics.inconclusiveCases }),
        check("metrics.coverage", resultMetrics.coveragePercent === 100, "A coorte inteira deve possuir resultado conclusivo.", { coveragePercent: resultMetrics.coveragePercent }),
        check("isolation.external-effects", isolated, "O backtest não pode integrar Premium nem enviar notificações."),
      ];
      const methodologicalBlockers = checks
        .filter((item) => item.status === "failed")
        .map((item) => item.message);
      const structuredBlockers: CohortStructuredBlocker[] = cases
        .flatMap((item) => item.structuredBlockers || [])
        .filter((entry) => entry.stage !== "detector" || entry.code === "UNJUSTIFIED_CONTROL_SIGNAL")
        .filter((entry, index, all) => all.findIndex((candidate) =>
          candidate.code === entry.code
          && candidate.message === entry.message
          && candidate.sourceUrl === entry.sourceUrl) === index);
      const blockers = [
        ...methodologicalBlockers,
        ...structuredBlockers.map((entry) => `${entry.code}: ${entry.message}`),
      ];
      const completedAt = this.now().toISOString();
      const passed = blockers.length === 0;
      const withoutHash: Omit<RiskLabCohortBacktestEvidence, "evidenceHash"> = {
        ...current,
        status: passed ? "passed" : "failed",
        sourceExecutionAllowed: primaryAuthorized,
        executionAllowed: passed,
        performanceReviewRequired: resultMetrics.falseNegatives > 0,
        completedAt,
        cases,
        metrics: resultMetrics,
        checks,
        blockers,
        structuredBlockers,
      };
      return await this.store.save({
        ...withoutHash,
        evidenceHash: hashValue(withoutHash),
      });
    } finally {
      await this.store.releaseLock(RISK_LAB_COHORT_BACKTEST_RUN_ID, owner).catch(() => undefined);
    }
  }

  async run(): Promise<RiskLabCohortBacktestEvidence> {
    await this.initialize();
    for (const ticker of SEGMENTED_COHORT_TICKERS) await this.runTicker(ticker);
    return this.finalize();
  }
}

export const segmentedRiskLabCohortBacktestService = new SegmentedRiskLabCohortBacktestService();
