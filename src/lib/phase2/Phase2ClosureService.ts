import { randomUUID } from "crypto";
import { regulatoryDataService, type RegulatoryDataService } from "@/lib/regulatoryDataService";
import { regulatoryRepository, type RegulatoryRepository } from "@/lib/regulatory/RegulatoryRepository";
import {
  basicFundEvidence,
  evaluateCatalogAudit,
  evaluateCatalogPreview,
  evidenceHash,
  misleadingMissingDataClaims,
  selectStratifiedSamples,
} from "@/lib/phase2/Phase2ClosurePolicy";
import type { FundCatalogAudit, FundCatalogDirectory, FundCatalogRun } from "@/types/fund-catalog";
import {
  PHASE2_CLOSURE_SCHEMA_VERSION,
  type Phase2CatalogEvidence,
  type Phase2ClosureCheck,
  type Phase2ClosurePhase,
  type Phase2ClosureState,
  type Phase2SmokeEvidence,
  type PublicPhase2ClosureEvidence,
} from "@/types/phase2-closure";

const RETRY_DELAY_MS = 6 * 60 * 60_000;
const ACTOR = "cron:phase2-closure";

function nowIso() {
  return new Date().toISOString();
}

function deploymentUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  return host ? `https://${host.replace(/^https?:\/\//, "")}` : null;
}

function mergeChecks(previous: Phase2ClosureCheck[], next: Phase2ClosureCheck[]) {
  const checks = new Map(previous.map((item) => [item.id, item]));
  next.forEach((item) => checks.set(item.id, item));
  return Array.from(checks.values()).sort((left, right) => left.id.localeCompare(right.id));
}

function catalogEvidence(run: FundCatalogRun, audit?: FundCatalogAudit | null, directory?: FundCatalogDirectory | null): Phase2CatalogEvidence {
  return {
    runId: run.id,
    sourceHash: run.sourceHash,
    planHash: run.planHash,
    sourceMatchPercent: run.coverage.sourceMatchPercent,
    basicCoveragePercent: audit?.basicCoveragePercent ?? run.coverage.basicCoveragePercent,
    essentialCoveragePercent: audit?.essentialCoveragePercent ?? run.coverage.essentialCoveragePercent,
    duplicateCnpjGroups: audit?.duplicateCnpjGroups ?? run.coverage.duplicateCnpjGroups,
    activeFunds: audit?.activeDocuments ?? run.coverage.activeFunds,
    inactiveFunds: run.coverage.inactiveFunds,
    underReviewFunds: run.coverage.underReviewFunds,
    planned: run.totals.planned,
    added: run.totals.added,
    updated: run.totals.updated,
    inactivated: run.totals.inactivated,
    reactivated: run.totals.reactivated,
    directoryTotal: directory?.total ?? null,
    auditGeneratedAt: audit?.generatedAt ?? null,
    verifiedAt: run.verifiedAt || audit?.generatedAt || null,
  };
}

function initialState(actor = ACTOR): Phase2ClosureState {
  const timestamp = nowIso();
  return {
    schemaVersion: PHASE2_CLOSURE_SCHEMA_VERSION,
    sprint: "2.12",
    status: "pending",
    phase: "catalog-preview",
    attempt: 0,
    actor,
    releaseCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    deploymentUrl: deploymentUrl(),
    runId: null,
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    retryAfter: null,
    blockers: [],
    error: null,
    checks: [],
    catalog: null,
    smoke: null,
    evidenceHash: null,
  };
}

function aiText(insights: Awaited<ReturnType<RegulatoryDataService["getAIInsights"]>>) {
  if (!insights) return "";
  return [insights.executiveSummary, insights.plainLanguage, ...insights.changes, ...insights.risks, ...insights.opportunities, ...insights.alerts].join(" ");
}

function premiumText(report: Awaited<ReturnType<RegulatoryDataService["getPremiumReport"]>>) {
  if (!report) return "";
  return [
    report.aiAnalysis.executiveSummary,
    report.aiAnalysis.differentiatedInsight,
    report.aiAnalysis.portfolioReading,
    report.aiAnalysis.peerReading,
    report.aiAnalysis.plainLanguage,
    ...report.aiAnalysis.monitoringTriggers,
  ].join(" ");
}

export class Phase2ClosureService {
  constructor(
    private readonly data: RegulatoryDataService = regulatoryDataService,
    private readonly repository: RegulatoryRepository = regulatoryRepository,
  ) {}

  getStatus() {
    return this.repository.getPhase2ClosureState();
  }

  async getPublicEvidence(): Promise<PublicPhase2ClosureEvidence | null> {
    const state = await this.getStatus();
    if (!state) return null;
    const { actor: _actor, error: _error, retryAfter: _retryAfter, ...evidence } = state;
    return { ...evidence, evidenceUrl: "/api/system/phase-2-closure" };
  }

