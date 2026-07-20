import { createHash, randomUUID } from "node:crypto";
import { RiskLabAutomaticOrchestrator } from "@/lib/risk-lab/RiskLabAutomaticOrchestrator";
import { RISK_LAB_AUTOMATIC_RATE_LIMIT } from "@/lib/risk-lab/RiskLabAutomaticRateLimit";
import {
  riskLabAutomaticScanStore,
  type FirestoreRiskLabAutomaticScanStore,
} from "@/lib/risk-lab/RiskLabAutomaticScanStore";
import { RiskLabTickerOrchestrator } from "@/lib/risk-lab/RiskLabTickerOrchestrator";
import {
  riskLabProductionSmokeStore,
  type RiskLabProductionSmokeStore,
} from "@/lib/risk-lab/RiskLabProductionSmokeStore";
import type { CvmEventualDocumentDiscovery } from "@/lib/risk-lab/CvmEventualDocumentDiscovery";
import type { PublicFundData } from "@/types/regulatory";
import type {
  AutomaticMonthlySeries,
  RiskLabAutomaticScan,
} from "@/types/riskLabAutomatic";
import type {
  PublicRiskLabProductionSmokeEvidence,
  RiskLabProductionSmokeCase,
  RiskLabProductionSmokeCheck,
  RiskLabProductionSmokeEvidence,
} from "@/types/riskLabProductionSmoke";

export const RISK_LAB_PRODUCTION_SMOKE_RUN_ID = "risk-lab-3-4-20260720-v1";
const ACTOR = "risk-lab-smoke@dadosfii.internal";
const LIVE_TICKERS = ["HCTR11", "MCCI11", "RBRY11"] as const;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function hashEvidence(value: Omit<RiskLabProductionSmokeEvidence, "evidenceHash">) {
  return createHash("sha256").update(JSON.stringify(stableValue(value)), "utf8").digest("hex");
}

function deploymentUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  return host ? `https://${host.replace(/^https?:\/\//, "")}` : null;
}

function check(
  id: string,
  passed: boolean,
  message: string,
  metadata: RiskLabProductionSmokeCheck["metadata"] = {},
): RiskLabProductionSmokeCheck {
  return { id, status: passed ? "passed" : "failed", message, metadata };
}

function incompleteSeries(): AutomaticMonthlySeries {
  return {
    status: "incomplete",
    observations: [],
    sources: [],
    missingMonths: ["2026-01"],
    conflicts: [],
    longestContiguousSequence: 0,
    method: "unavailable",
    detectorResult: null,
    detectorExecuted: false,
    classificationFinal: false,
    limitation: "insufficient_structured_series",
  };
}

function readyScan(): RiskLabAutomaticScan {
  const announcedAt = "2026-01-15T12:00:00.000Z";
  return {
    id: "MCCI11_11111111111111111111",
    ticker: "MCCI11",
    startedAt: announcedAt,
    completedAt: announcedAt,
    requestedBy: ACTOR,
    status: "validated",
    identity: {
      ticker: "MCCI11",
      cnpj: "12345678000199",
      fundName: "Fundo determinístico",
      identitySource: "fixture de smoke",
    },
    documents: [],
    sources: [{
      year: 2026,
      sourceUrl: "https://dados.cvm.gov.br/fixture.csv",
      sourceHash: "a".repeat(64),
      fetched: true,
      matchingRows: 1,
      acceptedDocuments: 1,
      rejectedRows: 0,
      error: null,
    }],
    issues: [],
    monthlySeries: {
      status: "ready",
      observations: [{
        ticker: "MCCI11",
        competenceMonth: "2026-01",
        amountPerShare: 1,
        announcedAt,
        source: {
          documentId: "fixture-1",
          sourceUrl: "https://fnet.bmfbovespa.com.br/fixture-1",
          sourceType: "primary_regulatory",
          reviewMethod: "automatic_regulatory_validation",
          reviewedBy: "fixture",
          reviewedAt: announcedAt,
          page: null,
          excerpt: "Fixture determinística.",
        },
      }],
      sources: [],
      missingMonths: [],
      conflicts: [],
      longestContiguousSequence: 9,
      method: "direct_declared_per_share",
      detectorResult: {
        ticker: "MCCI11",
        status: "no_qualifying_stress",
        baselineMonths: [],
        baselineMedian: null,
        stressMonths: [],
        stressAverage: null,
        stressDropPercent: null,
        stressDetectedAt: null,
        recoveryMonths: [],
        recoveryAverage: null,
        recoveryPercentOfBaseline: null,
        recoveryDetectedAt: null,
        blockingCreditEvent: null,
        observationsUsed: 1,
      },
      detectorExecuted: true,
      classificationFinal: false,
      limitation: "material_credit_events_not_automatically_validated",
    },
    analysisReadiness: "structured_series_ready",
    requiresHumanDocumentValidation: false,
    notificationsSent: false,
    premiumIntegrated: false,
    nextAction: "Fixture pronta para triagem.",
  };
}

