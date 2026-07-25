import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dividendStressWindowEngine } from "../src/lib/risk-lab/DividendStressWindowEngine";
import type { VerifiedDividendNotice, VerifiedMaterialCreditEvent } from "../src/types/riskLabDividendStress";

type Role = "severe_deterioration" | "healthy_control" | "reversible_stress";

type RegistryCase = {
  ticker: string;
  cnpj: string;
  role: Role;
  fromDate: string;
  untilDate: string;
  indexPath: string;
};

type TruthCase = {
  ticker: string;
  materialEvent?: {
    documentId: string;
    knownAt: string;
    type: VerifiedMaterialCreditEvent["type"];
    sourceUrl: string;
  } | null;
};

type Registry = {
  evaluatedAt: string;
  cases: RegistryCase[];
  primaryTruth: TruthCase[];
};

type RawObservation = {
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
};

type CaseIndex = {
  observationFiles: Array<{ file: string }>;
};

type FrozenPhaseC = {
  datasetHash: string;
  cohortIdentityHash: string;
  cases: Array<{
    ticker: string;
    role: Role;
    groundTruth: {
      status: "verified" | "blocked";
      eventAt: string | null;
      stressAt: string | null;
      recoveryAt: string | null;
    };
  }>;
};

const ROOT = process.cwd();
const registry = JSON.parse(readFileSync(path.join(ROOT, "src/lib/risk-lab/frozen-cohort-phase-c-v1.json"), "utf8")) as Registry;
const phaseC = JSON.parse(readFileSync(path.join(ROOT, "docs/production-evidence/risk-lab/cohort-phase-c/backtest-report.json"), "utf8")) as FrozenPhaseC;

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function noticesFor(item: RegistryCase): VerifiedDividendNotice[] {
  const index = JSON.parse(readFileSync(path.join(ROOT, item.indexPath), "utf8")) as CaseIndex;
  const raw = index.observationFiles.flatMap((descriptor) => {
    const payload = JSON.parse(readFileSync(path.join(ROOT, descriptor.file), "utf8")) as { observations: RawObservation[] };
    return payload.observations;
  });
  return raw.map((observation) => ({
    ticker: observation.ticker,
    competenceMonth: observation.competenceMonth,
    amountPerShare: observation.amountPerShare,
    announcedAt: observation.announcedAt,
    source: {
      documentId: observation.documentId,
      sourceUrl: observation.sourceUrl,
      sourceType: "primary_regulatory",
      reviewMethod: "automatic_regulatory_validation",
      reviewedBy: "risk-lab-calibration-explorer",
      reviewedAt: registry.evaluatedAt,
      page: observation.page || 1,
      excerpt: observation.excerpt,
      sourceHash: observation.sourceHash,
      sourceVersion: observation.sourceVersion,
      protocolHash: observation.protocolHash,
      protocolVersion: observation.protocolVersion,
    },
  }));
}

function creditEventFor(ticker: string): VerifiedMaterialCreditEvent | null {
  const truth = registry.primaryTruth.find((item) => item.ticker === ticker);
  if (!truth?.materialEvent) return null;
  return {
    ticker,
    knownAt: truth.materialEvent.knownAt,
    type: truth.materialEvent.type,
    documentId: truth.materialEvent.documentId,
    sourceUrl: truth.materialEvent.sourceUrl,
    reviewedBy: "risk-lab-calibration-explorer",
    reviewedAt: registry.evaluatedAt,
  };
}

function runTimeline(notices: VerifiedDividendNotice[], creditEvent: VerifiedMaterialCreditEvent | null, recoveryThreshold: number) {
  const asOfValues = [...new Set([
    ...notices.map((item) => item.announcedAt),
    ...(creditEvent ? [creditEvent.knownAt] : []),
  ])].sort((a, b) => Date.parse(a) - Date.parse(b));
  let firstSignalAt: string | null = null;
  let lookAheadDetected = false;
  const transitions: Array<Record<string, unknown>> = [];
  let previous = "";
  for (const asOf of asOfValues) {
    const knownNotices = notices.filter((item) => Date.parse(item.announcedAt) <= Date.parse(asOf));
    if (knownNotices.length === 0) continue;
    const knownEvents = creditEvent && Date.parse(creditEvent.knownAt) <= Date.parse(asOf) ? [creditEvent] : [];
    const result = dividendStressWindowEngine.detect(knownNotices, {
      stressThreshold: 0.8,
      recoveryThreshold,
      creditEvents: knownEvents,
    });
    if (result.stressDetectedAt && Date.parse(result.stressDetectedAt) > Date.parse(asOf)) lookAheadDetected = true;
    if (result.recoveryDetectedAt && Date.parse(result.recoveryDetectedAt) > Date.parse(asOf)) lookAheadDetected = true;
    if (!firstSignalAt && result.status !== "no_qualifying_stress") firstSignalAt = result.stressDetectedAt || asOf;
    const signature = `${result.status}|${result.stressDetectedAt || ""}|${result.recoveryDetectedAt || ""}`;
    if (signature !== previous) {
      transitions.push({
        asOf,
        status: result.status,
        stressDetectedAt: result.stressDetectedAt,
        recoveryDetectedAt: result.recoveryDetectedAt,
        recoveryPercentOfBaseline: result.recoveryPercentOfBaseline,
      });
      previous = signature;
    }
  }
  const finalResult = dividendStressWindowEngine.detect(notices, {
    stressThreshold: 0.8,
    recoveryThreshold,
    creditEvents: creditEvent ? [creditEvent] : [],
  });
  return { firstSignalAt, finalResult, lookAheadDetected, transitions };
}

