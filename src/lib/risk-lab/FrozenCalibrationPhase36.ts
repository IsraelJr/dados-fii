import { readFileSync } from "node:fs";
import path from "node:path";
import { buildFrozenCohortPhaseC, hashValue } from "./FrozenCohortPhaseC";
import {
  RiskLabRulesetV020,
  loadRiskLabRulesetV020Config,
  type RiskLabDisposition,
  type RiskLabRulesetV020Config,
} from "./RiskLabRulesetV020";
import type {
  DividendStressStatus,
  VerifiedDividendNotice,
  VerifiedMaterialCreditEvent,
} from "../../types/riskLabDividendStress";

export type CalibrationRole = "severe_deterioration" | "healthy_control" | "reversible_stress";
export type CalibrationOutcome =
  | "verified_correct"
  | "verified_false_positive"
  | "verified_false_negative"
  | "inconclusive_unscored";
export type CalibrationStatus = "homologated" | "rejected";

interface RegistryCase {
  ticker: string;
  cnpj: string;
  role: CalibrationRole;
  fromDate: string;
  untilDate: string;
  indexPath: string;
  expectedEvidenceHash: string;
  expectedCombinedObservationsHash: string;
}

interface RegistryTruthCase {
  ticker: string;
  materialEvent?: {
    documentId: string;
    knownAt: string;
    type: VerifiedMaterialCreditEvent["type"];
    sourceUrl: string;
  } | null;
}

interface PhaseCRegistry {
  schemaVersion: 1;
  evaluatedAt: string;
  cases: RegistryCase[];
  primaryTruth: RegistryTruthCase[];
}

interface AnnualObservationDescriptor {
  file: string;
  count: number;
  observationsHash: string;
}

interface CaseIndex {
  schemaVersion: number;
  status: string;
  identity: {
    ticker: string;
    cnpj: string;
    role: CalibrationRole;
    fromDate: string;
    untilDate: string;
  };
  result: {
    pendingDocuments: number;
    conflicts: number;
    selectedMonthlyObservations: number;
  };
  observationFiles: AnnualObservationDescriptor[];
  combinedObservationsHash: string;
  evidenceHash: string;
  [key: string]: unknown;
}

interface RawObservation {
  ticker: string;
  competenceMonth: string;
  amountPerShare: number;
  announcedAt: string;
  documentId: string;
  sourceUrl: string;
  page: number;
  excerpt: string;
  sourceHash: string;
  sourceVersion: string;
  protocolHash: string;
  protocolVersion: number;
}

interface PhaseCGroundTruth {
  status: "verified" | "blocked";
  eventAt: string | null;
  stressAt: string | null;
  recoveryAt: string | null;
}

interface PhaseCCaseResult {
  ticker: string;
  role: CalibrationRole;
  outcome: "true_positive" | "true_negative" | "false_positive" | "false_negative" | "inconclusive";
  groundTruth: PhaseCGroundTruth;
}

export interface CalibrationTimelinePoint {
  asOf: string;
  status: DividendStressStatus;
  disposition: RiskLabDisposition;
  riskAlert: boolean;
  stressDetectedAt: string | null;
  recoveryDetectedAt: string | null;
}

export interface CalibrationCaseResult {
  ticker: string;
  role: CalibrationRole;
  groundTruthStatus: "verified" | "blocked";
  scored: boolean;
  correct: boolean | null;
  outcome: CalibrationOutcome;
  reason: string;
  finalStatus: DividendStressStatus;
  disposition: RiskLabDisposition;
  riskAlert: boolean;
  firstSignalAt: string | null;
  stressDetectedAt: string | null;
  recoveryDetectedAt: string | null;
  recoveryPercentOfBaseline: number | null;
  recoveryDecisionMargin: number | null;
  lookAheadDetected: boolean;
  timeline: CalibrationTimelinePoint[];
  externalEffectsAllowed: false;
}

export interface CalibrationCandidateSummary {
  recoveryThreshold: number;
  verifiedCases: number;
  correctVerified: number;
  severeMisses: number;
  healthyRiskAlerts: number;
  reversibleMisses: number;
  falsePositives: number;
  falseNegatives: number;
  minimumRecoveryDecisionMargin: number | null;
  stable: boolean;
  lookAheadDetected: boolean;
}