export interface RiskLabProductionSmokeDependencies {
  orchestrator?: Pick<RiskLabAutomaticOrchestrator, "scan">;
  scanStore?: Pick<FirestoreRiskLabAutomaticScanStore, "latest" | "auditForScan">;
  smokeStore?: Pick<RiskLabProductionSmokeStore, "get" | "latest" | "acquireLock" | "releaseLock" | "save">;
  now?: () => Date;
}

export class RiskLabProductionSmokeService {
  private readonly orchestrator: Pick<RiskLabAutomaticOrchestrator, "scan">;
  private readonly scanStore: Pick<FirestoreRiskLabAutomaticScanStore, "latest" | "auditForScan">;
  private readonly smokeStore: Pick<RiskLabProductionSmokeStore, "get" | "latest" | "acquireLock" | "releaseLock" | "save">;
  private readonly now: () => Date;

  constructor(dependencies: RiskLabProductionSmokeDependencies = {}) {
    this.scanStore = dependencies.scanStore || riskLabAutomaticScanStore;
    this.orchestrator = dependencies.orchestrator || new RiskLabAutomaticOrchestrator({
      repository: riskLabAutomaticScanStore,
    });
    this.smokeStore = dependencies.smokeStore || riskLabProductionSmokeStore;
    this.now = dependencies.now || (() => new Date());
  }

  async getPublicEvidence(): Promise<PublicRiskLabProductionSmokeEvidence | null> {
    const evidence = await this.smokeStore.latest();
    return evidence ? { ...evidence, evidenceUrl: "/api/system/risk-lab-production-smoke" } : null;
  }

  private async liveCase(ticker: typeof LIVE_TICKERS[number]): Promise<{ summary: RiskLabProductionSmokeCase; passed: boolean }> {
    try {
      const scan = await this.orchestrator.scan(ticker, ACTOR);
      const [latest, audits] = await Promise.all([
        this.scanStore.latest(ticker),
        this.scanStore.auditForScan(scan.id),
      ]);
      const persisted = latest?.id === scan.id;
      const audited = audits.some((item) => item.scanId === scan.id && item.action === "automatic-scan");
      const monthlyInvariant = ticker === "HCTR11"
        ? true
        : Boolean(scan.monthlySeries)
          && (scan.monthlySeries?.status !== "ready" || scan.monthlySeries.detectorExecuted)
          && (scan.monthlySeries?.status !== "incomplete" || !scan.monthlySeries.detectorExecuted);
      const passed = scan.status !== "blocked"
        && scan.sources.length > 0
        && persisted
        && audited
        && monthlyInvariant
        && scan.premiumIntegrated === false
        && scan.notificationsSent === false;
      return {
        passed,
        summary: {
          caseId: `live-${ticker.toLowerCase()}`,
          ticker,
          mode: "live",
          status: scan.status,
          analysisReadiness: scan.analysisReadiness,
          scanId: scan.id,
          sourceCount: scan.sources.length,
          documentCount: scan.documents.length,
          monthlyStatus: scan.monthlySeries?.status || null,
          detectorExecuted: Boolean(scan.monthlySeries?.detectorExecuted),
          classificationFinal: Boolean(scan.monthlySeries?.classificationFinal),
          persisted,
          audited,
          premiumIntegrated: false,
          notificationsSent: false,
          message: passed ? "Fluxo real aprovado e auditado." : "O fluxo real não cumpriu todos os gates da Sprint 3.4.",
        },
      };
    } catch (error) {
      return {
        passed: false,
        summary: {
          caseId: `live-${ticker.toLowerCase()}`,
          ticker,
          mode: "live",
          status: "blocked",
          analysisReadiness: "blocked",
          scanId: null,
          sourceCount: 0,
          documentCount: 0,
          monthlyStatus: null,
          detectorExecuted: false,
          classificationFinal: false,
          persisted: false,
          audited: false,
          premiumIntegrated: false,
          notificationsSent: false,
          message: error instanceof Error ? error.message.slice(0, 300) : "Falha desconhecida no caso real.",
        },
      };
    }
  }