  async advance(actor = ACTOR) {
    const owner = `${actor}:${randomUUID()}`;
    const acquired = await this.repository.acquirePhase2ClosureLock(owner);
    if (!acquired) return (await this.getStatus()) || initialState(actor);
    let state = (await this.getStatus()) || initialState(actor);
    try {
      if (state.status === "passed") return state;
      if (state.status === "blocked" && state.retryAfter && new Date(state.retryAfter).getTime() > Date.now()) return state;
      if (state.status === "blocked" && state.phase === "catalog-preview") state = { ...initialState(actor), attempt: state.attempt, startedAt: state.startedAt };
      if (state.phase === "catalog-preview") return await this.preview(state, actor);
      if (state.phase === "catalog-apply") return await this.apply(state, actor);
      if (state.phase === "production-smoke") return await this.smoke(state, actor);
      return state;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida na Sprint 2.12.";
      const failed: Phase2ClosureState = {
        ...state,
        status: "failed",
        attempt: state.attempt + 1,
        actor,
        updatedAt: nowIso(),
        retryAfter: null,
        error: message.slice(0, 1_000),
      };
      await this.repository.savePhase2ClosureState(failed, actor);
      return failed;
    } finally {
      await this.repository.releasePhase2ClosureLock(owner).catch(() => undefined);
    }
  }

  private async running(state: Phase2ClosureState, actor: string, phase: Phase2ClosurePhase) {
    const running: Phase2ClosureState = {
      ...state,
      status: "running",
      phase,
      actor,
      attempt: state.attempt + 1,
      releaseCommit: process.env.VERCEL_GIT_COMMIT_SHA || state.releaseCommit,
      deploymentUrl: deploymentUrl() || state.deploymentUrl,
      updatedAt: nowIso(),
      retryAfter: null,
      blockers: [],
      error: null,
    };
    await this.repository.savePhase2ClosureState(running, actor);
    return running;
  }

  private async preview(previous: Phase2ClosureState, actor: string) {
    const state = await this.running(previous, actor, "catalog-preview");
    const run = await this.data.previewFundCatalog(actor);
    const evaluation = evaluateCatalogPreview(run);
    const blocked = evaluation.blockers.length > 0;
    const next: Phase2ClosureState = {
      ...state,
      status: blocked ? "blocked" : "ready",
      phase: blocked ? "catalog-preview" : "catalog-apply",
      runId: run.id,
      updatedAt: nowIso(),
      retryAfter: blocked ? new Date(Date.now() + RETRY_DELAY_MS).toISOString() : null,
      blockers: evaluation.blockers,
      checks: mergeChecks(state.checks, evaluation.checks),
      catalog: catalogEvidence(run),
    };
    await this.repository.savePhase2ClosureState(next, actor);
    return next;
  }

  private async apply(previous: Phase2ClosureState, actor: string) {
    const state = await this.running(previous, actor, "catalog-apply");
    const status = await this.data.getFundCatalogStatus();
    if (!status.run || status.run.id !== state.runId) throw new Error("A prévia oficial mudou antes da aplicação; uma nova conciliação é obrigatória.");
    const result = await this.data.applyFundCatalog(status.run.id, status.run.approvalHash, actor);
    const evaluation = evaluateCatalogAudit(result.audit, result.directory, result.run.id);
    const blocked = evaluation.blockers.length > 0;
    const next: Phase2ClosureState = {
      ...state,
      status: blocked ? "blocked" : "ready",
      phase: blocked ? "catalog-apply" : "production-smoke",
      runId: result.run.id,
      updatedAt: nowIso(),
      retryAfter: blocked ? new Date(Date.now() + RETRY_DELAY_MS).toISOString() : null,
      blockers: evaluation.blockers,
      checks: mergeChecks(state.checks, evaluation.checks),
      catalog: catalogEvidence(result.run, result.audit, result.directory),
    };
    await this.repository.savePhase2ClosureState(next, actor);
    return next;
  }