export interface CalibrationFoldResult {
  holdoutTicker: string;
  trainingTickers: string[];
  selectedRecoveryThreshold: number;
  selectedCandidateStable: boolean;
  trainingCorrect: number;
  trainingVerified: number;
  holdoutCorrect: boolean;
  holdoutStatus: DividendStressStatus;
  holdoutDisposition: RiskLabDisposition;
}

export interface CalibrationMetrics {
  totalCases: number;
  verifiedCases: number;
  correctVerified: number;
  inconclusiveCases: number;
  verifiedAccuracyPercent: number;
  coveragePercent: number;
  falsePositives: number;
  falseNegatives: number;
  riskAlerts: number;
  informationalRecoveries: number;
  noSignalCases: number;
}

export interface CalibrationCheck {
  id: string;
  status: "passed" | "failed";
  message: string;
  metadata: Record<string, unknown>;
}

export interface FrozenCalibrationPhase36Result {
  schemaVersion: 1;
  phase: "3.6";
  status: CalibrationStatus;
  sourceRulesetVersion: "0.1.0";
  rulesetVersion: "0.2.0";
  datasetId: string;
  datasetVersion: string;
  datasetHash: string;
  cohortIdentityHash: string;
  rulesetConfigHash: string;
  candidateSpaceHash: string;
  selectedParameters: {
    stressThreshold: number;
    recoveryThreshold: number;
    minimumRecoveryDecisionMargin: number;
  };
  cases: CalibrationCaseResult[];
  candidateSummaries: CalibrationCandidateSummary[];
  leaveOneCaseOut: CalibrationFoldResult[];
  metrics: CalibrationMetrics;
  checks: CalibrationCheck[];
  blockers: string[];
  homologationAllowed: boolean;
  premiumIntegrated: false;
  notificationsSent: false;
  evidenceHash: string;
}

const REGISTRY_PATH = "src/lib/risk-lab/frozen-cohort-phase-c-v1.json";
const CONFIG_PATH = "src/lib/risk-lab/risk-lab-ruleset-v0.2.0.json";