function scoreCase(item: RegistryCase, run: ReturnType<typeof runTimeline>) {
  const truth = phaseC.cases.find((candidate) => candidate.ticker === item.ticker)?.groundTruth;
  if (!truth || truth.status !== "verified") {
    return { scored: false, correct: null, reason: "ground_truth_inconclusive" };
  }
  const status = run.finalResult.status;
  const riskAlert = status === "stress_without_recovery" || status === "recovery_blocked_by_material_credit_event";
  if (item.role === "severe_deterioration") {
    const correct = Boolean(riskAlert && run.firstSignalAt && truth.eventAt && Date.parse(run.firstSignalAt) <= Date.parse(truth.eventAt));
    return { scored: true, correct, reason: correct ? "severe_detected_before_event" : "severe_not_preserved" };
  }
  if (item.role === "healthy_control") {
    const correct = !riskAlert;
    return { scored: true, correct, reason: correct ? `healthy_without_risk_alert:${status}` : `healthy_false_alert:${status}` };
  }
  const correct = status === "reversible_stress_confirmed"
    && run.finalResult.stressDetectedAt === truth.stressAt
    && Boolean(run.finalResult.recoveryDetectedAt && truth.recoveryAt && Date.parse(run.finalResult.recoveryDetectedAt) <= Date.parse(truth.recoveryAt));
  return { scored: true, correct, reason: correct ? "reversible_reproduced" : `reversible_not_reproduced:${status}` };
}

const thresholds = Array.from({ length: 21 }, (_, index) => Math.round((0.7 + index * 0.01) * 100) / 100);
const loaded = registry.cases.map((item) => ({
  item,
  notices: noticesFor(item),
  creditEvent: creditEventFor(item.ticker),
}));

const candidates = thresholds.map((recoveryThreshold) => {
  const cases = loaded.map(({ item, notices, creditEvent }) => {
    const run = runTimeline(notices, creditEvent, recoveryThreshold);
    const score = scoreCase(item, run);
    return {
      ticker: item.ticker,
      role: item.role,
      finalStatus: run.finalResult.status,
      firstSignalAt: run.firstSignalAt,
      recoveryDetectedAt: run.finalResult.recoveryDetectedAt,
      recoveryPercentOfBaseline: run.finalResult.recoveryPercentOfBaseline,
      lookAheadDetected: run.lookAheadDetected,
      transitions: run.transitions,
      ...score,
    };
  });
  const scored = cases.filter((item) => item.scored);
  const correct = scored.filter((item) => item.correct).length;
  const severeMisses = cases.filter((item) => item.role === "severe_deterioration" && item.scored && !item.correct).length;
  const healthyFalseAlerts = cases.filter((item) => item.role === "healthy_control" && item.scored && !item.correct).length;
  const reversibleMisses = cases.filter((item) => item.role === "reversible_stress" && item.scored && !item.correct).length;
  return {
    recoveryThreshold,
    scoredCases: scored.length,
    correct,
    severeMisses,
    healthyFalseAlerts,
    reversibleMisses,
    lookAheadDetected: cases.some((item) => item.lookAheadDetected),
    cases,
  };
});

function rank(values: typeof candidates) {
  return [...values].sort((left, right) =>
    left.severeMisses - right.severeMisses
    || left.healthyFalseAlerts - right.healthyFalseAlerts
    || left.reversibleMisses - right.reversibleMisses
    || right.correct - left.correct
    || Math.abs(0.9 - left.recoveryThreshold) - Math.abs(0.9 - right.recoveryThreshold)
    || right.recoveryThreshold - left.recoveryThreshold,
  );
}

const verifiedTickers = phaseC.cases.filter((item) => item.groundTruth.status === "verified").map((item) => item.ticker);
const folds = verifiedTickers.map((holdout) => {
  const training = candidates.map((candidate) => {
    const trainingCases = candidate.cases.filter((item) => item.ticker !== holdout && item.scored);
    return {
      ...candidate,
      correct: trainingCases.filter((item) => item.correct).length,
      severeMisses: trainingCases.filter((item) => item.role === "severe_deterioration" && !item.correct).length,
      healthyFalseAlerts: trainingCases.filter((item) => item.role === "healthy_control" && !item.correct).length,
      reversibleMisses: trainingCases.filter((item) => item.role === "reversible_stress" && !item.correct).length,
    };
  });
  const selected = rank(training)[0];
  const holdoutCase = selected.cases.find((item) => item.ticker === holdout);
  return {
    holdout,
    selectedRecoveryThreshold: selected.recoveryThreshold,
    holdoutCorrect: holdoutCase?.correct ?? null,
    holdoutStatus: holdoutCase?.finalStatus ?? null,
    trainingCorrect: selected.correct,
  };
});

const selected = rank(candidates)[0];
const report = {
  schemaVersion: 1,
  phase: "3.6-exploration",
  source: {
    datasetHash: phaseC.datasetHash,
    cohortIdentityHash: phaseC.cohortIdentityHash,
  },
  fixedStructure: {
    baselineMonths: 6,
    stressMonths: 3,
    recoveryMonths: 3,
    stressThreshold: 0.8,
    candidateRecoveryThresholds: thresholds,
    healthyPolicy: "reversible_without_material_event_is_informational_not_risk_alert",
    inconclusivePolicy: "excluded_from_optimization_and_scored_metrics",
  },
  selected,
  leaveOneCaseOut: folds,
  candidates,
};

mkdirSync(path.join(ROOT, ".tmp"), { recursive: true });
writeFileSync(path.join(ROOT, ".tmp/risk-lab-3-6-exploration.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  selectedRecoveryThreshold: selected.recoveryThreshold,
  selectedCorrect: selected.correct,
  selectedCases: selected.cases.map((item) => ({ ticker: item.ticker, status: item.finalStatus, correct: item.correct, scored: item.scored })),
  folds,
  reportHash: hash(report),
}, null, 2));