  private async smoke(previous: Phase2ClosureState, actor: string) {
    const state = await this.running(previous, actor, "production-smoke");
    const [{ run, audit }, directory] = await Promise.all([
      this.data.getFundCatalogStatus(),
      this.data.getFundDirectory({ force: true }),
    ]);
    if (!run || !audit || !directory || run.id !== state.runId) throw new Error("Carga, auditoria ou diretório da Sprint 2.12 não está disponível para homologação.");
    const catalogEvaluation = evaluateCatalogAudit(audit, directory, run.id);
    const samples = selectStratifiedSamples(directory);
    const sampleCheck: Phase2ClosureCheck = {
      id: "smoke.stratified-universe",
      status: samples.length === 3 ? "passed" : "failed",
      message: "A homologação deve conter um FII, um FIAGRO e um FI-Infra.",
      metadata: { samples: samples.length, required: 3 },
    };
    if (sampleCheck.status === "failed") {
      const blocked = { ...state, status: "blocked" as const, updatedAt: nowIso(), retryAfter: new Date(Date.now() + RETRY_DELAY_MS).toISOString(), blockers: [sampleCheck.message], checks: mergeChecks(state.checks, [...catalogEvaluation.checks, sampleCheck]) };
      await this.repository.savePhase2ClosureState(blocked, actor);
      return blocked;
    }

    const [funds, validation] = await Promise.all([
      this.data.getMany(samples.map((item) => item.ticker), samples.length),
      this.data.runValidation(actor, { limit: 500 }),
    ]);

    const sampleEvidence = await Promise.all(samples.map(async (sample) => {
      const fund = funds.items[sample.ticker] || null;
      const basic = basicFundEvidence(fund);
      const basicComplete = Object.values(basic).every(Boolean);
      const freeReport = await this.data.getFreeReport(sample.ticker);
      const requestPrefix = `phase2-closure:${run.id}:${sample.ticker}`;
      const [insights, premium] = await Promise.all([
        this.data.getAIInsights(sample.ticker, { requestKey: `${requestPrefix}:insights` }),
        this.data.getPremiumReport(sample.ticker, { requestKey: `${requestPrefix}:premium` }),
      ]);
      const claims = [
        ...misleadingMissingDataClaims(aiText(insights), basic),
        ...misleadingMissingDataClaims(premiumText(premium), basic),
      ];
      if (claims.length) throw new Error(`${sample.ticker}: ${claims.join(" ")}`);
      return {
        ticker: sample.ticker,
        kind: sample.kind,
        basicDataComplete: basicComplete,
        freeReport: Boolean(freeReport),
        aiInsights: Boolean(insights?.executiveSummary && insights?.plainLanguage),
        premiumReport: Boolean(premium?.valuation && premium?.stressTest.length && premium?.scenarios.length && premium?.aiAnalysis),
        aiModel: insights?.metadata.model || null,
        promptVersion: insights?.metadata.promptVersion || null,
        premiumReportVersion: premium?.reportVersion || null,
      };
    }));

    const health = await this.data.getSystemHealth();
    const smokeChecks: Phase2ClosureCheck[] = [
      sampleCheck,
      { id: "smoke.validation", status: validation.status === "completed" && validation.healthScore >= 90 ? "passed" : "failed", message: "Validation deve concluir com saúde mínima de 90 pontos.", metadata: { status: validation.status, healthScore: validation.healthScore, processed: validation.totals.processed } },
      { id: "smoke.health", status: health.ok && health.score >= 80 ? "passed" : "failed", message: "Health deve confirmar o ambiente de Produção sem falha crítica.", metadata: { ok: health.ok, score: health.score, status: health.status } },
      { id: "smoke.basic-data", status: sampleEvidence.every((item) => item.basicDataComplete) ? "passed" : "failed", message: "As três classes de fundos devem chegar aos relatórios com dados básicos completos.", metadata: { passed: sampleEvidence.filter((item) => item.basicDataComplete).length, samples: sampleEvidence.length } },
      { id: "smoke.free-report", status: sampleEvidence.every((item) => item.freeReport) ? "passed" : "failed", message: "O relatório gratuito deve ser gerado para as três classes.", metadata: { passed: sampleEvidence.filter((item) => item.freeReport).length, samples: sampleEvidence.length } },
      { id: "smoke.ai-insights", status: sampleEvidence.every((item) => item.aiInsights) ? "passed" : "failed", message: "AI Insights deve gerar conteúdo estruturado para as três classes.", metadata: { passed: sampleEvidence.filter((item) => item.aiInsights).length, samples: sampleEvidence.length } },
      { id: "smoke.premium-report", status: sampleEvidence.every((item) => item.premiumReport) ? "passed" : "failed", message: "O relatório Premium deve gerar valuation, cenários, stress e análise para as três classes.", metadata: { passed: sampleEvidence.filter((item) => item.premiumReport).length, samples: sampleEvidence.length } },
    ];
    const checks = mergeChecks(state.checks, [...catalogEvaluation.checks, ...smokeChecks]);
    const blockers = checks.filter((item) => item.status === "failed").map((item) => item.message);
    const smoke: Phase2SmokeEvidence = {
      validationRunId: validation.id,
      validationStatus: validation.status,
      validationHealthScore: validation.healthScore,
      validationProcessed: validation.totals.processed,
      systemHealthOk: health.ok,
      systemHealthScore: health.score,
      samples: sampleEvidence,
    };
    const timestamp = nowIso();
    const candidate: Phase2ClosureState = {
      ...state,
      status: blockers.length ? "blocked" : "passed",
      phase: blockers.length ? "production-smoke" : "complete",
      updatedAt: timestamp,
      completedAt: blockers.length ? null : timestamp,
      retryAfter: blockers.length ? new Date(Date.now() + RETRY_DELAY_MS).toISOString() : null,
      blockers,
      checks,
      catalog: catalogEvidence(run, audit, directory),
      smoke,
      evidenceHash: null,
    };
    const next = blockers.length ? candidate : { ...candidate, evidenceHash: evidenceHash(candidate) };
    await this.repository.savePhase2ClosureState(next, actor);
    return next;
  }
}

export const phase2ClosureService = new Phase2ClosureService();