function readJson<T>(root: string, file: string): T {
  return JSON.parse(readFileSync(path.resolve(root, file), "utf8")) as T;
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function toVerifiedNotice(observation: RawObservation, reviewedAt: string): VerifiedDividendNotice {
  return {
    ticker: observation.ticker,
    competenceMonth: observation.competenceMonth,
    amountPerShare: observation.amountPerShare,
    announcedAt: observation.announcedAt,
    source: {
      documentId: observation.documentId,
      sourceUrl: observation.sourceUrl,
      sourceType: "primary_regulatory",
      reviewMethod: "automatic_regulatory_validation",
      reviewedBy: "risk-lab-ruleset-v0.2.0",
      reviewedAt,
      page: observation.page || 1,
      excerpt: observation.excerpt,
      sourceHash: observation.sourceHash,
      sourceVersion: observation.sourceVersion,
      protocolHash: observation.protocolHash,
      protocolVersion: observation.protocolVersion,
    },
  };
}

function loadNotices(root: string, registry: PhaseCRegistry, item: RegistryCase) {
  const index = readJson<CaseIndex>(root, item.indexPath);
  assertCondition(index.schemaVersion === 1, `${item.ticker}: schema do índice inválido.`);
  assertCondition(index.status === "complete", `${item.ticker}: caso individual incompleto.`);
  assertCondition(index.identity.ticker === item.ticker, `${item.ticker}: ticker divergente.`);
  assertCondition(index.identity.cnpj === item.cnpj, `${item.ticker}: CNPJ divergente.`);
  assertCondition(index.identity.role === item.role, `${item.ticker}: papel divergente.`);
  assertCondition(index.identity.fromDate === item.fromDate, `${item.ticker}: início da janela divergente.`);
  assertCondition(index.identity.untilDate === item.untilDate, `${item.ticker}: fim da janela divergente.`);
  assertCondition(index.result.pendingDocuments === 0, `${item.ticker}: documentos pendentes.`);
  assertCondition(index.result.conflicts === 0, `${item.ticker}: conflitos pendentes.`);
  const { evidenceHash: _ignoredEvidenceHash, ...indexPayload } = index;
  assertCondition(hashValue(indexPayload) === index.evidenceHash, `${item.ticker}: evidenceHash divergente.`);
  assertCondition(index.evidenceHash === item.expectedEvidenceHash, `${item.ticker}: evidenceHash não corresponde ao registro.`);

  const raw: RawObservation[] = [];
  for (const descriptor of index.observationFiles) {
    const payload = readJson<{ observations: RawObservation[] }>(root, descriptor.file);
    assertCondition(payload.observations.length === descriptor.count, `${descriptor.file}: contagem divergente.`);
    assertCondition(hashValue(payload.observations) === descriptor.observationsHash, `${descriptor.file}: hash divergente.`);
    raw.push(...payload.observations);
  }
  assertCondition(hashValue(raw) === index.combinedObservationsHash, `${item.ticker}: hash combinado divergente.`);
  assertCondition(index.combinedObservationsHash === item.expectedCombinedObservationsHash, `${item.ticker}: hash combinado não corresponde ao registro.`);
  assertCondition(raw.length === index.result.selectedMonthlyObservations, `${item.ticker}: observações divergentes.`);
  return raw.map((observation) => toVerifiedNotice(observation, registry.evaluatedAt));
}

function materialEvents(registry: PhaseCRegistry, ticker: string): VerifiedMaterialCreditEvent[] {
  const truth = registry.primaryTruth.find((item) => item.ticker === ticker);
  if (!truth?.materialEvent) return [];
  return [{
    ticker,
    knownAt: truth.materialEvent.knownAt,
    type: truth.materialEvent.type,
    documentId: truth.materialEvent.documentId,
    sourceUrl: truth.materialEvent.sourceUrl,
    reviewedBy: "risk-lab-ruleset-v0.2.0",
    reviewedAt: registry.evaluatedAt,
  }];
}

function configForCandidate(config: RiskLabRulesetV020Config, recoveryThreshold: number): RiskLabRulesetV020Config {
  return {
    ...config,
    selectedParameters: {
      ...config.selectedParameters,
      recoveryThreshold,
    },
  };
}

function buildTimeline(
  notices: VerifiedDividendNotice[],
  creditEvents: VerifiedMaterialCreditEvent[],
  config: RiskLabRulesetV020Config,
) {
  const ruleset = new RiskLabRulesetV020(config);
  const asOfValues = [...new Set([
    ...notices.map((item) => item.announcedAt),
    ...creditEvents.map((item) => item.knownAt),
  ])].sort((left, right) => Date.parse(left) - Date.parse(right));
  const timeline: CalibrationTimelinePoint[] = [];
  let firstSignalAt: string | null = null;
  let lookAheadDetected = false;
  let previous = "";

  for (const asOf of asOfValues) {
    if (!notices.some((item) => Date.parse(item.announcedAt) <= Date.parse(asOf))) continue;
    const result = ruleset.evaluateAsOf(notices, creditEvents, asOf);
    if (result.window.stressDetectedAt && Date.parse(result.window.stressDetectedAt) > Date.parse(asOf)) lookAheadDetected = true;
    if (result.window.recoveryDetectedAt && Date.parse(result.window.recoveryDetectedAt) > Date.parse(asOf)) lookAheadDetected = true;
    if (!firstSignalAt && result.window.status !== "no_qualifying_stress") {
      firstSignalAt = result.window.stressDetectedAt || asOf;
    }
    const signature = `${result.window.status}|${result.window.stressDetectedAt || ""}|${result.window.recoveryDetectedAt || ""}|${result.disposition}`;
    if (signature !== previous) {
      timeline.push({
        asOf,
        status: result.window.status,
        disposition: result.disposition,
        riskAlert: result.riskAlert,
        stressDetectedAt: result.window.stressDetectedAt,
        recoveryDetectedAt: result.window.recoveryDetectedAt,
      });
      previous = signature;
    }
  }

  const finalEvaluation = ruleset.evaluate(notices, creditEvents);
  const recoveryDecisionMargin = finalEvaluation.window.recoveryPercentOfBaseline === null
    ? null
    : finalEvaluation.window.recoveryPercentOfBaseline / 100 - config.selectedParameters.recoveryThreshold;
  return {
    finalEvaluation,
    firstSignalAt,
    lookAheadDetected,
    recoveryDecisionMargin,
    timeline,
  };
}

function classifyCase(
  item: RegistryCase,
  truth: PhaseCGroundTruth,
  temporal: ReturnType<typeof buildTimeline>,
): Pick<CalibrationCaseResult, "scored" | "correct" | "outcome" | "reason"> {
  if (truth.status !== "verified") {
    return {
      scored: false,
      correct: null,
      outcome: "inconclusive_unscored",
      reason: "Verdade-terreno inconclusiva excluída da otimização e das métricas pontuadas.",
    };
  }
  if (temporal.lookAheadDetected) {
    return {
      scored: true,
      correct: false,
      outcome: "verified_false_negative",
      reason: "Look-ahead detectado.",
    };
  }

  if (item.role === "severe_deterioration") {
    const correct = Boolean(
      temporal.finalEvaluation.riskAlert
      && temporal.firstSignalAt
      && truth.eventAt
      && Date.parse(temporal.firstSignalAt) <= Date.parse(truth.eventAt),
    );
    return {
      scored: true,
      correct,
      outcome: correct ? "verified_correct" : "verified_false_negative",
      reason: correct ? "Deterioração grave preservada antes do evento material." : "Deterioração grave não preservada.",
    };
  }

  if (item.role === "healthy_control") {
    const correct = !temporal.finalEvaluation.riskAlert;
    return {
      scored: true,
      correct,
      outcome: correct ? "verified_correct" : "verified_false_positive",
      reason: correct
        ? `Controle saudável sem alerta de risco; disposição ${temporal.finalEvaluation.disposition}.`
        : "Controle saudável recebeu alerta de risco.",
    };
  }

  const correct = temporal.finalEvaluation.window.status === "reversible_stress_confirmed"
    && temporal.finalEvaluation.window.stressDetectedAt === truth.stressAt
    && Boolean(
      temporal.finalEvaluation.window.recoveryDetectedAt
      && truth.recoveryAt
      && Date.parse(temporal.finalEvaluation.window.recoveryDetectedAt) <= Date.parse(truth.recoveryAt),
    );
  return {
    scored: true,
    correct,
    outcome: correct ? "verified_correct" : "verified_false_negative",
    reason: correct ? "Estresse reversível reproduzido sem alerta de risco persistente." : "Estresse reversível não reproduzido.",
  };
}

function buildCandidateCases(
  registry: PhaseCRegistry,
  phaseCCases: PhaseCCaseResult[],
  noticesByTicker: Map<string, VerifiedDividendNotice[]>,
  eventsByTicker: Map<string, VerifiedMaterialCreditEvent[]>,
  config: RiskLabRulesetV020Config,
): CalibrationCaseResult[] {
  return registry.cases.map((item) => {
    const notices = noticesByTicker.get(item.ticker) || [];
    const events = eventsByTicker.get(item.ticker) || [];
    const truth = phaseCCases.find((candidate) => candidate.ticker === item.ticker)?.groundTruth;
    assertCondition(truth, `${item.ticker}: verdade-terreno da 3.5-C ausente.`);
    const temporal = buildTimeline(notices, events, config);
    const classification = classifyCase(item, truth, temporal);
    return {
      ticker: item.ticker,
      role: item.role,
      groundTruthStatus: truth.status,
      ...classification,
      finalStatus: temporal.finalEvaluation.window.status,
      disposition: temporal.finalEvaluation.disposition,
      riskAlert: temporal.finalEvaluation.riskAlert,
      firstSignalAt: temporal.firstSignalAt,
      stressDetectedAt: temporal.finalEvaluation.window.stressDetectedAt,
      recoveryDetectedAt: temporal.finalEvaluation.window.recoveryDetectedAt,
      recoveryPercentOfBaseline: temporal.finalEvaluation.window.recoveryPercentOfBaseline,
      recoveryDecisionMargin: temporal.recoveryDecisionMargin,
      lookAheadDetected: temporal.lookAheadDetected,
      timeline: temporal.timeline,
      externalEffectsAllowed: false,
    };
  });
}

function summarizeCandidate(
  recoveryThreshold: number,
  cases: CalibrationCaseResult[],
  minimumMargin: number,
  trainingTickers?: Set<string>,
): CalibrationCandidateSummary {
  const scope = cases.filter((item) => item.scored && (!trainingTickers || trainingTickers.has(item.ticker)));
  const margins = scope
    .filter((item) => item.finalStatus === "reversible_stress_confirmed")
    .map((item) => item.recoveryDecisionMargin)
    .filter((value): value is number => typeof value === "number");
  const minimumRecoveryDecisionMargin = margins.length ? Math.min(...margins) : null;
  const severeMisses = scope.filter((item) => item.role === "severe_deterioration" && !item.correct).length;
  const healthyRiskAlerts = scope.filter((item) => item.role === "healthy_control" && !item.correct).length;
  const reversibleMisses = scope.filter((item) => item.role === "reversible_stress" && !item.correct).length;
  return {
    recoveryThreshold,
    verifiedCases: scope.length,
    correctVerified: scope.filter((item) => item.correct).length,
    severeMisses,
    healthyRiskAlerts,
    reversibleMisses,
    falsePositives: scope.filter((item) => item.outcome === "verified_false_positive").length,
    falseNegatives: scope.filter((item) => item.outcome === "verified_false_negative").length,
    minimumRecoveryDecisionMargin,
    stable: !scope.some((item) => item.lookAheadDetected)
      && (minimumRecoveryDecisionMargin === null || minimumRecoveryDecisionMargin + 1e-12 >= minimumMargin),
    lookAheadDetected: scope.some((item) => item.lookAheadDetected),
  };
}

function candidateComparator(sourceRecoveryThreshold: number) {
  return (left: CalibrationCandidateSummary, right: CalibrationCandidateSummary) =>
    Number(right.stable) - Number(left.stable)
    || left.severeMisses - right.severeMisses
    || left.healthyRiskAlerts - right.healthyRiskAlerts
    || left.reversibleMisses - right.reversibleMisses
    || right.correctVerified - left.correctVerified
    || Math.abs(sourceRecoveryThreshold - left.recoveryThreshold) - Math.abs(sourceRecoveryThreshold - right.recoveryThreshold)
    || right.recoveryThreshold - left.recoveryThreshold;
}

function selectCandidate(
  candidateCases: Map<number, CalibrationCaseResult[]>,
  config: RiskLabRulesetV020Config,
  trainingTickers?: Set<string>,
) {
  const summaries = config.candidateSpace.recoveryThresholds.map((threshold) => summarizeCandidate(
    threshold,
    candidateCases.get(threshold) || [],
    config.candidateSpace.minimumRecoveryDecisionMargin,
    trainingTickers,
  ));
  const selected = [...summaries].sort(candidateComparator(0.9))[0];
  assertCondition(selected, "Nenhum candidato de calibração disponível.");
  return { selected, summaries };
}

function calculateMetrics(cases: CalibrationCaseResult[]): CalibrationMetrics {
  const verified = cases.filter((item) => item.scored);
  const correct = verified.filter((item) => item.correct);
  return {
    totalCases: cases.length,
    verifiedCases: verified.length,
    correctVerified: correct.length,
    inconclusiveCases: cases.filter((item) => !item.scored).length,
    verifiedAccuracyPercent: verified.length ? Math.round(correct.length / verified.length * 10_000) / 100 : 0,
    coveragePercent: cases.length ? Math.round(verified.length / cases.length * 10_000) / 100 : 0,
    falsePositives: verified.filter((item) => item.outcome === "verified_false_positive").length,
    falseNegatives: verified.filter((item) => item.outcome === "verified_false_negative").length,
    riskAlerts: cases.filter((item) => item.riskAlert).length,
    informationalRecoveries: cases.filter((item) => item.disposition === "informational_recovery").length,
    noSignalCases: cases.filter((item) => item.disposition === "none").length,
  };
}

function check(id: string, passed: boolean, message: string, metadata: Record<string, unknown> = {}): CalibrationCheck {
  return { id, status: passed ? "passed" : "failed", message, metadata };
}

export function buildFrozenCalibrationPhase36(
  root = process.cwd(),
  configPath = CONFIG_PATH,
): FrozenCalibrationPhase36Result {
  const phaseC = buildFrozenCohortPhaseC(root, REGISTRY_PATH);
  const registry = readJson<PhaseCRegistry>(root, REGISTRY_PATH);
  const config = loadRiskLabRulesetV020Config(root, configPath);
  const rulesetConfigRaw = readJson<unknown>(root, configPath);
  const phaseCCases = phaseC.cases.map((item) => ({
    ticker: item.ticker,
    role: item.role,
    outcome: item.outcome,
    groundTruth: item.groundTruth,
  })) as PhaseCCaseResult[];

  assertCondition(phaseC.datasetHash === config.dataset.hash, "Hash do dataset da 3.5-C divergente.");
  assertCondition(phaseC.cohortIdentityHash === config.dataset.cohortIdentityHash, "Hash da identidade da coorte divergente.");
  assertCondition(phaseC.rulesetVersion === config.sourceRulesetVersion, "Ruleset de origem divergente.");

  const noticesByTicker = new Map<string, VerifiedDividendNotice[]>();
  const eventsByTicker = new Map<string, VerifiedMaterialCreditEvent[]>();
  for (const item of registry.cases) {
    noticesByTicker.set(item.ticker, loadNotices(root, registry, item));
    eventsByTicker.set(item.ticker, materialEvents(registry, item.ticker));
  }

  const candidateCases = new Map<number, CalibrationCaseResult[]>();
  for (const recoveryThreshold of config.candidateSpace.recoveryThresholds) {
    candidateCases.set(
      recoveryThreshold,
      buildCandidateCases(
        registry,
        phaseCCases,
        noticesByTicker,
        eventsByTicker,
        configForCandidate(config, recoveryThreshold),
      ),
    );
  }

  const fullSelection = selectCandidate(candidateCases, config);
  const selectedCases = candidateCases.get(fullSelection.selected.recoveryThreshold) || [];
  const verifiedTickers = selectedCases.filter((item) => item.scored).map((item) => item.ticker);
  const folds: CalibrationFoldResult[] = verifiedTickers.map((holdoutTicker) => {
    const trainingTickers = new Set(verifiedTickers.filter((ticker) => ticker !== holdoutTicker));
    const foldSelection = selectCandidate(candidateCases, config, trainingTickers);
    const holdout = (candidateCases.get(foldSelection.selected.recoveryThreshold) || [])
      .find((item) => item.ticker === holdoutTicker);
    assertCondition(holdout && holdout.scored && typeof holdout.correct === "boolean", `${holdoutTicker}: holdout inválido.`);
    return {
      holdoutTicker,
      trainingTickers: [...trainingTickers],
      selectedRecoveryThreshold: foldSelection.selected.recoveryThreshold,
      selectedCandidateStable: foldSelection.selected.stable,
      trainingCorrect: foldSelection.selected.correctVerified,
      trainingVerified: foldSelection.selected.verifiedCases,
      holdoutCorrect: holdout.correct,
      holdoutStatus: holdout.finalStatus,
      holdoutDisposition: holdout.disposition,
    };
  });

  const metrics = calculateMetrics(selectedCases);
  const originalOutcomes = Object.fromEntries(phaseC.cases.map((item) => [item.ticker, item.outcome]));
  const selectedThresholdMatches = fullSelection.selected.recoveryThreshold === config.selectedParameters.recoveryThreshold;
  const foldsStable = folds.every((item) =>
    item.selectedRecoveryThreshold === config.selectedParameters.recoveryThreshold
    && item.selectedCandidateStable
    && item.holdoutCorrect,
  );
  const mcci = selectedCases.find((item) => item.ticker === "MCCI11");
  const checks = [
    check("source.dataset-hash", phaseC.datasetHash === config.dataset.hash, "O dataset da 3.5-C deve permanecer imutável.", { datasetHash: phaseC.datasetHash }),
    check("source.cohort-hash", phaseC.cohortIdentityHash === config.dataset.cohortIdentityHash, "A identidade da coorte deve permanecer imutável.", { cohortIdentityHash: phaseC.cohortIdentityHash }),
    check("source.performance-preserved", originalOutcomes.KNSC11 === "false_positive" && originalOutcomes.MCCI11 === "inconclusive", "As falhas originais da 3.5-C não podem ser apagadas retrospectivamente.", { originalOutcomes }),
    check("candidate-space.bounded", config.candidateSpace.stressThresholds.length === 1 && config.candidateSpace.recoveryThresholds.length === 10, "O espaço de candidatos deve permanecer limitado.", { candidateCount: config.candidateSpace.recoveryThresholds.length }),
    check("candidate.selected", selectedThresholdMatches, "O parâmetro versionado deve coincidir com a seleção reproduzida.", { selected: fullSelection.selected.recoveryThreshold }),
    check("candidate.margin", fullSelection.selected.stable && (fullSelection.selected.minimumRecoveryDecisionMargin || 0) + 1e-12 >= config.candidateSpace.minimumRecoveryDecisionMargin, "A decisão deve possuir margem mínima de recuperação.", { minimumObserved: fullSelection.selected.minimumRecoveryDecisionMargin }),
    check("validation.leave-one-case-out", foldsStable, "Todos os folds fora da amostra devem selecionar o mesmo parâmetro e acertar o holdout.", { folds }),
    check("performance.verified", metrics.verifiedCases === 5 && metrics.correctVerified === 5 && metrics.falsePositives === 0 && metrics.falseNegatives === 0, "Os cinco casos verificáveis devem ser classificados sem falso positivo ou falso negativo.", { metrics }),
    check("performance.knsc", selectedCases.find((item) => item.ticker === "KNSC11")?.disposition === "informational_recovery", "KNSC11 deve deixar de gerar alerta de risco por regra geral.", {}),
    check("performance.mcci", Boolean(mcci && !mcci.scored && mcci.outcome === "inconclusive_unscored"), "MCCI11 deve permanecer inconclusivo e fora da otimização.", { mcci }),
    check("look-ahead.none", selectedCases.every((item) => !item.lookAheadDetected), "Nenhum caso pode usar informação futura.", {}),
    check("isolation.external-effects", selectedCases.every((item) => item.externalEffectsAllowed === false) && config.policy.externalEffectsAllowed === false, "A Sprint 3.6 não pode habilitar Premium ou notificações.", {}),
  ];
  const blockers = checks.filter((item) => item.status === "failed").map((item) => item.message);
  const status: CalibrationStatus = blockers.length === 0 ? "homologated" : "rejected";
  const candidateSpaceHash = hashValue({
    structure: config.structure,
    candidateSpace: config.candidateSpace,
    selection: config.selection,
    policy: config.policy,
  });
  const withoutHash: Omit<FrozenCalibrationPhase36Result, "evidenceHash"> = {
    schemaVersion: 1,
    phase: "3.6",
    status,
    sourceRulesetVersion: "0.1.0",
    rulesetVersion: "0.2.0",
    datasetId: config.dataset.id,
    datasetVersion: config.dataset.version,
    datasetHash: phaseC.datasetHash,
    cohortIdentityHash: phaseC.cohortIdentityHash,
    rulesetConfigHash: hashValue(rulesetConfigRaw),
    candidateSpaceHash,
    selectedParameters: {
      stressThreshold: config.selectedParameters.stressThreshold,
      recoveryThreshold: config.selectedParameters.recoveryThreshold,
      minimumRecoveryDecisionMargin: config.candidateSpace.minimumRecoveryDecisionMargin,
    },
    cases: selectedCases,
    candidateSummaries: fullSelection.summaries,
    leaveOneCaseOut: folds,
    metrics,
    checks,
    blockers,
    homologationAllowed: status === "homologated",
    premiumIntegrated: false,
    notificationsSent: false,
  };
  return { ...withoutHash, evidenceHash: hashValue(withoutHash) };
}