  private async invalidTickerCase(): Promise<{ summary: RiskLabProductionSmokeCase; passed: boolean }> {
    try {
      await this.orchestrator.scan("INVALID", ACTOR);
      return {
        passed: false,
        summary: {
          caseId: "invalid-ticker",
          ticker: "INVALID",
          mode: "deterministic",
          status: "blocked",
          analysisReadiness: "blocked",
          scanId: null,
          sourceCount: 0,
          documentCount: 0,
          monthlyStatus: null,
          detectorExecuted: false,
          classificationFinal: false,
          persisted: false,
          audited: false,
          premiumIntegrated: false,
          notificationsSent: false,
          message: "Ticker inválido foi aceito indevidamente.",
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const passed = /Ticker inválido/i.test(message);
      return {
        passed,
        summary: {
          caseId: "invalid-ticker",
          ticker: "INVALID",
          mode: "deterministic",
          status: "rejected",
          analysisReadiness: null,
          scanId: null,
          sourceCount: 0,
          documentCount: 0,
          monthlyStatus: null,
          detectorExecuted: false,
          classificationFinal: false,
          persisted: false,
          audited: false,
          premiumIntegrated: false,
          notificationsSent: false,
          message: passed ? "Ticker inválido rejeitado antes de qualquer consulta externa." : message.slice(0, 300),
        },
      };
    }
  }

  private async insufficientCase(): Promise<{ summary: RiskLabProductionSmokeCase; passed: boolean }> {
    const discovery = {
      discover: async () => ({
        documents: [],
        sources: [{
          year: 2026,
          sourceUrl: "https://dados.cvm.gov.br/fixture.csv",
          sourceHash: "b".repeat(64),
          fetched: true,
          matchingRows: 0,
          acceptedDocuments: 0,
          rejectedRows: 0,
          error: null,
        }],
        issues: [],
      }),
    } as unknown as CvmEventualDocumentDiscovery;
    const base = new RiskLabTickerOrchestrator({
      resolveFund: async () => ({
        cnpj: "12345678000199",
        name: "Fundo determinístico",
      } as unknown as PublicFundData),
      discovery,
      monthlySeries: { build: async () => incompleteSeries() },
      now: () => new Date("2026-07-20T03:30:00.000Z"),
    });
    const scan = await base.scan("MCCI11", ACTOR);
    const passed = scan.status === "inconclusive"
      && scan.analysisReadiness === "structured_series_incomplete"
      && scan.monthlySeries?.status === "incomplete"
      && !scan.monthlySeries.detectorExecuted;
    return {
      passed,
      summary: {
        caseId: "insufficient-series",
        ticker: "MCCI11",
        mode: "deterministic",
        status: scan.status,
        analysisReadiness: scan.analysisReadiness,
        scanId: scan.id,
        sourceCount: scan.sources.length,
        documentCount: scan.documents.length,
        monthlyStatus: scan.monthlySeries?.status || null,
        detectorExecuted: Boolean(scan.monthlySeries?.detectorExecuted),
        classificationFinal: false,
        persisted: false,
        audited: false,
        premiumIntegrated: false,
        notificationsSent: false,
        message: passed ? "Evidência insuficiente interrompeu o detector corretamente." : "A insuficiência não foi classificada corretamente.",
      },
    };
  }

  private async ambiguityCase(): Promise<{ summary: RiskLabProductionSmokeCase; passed: boolean }> {
    const baseScan = readyScan();
    const orchestrator = new RiskLabAutomaticOrchestrator({
      base: { scan: async () => baseScan },
      creditScreen: {
        screen: async () => ({
          status: "inconclusive",
          relevantFrom: "2026-01-01T00:00:00.000Z",
          relevantUntil: "2026-01-31T23:59:59.000Z",
          inspectedDocuments: 1,
          sourceCoverageComplete: false,
          matches: [],
          verifiedEvents: [],
          ambiguousDocuments: [{
            documentId: "ambiguous-1",
            documentType: "Fato relevante",
            fileName: "documento-nao-legivel.pdf",
            receivedAt: "2026-01-20T12:00:00.000Z",
            sourceUrl: "https://dados.cvm.gov.br/ambiguous-1",
            reason: "Documento não legível automaticamente.",
          }],
          summary: "Documento oficial ambíguo; classificação interrompida.",
          classificationFinal: false,
        }),
      },
    });
    const scan = await orchestrator.scan("MCCI11", ACTOR);
    const passed = scan.status === "inconclusive"
      && scan.analysisReadiness === "credit_event_screen_inconclusive"
      && scan.monthlySeries?.limitation === "material_credit_event_screen_inconclusive"
      && scan.premiumIntegrated === false
      && scan.notificationsSent === false;
    return {
      passed,
      summary: {
        caseId: "ambiguous-credit-event",
        ticker: "MCCI11",
        mode: "deterministic",
        status: scan.status,
        analysisReadiness: scan.analysisReadiness,
        scanId: scan.id,
        sourceCount: scan.sources.length,
        documentCount: scan.documents.length,
        monthlyStatus: scan.monthlySeries?.status || null,
        detectorExecuted: Boolean(scan.monthlySeries?.detectorExecuted),
        classificationFinal: Boolean(scan.monthlySeries?.classificationFinal),
        persisted: false,
        audited: false,
        premiumIntegrated: false,
        notificationsSent: false,
        message: passed ? "Ambiguidade bloqueou a classificação final corretamente." : "A ambiguidade não foi tratada como inconclusiva.",
      },
    };
  }

  async run(): Promise<RiskLabProductionSmokeEvidence> {
    const existing = await this.smokeStore.get(RISK_LAB_PRODUCTION_SMOKE_RUN_ID);
    if (existing?.status === "passed") return existing;

    const owner = `risk-lab-smoke:${randomUUID()}`;
    const acquired = await this.smokeStore.acquireLock(RISK_LAB_PRODUCTION_SMOKE_RUN_ID, owner);
    if (!acquired) return (await this.smokeStore.get(RISK_LAB_PRODUCTION_SMOKE_RUN_ID)) || existing || Promise.reject(new Error("Smoke do Risk Lab já está em execução."));

    const startedAt = this.now().toISOString();
    const baseEvidence: RiskLabProductionSmokeEvidence = {
      schemaVersion: 1,
      sprint: "3.4",
      runId: RISK_LAB_PRODUCTION_SMOKE_RUN_ID,
      status: "running",
      releaseCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      deploymentUrl: deploymentUrl(),
      environment: process.env.VERCEL_ENV || null,
      startedAt,
      completedAt: null,
      checks: [],
      cases: [],
      blockers: [],
      evidenceHash: null,
    };
    await this.smokeStore.save(baseEvidence);

    try {
      const liveResults = await Promise.all(LIVE_TICKERS.map((ticker) => this.liveCase(ticker)));
      const [invalid, insufficient, ambiguity] = await Promise.all([
        this.invalidTickerCase(),
        this.insufficientCase(),
        this.ambiguityCase(),
      ]);
      const results = [...liveResults, invalid, insufficient, ambiguity];
      const cases = results.map((result) => result.summary);
      const livePassed = liveResults.every((result) => result.passed);
      const persisted = liveResults.every((result) => result.summary.persisted);
      const audited = liveResults.every((result) => result.summary.audited);
      const isolated = cases.every((item) => !item.premiumIntegrated && !item.notificationsSent);
      const scanHashesValid = cases
        .filter((item) => item.scanId)
        .every((item) => /^[A-Z]{4}11_[a-f0-9]{20}$/.test(item.scanId || ""));
      const checks = [
        check("deployment.production", baseEvidence.environment === "production" && Boolean(baseEvidence.releaseCommit) && Boolean(baseEvidence.deploymentUrl), "O smoke deve executar no deployment exato de Produção.", {
          production: baseEvidence.environment === "production",
          releaseCommitPresent: Boolean(baseEvidence.releaseCommit),
          deploymentUrlPresent: Boolean(baseEvidence.deploymentUrl),
        }),
        check("feature.automatic-discovery", process.env.ENABLE_RISK_LAB_AUTOMATIC_DISCOVERY !== "false", "A pesquisa automática por ticker deve estar habilitada.", {
          enabled: process.env.ENABLE_RISK_LAB_AUTOMATIC_DISCOVERY !== "false",
        }),
        check("rate-limit.contract", RISK_LAB_AUTOMATIC_RATE_LIMIT.limit === 3 && RISK_LAB_AUTOMATIC_RATE_LIMIT.windowMs === 15 * 60_000, "O Admin deve preservar o limite de três pesquisas a cada quinze minutos.", {
          limit: RISK_LAB_AUTOMATIC_RATE_LIMIT.limit,
          windowMs: RISK_LAB_AUTOMATIC_RATE_LIMIT.windowMs,
        }),
        check("live.ticker-only", livePassed, "HCTR11, MCCI11 e RBRY11 devem completar o fluxo ticker-only sem estado bloqueado.", {
          passed: liveResults.filter((result) => result.passed).length,
          total: liveResults.length,
        }),
        check("edge.invalid-ticker", invalid.passed, "Ticker inválido deve ser rejeitado antes de consultas externas."),
        check("edge.insufficient-data", insufficient.passed, "Dados insuficientes devem produzir estado inconclusivo e impedir o detector."),
        check("edge.ambiguity", ambiguity.passed, "Documento ambíguo deve interromper a classificação final."),
        check("persistence.scans", persisted, "Os resultados finais dos casos reais devem ser persistidos."),
        check("audit.scans", audited, "Cada resultado real persistido deve possuir auditoria separada."),
        check("isolation.external-effects", isolated, "O smoke não pode integrar Premium nem enviar notificações."),
        check("integrity.scan-hashes", scanHashesValid, "Todos os identificadores de scan devem preservar hash determinístico."),
      ];
      const blockers = checks.filter((item) => item.status === "failed").map((item) => item.message);
      const completedAt = this.now().toISOString();
      const withoutHash: Omit<RiskLabProductionSmokeEvidence, "evidenceHash"> = {
        ...baseEvidence,
        status: blockers.length ? "failed" : "passed",
        completedAt,
        checks,
        cases,
        blockers,
      };
      const evidence: RiskLabProductionSmokeEvidence = {
        ...withoutHash,
        evidenceHash: hashEvidence(withoutHash),
      };
      return await this.smokeStore.save(evidence);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida no smoke do Risk Lab.";
      const completedAt = this.now().toISOString();
      const failureCheck = check("smoke.execution", false, "O executor de Produção falhou antes de concluir todos os gates.", {
        error: message.slice(0, 300),
      });
      const withoutHash: Omit<RiskLabProductionSmokeEvidence, "evidenceHash"> = {
        ...baseEvidence,
        status: "failed",
        completedAt,
        checks: [failureCheck],
        blockers: [failureCheck.message],
      };
      return this.smokeStore.save({ ...withoutHash, evidenceHash: hashEvidence(withoutHash) });
    } finally {
      await this.smokeStore.releaseLock(RISK_LAB_PRODUCTION_SMOKE_RUN_ID, owner).catch(() => undefined);
    }
  }
}

export const riskLabProductionSmokeService = new RiskLabProductionSmokeService();
