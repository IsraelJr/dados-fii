import { createHash, randomUUID } from "node:crypto";
import cohortRaw from "@/lib/risk-lab/out-of-sample-cohort-v0.1.json";
import { AutomaticCreditEventScreeningService } from "@/lib/risk-lab/AutomaticCreditEventScreeningService";
import { AutomaticDividendSeriesService } from "@/lib/risk-lab/AutomaticDividendSeriesService";
import {
  CvmEventualDocumentDiscovery,
  type CvmEventualDiscoveryResult,
} from "@/lib/risk-lab/CvmEventualDocumentDiscovery";
import { dividendStressWindowEngine } from "@/lib/risk-lab/DividendStressWindowEngine";
import { PILOT_RISK_RULES } from "@/lib/risk-lab/rules";
import {
  riskLabCohortBacktestStore,
  type RiskLabCohortBacktestStore,
} from "@/lib/risk-lab/RiskLabCohortBacktestStore";
import { loadOutOfSampleCohort } from "@/lib/risk-lab/ValidationCohortLoader";
import type { PublicFundData } from "@/types/regulatory";
import type {
  AutomaticCreditEventScreen,
  AutomaticDocumentEvidence,
  AutomaticSourceSummary,
} from "@/types/riskLabAutomatic";
import type {
  CohortBacktestCaseResult,
  CohortBacktestCheck,
  CohortBacktestMetrics,
  CohortBacktestOutcome,
  CohortPrimaryEvidence,
  PublicRiskLabCohortBacktestEvidence,
  RiskLabCohortBacktestEvidence,
} from "@/types/riskLabCohortBacktest";
import type {
  DividendStressWindow,
  VerifiedDividendNotice,
} from "@/types/riskLabDividendStress";
import type {
  OutOfSampleCohort,
  OutOfSampleValidationCase,
} from "@/types/riskLabValidation";

export const RISK_LAB_COHORT_BACKTEST_RUN_ID = "risk-lab-3-5-20260720-v1";
const ACTOR = "risk-lab-cohort@dadosfii.internal";
const EXPECTED_COHORT_HASH = "620c26abbf30b4f96ef3de9dbfd8eb6c7b9e6d1fe56851d70079d39d0f490fd1";
const DAY_MS = 24 * 60 * 60 * 1000;

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

function cohortIdentityHash(cohort: OutOfSampleCohort) {
  const bombDefinition = cohort.cases.find((item) => item.role === "severe_deterioration")?.bomb?.definition;
  const stressDefinition = cohort.cases.find((item) => item.role === "reversible_stress")?.stress?.definition;
  const identity = {
    id: cohort.metadata.id,
    version: cohort.metadata.version,
    rulesetVersion: cohort.metadata.rulesetVersion,
    registeredAt: cohort.metadata.registeredAt,
    cases: cohort.cases.map((item) => [item.ticker, item.role]),
    bombDefinition,
    stressDefinition,
  };
  const stable = JSON.stringify(identity, Object.keys(identity).sort());
  return createHash("sha256").update(stable, "utf8").digest("hex");
}

function deploymentUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  return host ? `https://${host.replace(/^https?:\/\//, "")}` : null;
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function yearsFor(item: OutOfSampleValidationCase, now: Date) {
  const start = Number(item.analysisWindow.start.slice(0, 4));
  const finalDate = item.analysisWindow.end || now.toISOString().slice(0, 10);
  const end = Number(finalDate.slice(0, 4));
  const years: number[] = [];
  for (let year = start; year <= end; year += 1) years.push(year);
  return years;
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function mergeDiscovery(results: CvmEventualDiscoveryResult[]): CvmEventualDiscoveryResult {
  const documents = new Map<string, AutomaticDocumentEvidence>();
  const sources = new Map<number, AutomaticSourceSummary>();
  for (const result of results) {
    result.documents.forEach((document) => documents.set(document.documentId, document));
    result.sources.forEach((source) => sources.set(source.year, source));
  }
  return {
    documents: [...documents.values()].sort((left, right) => Date.parse(right.receivedAt) - Date.parse(left.receivedAt)),
    sources: [...sources.values()].sort((left, right) => left.year - right.year),
    issues: results.flatMap((result) => result.issues),
  };
}

function caseEnd(item: OutOfSampleValidationCase, now: Date) {
  return `${item.analysisWindow.end || now.toISOString().slice(0, 10)}T23:59:59-03:00`;
}

function yearInterval(item: OutOfSampleValidationCase, year: number, now: Date) {
  const overallEnd = item.analysisWindow.end || now.toISOString().slice(0, 10);
  const start = item.analysisWindow.start > `${year}-01-01` ? item.analysisWindow.start : `${year}-01-01`;
  const end = overallEnd < `${year}-12-31` ? overallEnd : `${year}-12-31`;
  return {
    from: `${start}T00:00:00-03:00`,
    until: `${end}T23:59:59-03:00`,
  };
}

function aggregateScreens(screens: AutomaticCreditEventScreen[]): AutomaticCreditEventScreen {
  const material = screens.some((screen) => screen.status === "material_event_confirmed");
  const inconclusive = screens.some((screen) => screen.status === "inconclusive");
  const matches = screens.flatMap((screen) => screen.matches);
  const events = screens.flatMap((screen) => screen.verifiedEvents)
    .filter((event, index, all) => all.findIndex((candidate) => candidate.documentId === event.documentId && candidate.type === event.type) === index)
    .sort((left, right) => Date.parse(left.knownAt) - Date.parse(right.knownAt));
  const ambiguous = screens.flatMap((screen) => screen.ambiguousDocuments)
    .filter((document, index, all) => all.findIndex((candidate) => candidate.documentId === document.documentId) === index);
  return {
    status: material ? "material_event_confirmed" : inconclusive ? "inconclusive" : "no_explicit_event_found",
    relevantFrom: screens[0]?.relevantFrom || "",
    relevantUntil: screens.at(-1)?.relevantUntil || "",
    inspectedDocuments: screens.reduce((sum, screen) => sum + screen.inspectedDocuments, 0),
    sourceCoverageComplete: screens.every((screen) => screen.sourceCoverageComplete),
    matches,
    verifiedEvents: events,
    ambiguousDocuments: ambiguous,
    summary: material
      ? `${events.length} evento(s) material(is) confirmado(s) na janela completa.`
      : inconclusive
        ? "Uma ou mais janelas anuais permaneceram inconclusivas."
        : "A cobertura oficial completa não encontrou evento material explícito.",
    classificationFinal: material,
  };
}

function sequentialDetector(observations: VerifiedDividendNotice[]) {
  const ordered = [...observations].sort((left, right) => Date.parse(left.announcedAt) - Date.parse(right.announcedAt));
  const asOfValues = [...new Set(ordered.map((item) => item.announcedAt))];
  let finalResult: DividendStressWindow | null = null;
  let firstSignalAt: string | null = null;
  let lookAheadDetected = false;

  for (const asOf of asOfValues) {
    const known = ordered.filter((item) => Date.parse(item.announcedAt) <= Date.parse(asOf));
    if (known.length < 9) continue;
    const result = dividendStressWindowEngine.detect(known);
    finalResult = result;
    if (result.stressDetectedAt && Date.parse(result.stressDetectedAt) > Date.parse(asOf)) {
      lookAheadDetected = true;
    }
    if (!firstSignalAt && result.status !== "no_qualifying_stress") {
      firstSignalAt = result.stressDetectedAt || asOf;
    }
  }

  return { finalResult, firstSignalAt, lookAheadDetected };
}

function evidenceComplete(item: CohortPrimaryEvidence) {
  return Boolean(
    item.observationId
      && item.documentId
      && Number.isFinite(Date.parse(item.knownAt))
      && item.sourceUrl.startsWith("https://")
      && item.excerpt.trim()
      && Number.isInteger(item.page)
      && item.page > 0
      && /^[a-f0-9]{64}$/.test(item.sourceHash)
      && item.sourceVersion.trim()
      && (item.protocolHash === null || /^[a-f0-9]{64}$/.test(item.protocolHash))
      && (item.protocolVersion === null || Number.isInteger(item.protocolVersion)),
  );
}

function dividendEvidence(observations: VerifiedDividendNotice[]): CohortPrimaryEvidence[] {
  return observations.flatMap((observation) => {
    const source = observation.source;
    if (!source.sourceHash || !source.protocolHash || !source.protocolVersion) return [];
    return [{
      observationId: `${observation.ticker}:${observation.competenceMonth}`,
      kind: "dividend_notice" as const,
      documentId: source.documentId,
      knownAt: observation.announcedAt,
      sourceUrl: source.sourceUrl,
      excerpt: source.excerpt,
      page: source.page || 1,
      sourceHash: source.sourceHash,
      sourceVersion: `fnet-notice-protocol-v${source.protocolVersion}`,
      protocolHash: source.protocolHash,
      protocolVersion: source.protocolVersion,
    }];
  });
}

function sourceCoverageEvidence(sources: AutomaticSourceSummary[], runKnownAt: string): CohortPrimaryEvidence[] {
  return sources.flatMap((source) => {
    if (!source.fetched || !source.sourceHash) return [];
    return [{
      observationId: `CVM:EVENTUAL:${source.year}`,
      kind: "source_coverage" as const,
      documentId: `eventual_fi_${source.year}.csv`,
      knownAt: runKnownAt,
      sourceUrl: source.sourceUrl,
      excerpt: `Catálogo oficial CVM ${source.year}: ${source.matchingRows} linha(s) do fundo, ${source.acceptedDocuments} documento(s) aceito(s), ${source.rejectedRows} rejeitado(s).`,
      page: 1,
      sourceHash: source.sourceHash,
      sourceVersion: `eventual_fi_${source.year}.csv`,
      protocolHash: null,
      protocolVersion: null,
    }];
  });
}

function creditEvidence(
  screen: AutomaticCreditEventScreen,
  documents: AutomaticDocumentEvidence[],
  sources: AutomaticSourceSummary[],
): CohortPrimaryEvidence[] {
  return screen.matches.flatMap((match) => {
    const document = documents.find((candidate) => candidate.documentId === match.documentId);
    if (!document) return [];
    const source = sources.find((candidate) => candidate.year === document.sourceYear);
    if (!source?.sourceHash) return [];
    return [{
      observationId: `${document.documentId}:${match.eventType}`,
      kind: "credit_event" as const,
      documentId: document.documentId,
      knownAt: match.knownAt,
      sourceUrl: source.sourceUrl,
      excerpt: `${document.documentType}; arquivo ${document.fileName}; termo objetivo ${match.matchedTerm}; documento oficial ${document.link}.`,
      page: 1,
      sourceHash: source.sourceHash,
      sourceVersion: `eventual_fi_${document.sourceYear}.csv`,
      protocolHash: null,
      protocolVersion: null,
    }];
  });
}

function leadTimeDays(firstSignalAt: string | null, referenceAt: string | null) {
  if (!referenceAt) return null;
  if (!firstSignalAt) return 0;
  return Math.round((Date.parse(referenceAt) - Date.parse(firstSignalAt)) / DAY_MS * 100) / 100;
}

function outcomeFor(
  item: OutOfSampleValidationCase,
  detector: DividendStressWindow | null,
  screen: AutomaticCreditEventScreen,
  sourceCoverageComplete: boolean,
  primaryEvidenceComplete: boolean,
): { outcome: CohortBacktestOutcome; blockers: string[] } {
  const blockers: string[] = [];
  if (!sourceCoverageComplete) blockers.push("Cobertura anual das fontes oficiais incompleta.");
  if (!primaryEvidenceComplete) blockers.push("Uma ou mais observações não possuem URL, trecho, página, hash e versão completos.");
  if (screen.status === "inconclusive") blockers.push("Triagem de eventos materiais inconclusiva.");

  if (blockers.length) return { outcome: "inconclusive", blockers };

  if (item.role === "severe_deterioration") {
    return screen.status === "material_event_confirmed"
      ? { outcome: "true_positive", blockers }
      : { outcome: "false_negative", blockers: ["Caso grave pré-registrado sem evento material detectado na janela oficial completa."] };
  }

  if (!detector) {
    return { outcome: "inconclusive", blockers: ["Série primária insuficiente para executar o detector temporal."] };
  }

  if (item.role === "healthy_control") {
    const positive = screen.status === "material_event_confirmed" || detector.status !== "no_qualifying_stress";
    return positive
      ? { outcome: "false_positive", blockers: ["Controle saudável recebeu sinal de deterioração sem previsão no rótulo pré-registrado."] }
      : { outcome: "true_negative", blockers };
  }

  if (screen.status === "material_event_confirmed") {
    return { outcome: "inconclusive", blockers: ["Evento material confirmado contradiz o rótulo de estresse reversível."] };
  }
  return detector.status === "reversible_stress_confirmed"
    ? { outcome: "true_positive", blockers }
    : { outcome: "false_negative", blockers: [`Estresse reversível pré-registrado não foi confirmado; detector terminou em ${detector.status}.`] };
}

function metrics(cases: CohortBacktestCaseResult[]): CohortBacktestMetrics {
  const count = (outcome: CohortBacktestOutcome) => cases.filter((item) => item.outcome === outcome).length;
  const leads = cases.map((item) => item.leadTimeDays).filter((value): value is number => typeof value === "number");
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
    averageLeadTimeDays: leads.length ? Math.round(leads.reduce((sum, value) => sum + value, 0) / leads.length * 100) / 100 : null,
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

async function defaultResolveFund(ticker: string) {
  const { regulatoryDataService } = await import("@/lib/regulatoryDataService");
  return regulatoryDataService.getByTicker(ticker, { bypassCache: true });
}

export interface RiskLabCohortBacktestDependencies {
  resolveFund?: (ticker: string) => Promise<PublicFundData | null>;
  discovery?: Pick<CvmEventualDocumentDiscovery, "discover">;
  dividendSeries?: Pick<AutomaticDividendSeriesService, "build">;
  creditScreen?: Pick<AutomaticCreditEventScreeningService, "screen">;
  store?: Pick<RiskLabCohortBacktestStore, "get" | "latest" | "acquireLock" | "releaseLock" | "save">;
  now?: () => Date;
}

export class RiskLabCohortBacktestService {
  private readonly resolveFund: (ticker: string) => Promise<PublicFundData | null>;
  private readonly discovery: Pick<CvmEventualDocumentDiscovery, "discover">;
  private readonly dividendSeries: Pick<AutomaticDividendSeriesService, "build">;
  private readonly creditScreen: Pick<AutomaticCreditEventScreeningService, "screen">;
  private readonly store: Pick<RiskLabCohortBacktestStore, "get" | "latest" | "acquireLock" | "releaseLock" | "save">;
  private readonly now: () => Date;

  constructor(dependencies: RiskLabCohortBacktestDependencies = {}) {
    this.resolveFund = dependencies.resolveFund || defaultResolveFund;
    this.discovery = dependencies.discovery || new CvmEventualDocumentDiscovery();
    this.dividendSeries = dependencies.dividendSeries || new AutomaticDividendSeriesService();
    this.creditScreen = dependencies.creditScreen || new AutomaticCreditEventScreeningService();
    this.store = dependencies.store || riskLabCohortBacktestStore;
    this.now = dependencies.now || (() => new Date());
  }

  async getPublicEvidence(): Promise<PublicRiskLabCohortBacktestEvidence | null> {
    const evidence = await this.store.latest();
    return evidence ? { ...evidence, evidenceUrl: "/api/system/risk-lab-cohort-backtest" } : null;
  }

  private async executeCase(item: OutOfSampleValidationCase, runKnownAt: string): Promise<CohortBacktestCaseResult> {
    try {
      const fund = await this.resolveFund(item.ticker);
      if (!fund) throw new Error(`Ticker ${item.ticker} ausente no catálogo oficial.`);
      const record = fund as unknown as Record<string, unknown>;
      const cnpj = digits(record.cnpj || record.CNPJ || record.cnpjFundo || record.cnpj_fundo);
      if (cnpj.length !== 14) throw new Error(`CNPJ inválido para ${item.ticker}.`);

      const years = yearsFor(item, this.now());
      const discoveryResults = [];
      for (const group of chunks(years, 4)) discoveryResults.push(await this.discovery.discover(cnpj, group));
      const discovery = mergeDiscovery(discoveryResults);
      const monthlySeries = await this.dividendSeries.build(item.ticker, discovery.documents);
      const temporal = sequentialDetector(monthlySeries.observations);

      const screens: AutomaticCreditEventScreen[] = [];
      for (const year of years) {
        const interval = yearInterval(item, year, this.now());
        screens.push(await this.creditScreen.screen(
          item.ticker,
          discovery.documents.filter((document) => document.sourceYear === year),
          discovery.sources.filter((source) => source.year === year),
          interval.from,
          interval.until,
        ));
      }
      const screen = aggregateScreens(screens);
      const requiredSources = years.length;
      const fetchedSources = discovery.sources.filter((source) => source.fetched && source.sourceHash).length;
      const sourceCoveragePercent = requiredSources
        ? Math.round(fetchedSources / requiredSources * 10_000) / 100
        : 0;

      const evidence = [
        ...sourceCoverageEvidence(discovery.sources, runKnownAt),
        ...dividendEvidence(monthlySeries.observations),
        ...creditEvidence(screen, discovery.documents, discovery.sources),
      ];
      const dividendEvidenceCount = evidence.filter((entry) => entry.kind === "dividend_notice").length;
      const creditEvidenceCount = evidence.filter((entry) => entry.kind === "credit_event").length;
      const primaryEvidenceComplete = evidence.every(evidenceComplete)
        && evidence.filter((entry) => entry.kind === "source_coverage").length === requiredSources
        && dividendEvidenceCount === monthlySeries.observations.length
        && (screen.matches.length === 0 || creditEvidenceCount === screen.matches.length);
      const end = Date.parse(caseEnd(item, this.now()));
      const lookAheadDetected = temporal.lookAheadDetected || evidence
        .filter((entry) => entry.kind !== "source_coverage")
        .some((entry) => Date.parse(entry.knownAt) > end);
      const classified = outcomeFor(
        item,
        temporal.finalResult,
        screen,
        sourceCoveragePercent === 100,
        primaryEvidenceComplete,
      );
      if (lookAheadDetected) classified.blockers.push("Informação posterior à janela simulada foi detectada.");
      const outcome = lookAheadDetected ? "inconclusive" : classified.outcome;
      const eventAt = screen.verifiedEvents[0]?.knownAt || null;
      const recoveryAt = temporal.finalResult?.recoveryDetectedAt || null;
      const referenceAt = item.role === "severe_deterioration" ? eventAt : recoveryAt;

      return {
        ticker: item.ticker,
        role: item.role,
        status: outcome === "inconclusive" ? "inconclusive" : "validated",
        outcome,
        detectorStatus: temporal.finalResult?.status || null,
        creditScreenStatus: screen.status,
        leadTimeDays: leadTimeDays(temporal.firstSignalAt, referenceAt),
        sourceCoveragePercent,
        primaryEvidenceComplete,
        lookAheadDetected,
        evidence,
        blockers: classified.blockers,
        premiumIntegrated: false,
        notificationsSent: false,
      };
    } catch (error) {
      return {
        ticker: item.ticker,
        role: item.role,
        status: "inconclusive",
        outcome: "inconclusive",
        detectorStatus: null,
        creditScreenStatus: "inconclusive",
        leadTimeDays: null,
        sourceCoveragePercent: 0,
        primaryEvidenceComplete: false,
        lookAheadDetected: false,
        evidence: [],
        blockers: [error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida no caso da coorte."],
        premiumIntegrated: false,
        notificationsSent: false,
      };
    }
  }

  async run(): Promise<RiskLabCohortBacktestEvidence> {
    const existing = await this.store.get(RISK_LAB_COHORT_BACKTEST_RUN_ID);
    if (existing?.status === "passed") return existing;

    const owner = `risk-lab-cohort:${randomUUID()}`;
    const acquired = await this.store.acquireLock(RISK_LAB_COHORT_BACKTEST_RUN_ID, owner);
    if (!acquired) {
      return (await this.store.get(RISK_LAB_COHORT_BACKTEST_RUN_ID))
        || existing
        || Promise.reject(new Error("Backtest da coorte já está em execução."));
    }

    const cohort = loadOutOfSampleCohort(cohortRaw);
    const identityHash = cohortIdentityHash(cohort);
    const startedAt = this.now().toISOString();
    const emptyMetrics = metrics([]);
    const baseEvidence: RiskLabCohortBacktestEvidence = {
      schemaVersion: 1,
      sprint: "3.5",
      runId: RISK_LAB_COHORT_BACKTEST_RUN_ID,
      status: "running",
      releaseCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      deploymentUrl: deploymentUrl(),
      environment: process.env.VERCEL_ENV || null,
      rulesetVersion: "0.1.0",
      cohortId: "risk-lab-credit-oos-v0.1",
      cohortVersion: "0.1.0",
      cohortIdentityHash: identityHash,
      sourceExecutionAllowed: false,
      executionAllowed: false,
      startedAt,
      completedAt: null,
      cases: [],
      metrics: emptyMetrics,
      checks: [],
      blockers: [],
      premiumIntegrated: false,
      notificationsSent: false,
      evidenceHash: null,
    };
    await this.store.save(baseEvidence);

    try {
      const cases: CohortBacktestCaseResult[] = [];
      for (const item of cohort.cases) cases.push(await this.executeCase(item, startedAt));
      const resultMetrics = metrics(cases);
      const rulesetFrozen = PILOT_RISK_RULES.length > 0 && PILOT_RISK_RULES.every((rule) => rule.version === "0.1.0");
      const primaryComplete = cases.every((item) => item.primaryEvidenceComplete);
      const noLookAhead = cases.every((item) => !item.lookAheadDetected);
      const isolated = cases.every((item) => !item.premiumIntegrated && !item.notificationsSent);
      const healthyControlsSafe = cases
        .filter((item) => item.role === "healthy_control")
        .every((item) => item.outcome === "true_negative");
      const checks = [
        check("deployment.production", baseEvidence.environment === "production" && Boolean(baseEvidence.releaseCommit) && Boolean(baseEvidence.deploymentUrl), "O backtest deve executar no deployment exato de Produção.", {
          production: baseEvidence.environment === "production",
          releaseCommitPresent: Boolean(baseEvidence.releaseCommit),
          deploymentUrlPresent: Boolean(baseEvidence.deploymentUrl),
        }),
        check("cohort.identity", identityHash === EXPECTED_COHORT_HASH, "A identidade pré-registrada da coorte deve permanecer imutável.", { identityHash }),
        check("ruleset.frozen", rulesetFrozen, "Todas as regras executadas devem permanecer na versão 0.1.0."),
        check("cohort.six-cases", cases.length === 6, "Os seis fundos pré-registrados devem ser executados.", { total: cases.length }),
        check("evidence.primary-complete", primaryComplete, "Cada observação deve possuir fonte primária, knownAt, URL, trecho, página, hash e versão."),
        check("look-ahead.none", noLookAhead, "Nenhuma observação posterior à data simulada pode influenciar o resultado."),
        check("controls.no-unjustified-alert", healthyControlsSafe, "KNCR11 e KNSC11 não podem receber deterioração injustificada."),
        check("metrics.no-false-positive", resultMetrics.falsePositives === 0, "O backtest não pode encerrar com falso positivo.", { falsePositives: resultMetrics.falsePositives }),
        check("metrics.no-false-negative", resultMetrics.falseNegatives === 0, "O backtest não pode encerrar com falso negativo.", { falseNegatives: resultMetrics.falseNegatives }),
        check("metrics.no-inconclusive", resultMetrics.inconclusiveCases === 0, "Casos ambíguos ou incompletos impedem a conclusão da Sprint.", { inconclusiveCases: resultMetrics.inconclusiveCases }),
        check("metrics.coverage", resultMetrics.coveragePercent === 100, "A coorte inteira deve possuir resultado conclusivo.", { coveragePercent: resultMetrics.coveragePercent }),
        check("isolation.external-effects", isolated, "O backtest não pode integrar Premium nem enviar notificações."),
      ];
      const blockers = [
        ...checks.filter((item) => item.status === "failed").map((item) => item.message),
        ...cases.flatMap((item) => item.blockers.map((message) => `${item.ticker}: ${message}`)),
      ];
      const completedAt = this.now().toISOString();
      const passed = blockers.length === 0;
      const withoutHash: Omit<RiskLabCohortBacktestEvidence, "evidenceHash"> = {
        ...baseEvidence,
        status: passed ? "passed" : "failed",
        executionAllowed: passed,
        completedAt,
        cases,
        metrics: resultMetrics,
        checks,
        blockers,
      };
      const evidence: RiskLabCohortBacktestEvidence = {
        ...withoutHash,
        evidenceHash: hashValue(withoutHash),
      };
      return await this.store.save(evidence);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida no backtest da coorte.";
      const completedAt = this.now().toISOString();
      const failureCheck = check("backtest.execution", false, "O executor falhou antes de concluir todos os gates.", {
        error: message.slice(0, 300),
      });
      const withoutHash: Omit<RiskLabCohortBacktestEvidence, "evidenceHash"> = {
        ...baseEvidence,
        status: "failed",
        completedAt,
        checks: [failureCheck],
        blockers: [failureCheck.message, message.slice(0, 500)],
      };
      return this.store.save({ ...withoutHash, evidenceHash: hashValue(withoutHash) });
    } finally {
      await this.store.releaseLock(RISK_LAB_COHORT_BACKTEST_RUN_ID, owner).catch(() => undefined);
    }
  }
}

export const riskLabCohortBacktestService = new RiskLabCohortBacktestService();
