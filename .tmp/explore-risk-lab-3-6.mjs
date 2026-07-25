import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const registry = JSON.parse(readFileSync(path.join(ROOT, "src/lib/risk-lab/frozen-cohort-phase-c-v1.json"), "utf8"));
const phaseC = JSON.parse(readFileSync(path.join(ROOT, "docs/production-evidence/risk-lab/cohort-phase-c/backtest-report.json"), "utf8"));
const DAY_MS = 24 * 60 * 60 * 1000;

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function monthIndex(value) {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function contiguous(items) {
  for (let index = 1; index < items.length; index += 1) {
    if (monthIndex(items[index].competenceMonth) !== monthIndex(items[index - 1].competenceMonth) + 1) return false;
  }
  return true;
}

function emptyResult(ticker, observationsUsed) {
  return {
    ticker,
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
    observationsUsed,
  };
}

function detect(rawNotices, recoveryThreshold, creditEvents = []) {
  if (!rawNotices.length) throw new Error("Série vazia.");
  const stressThreshold = 0.8;
  const ticker = rawNotices[0].ticker;
  const notices = [...rawNotices].sort((a, b) => monthIndex(a.competenceMonth) - monthIndex(b.competenceMonth));
  if (notices.length < 9) return emptyResult(ticker, notices.length);
  for (let stressEndIndex = 8; stressEndIndex < notices.length; stressEndIndex += 1) {
    const baseline = notices.slice(stressEndIndex - 8, stressEndIndex - 2);
    const stress = notices.slice(stressEndIndex - 2, stressEndIndex + 1);
    const combined = [...baseline, ...stress];
    if (!contiguous(combined)) continue;
    const baselineMedian = median(baseline.map((item) => item.amountPerShare));
    if (baselineMedian <= 0) continue;
    const stressAverage = average(stress.map((item) => item.amountPerShare));
    if (stressAverage > baselineMedian * stressThreshold + 1e-12) continue;
    const stressDetectedAt = stress.reduce((latest, item) => Date.parse(item.announcedAt) > Date.parse(latest) ? item.announcedAt : latest, stress[0].announcedAt);
    const baseResult = {
      ticker,
      status: "stress_without_recovery",
      baselineMonths: baseline.map((item) => item.competenceMonth),
      baselineMedian: round(baselineMedian),
      stressMonths: stress.map((item) => item.competenceMonth),
      stressAverage: round(stressAverage),
      stressDropPercent: round((1 - stressAverage / baselineMedian) * 100, 2),
      stressDetectedAt,
      recoveryMonths: [],
      recoveryAverage: null,
      recoveryPercentOfBaseline: null,
      recoveryDetectedAt: null,
      blockingCreditEvent: null,
      observationsUsed: notices.length,
    };
    for (let recoveryEndIndex = stressEndIndex + 3; recoveryEndIndex < notices.length; recoveryEndIndex += 1) {
      const recovery = notices.slice(recoveryEndIndex - 2, recoveryEndIndex + 1);
      const fullPath = notices.slice(stressEndIndex - 8, recoveryEndIndex + 1);
      if (!contiguous(fullPath) || !contiguous(recovery)) continue;
      const recoveryAverage = average(recovery.map((item) => item.amountPerShare));
      if (recoveryAverage + 1e-12 < baselineMedian * recoveryThreshold) continue;
      const recoveryDetectedAt = recovery.reduce((latest, item) => Date.parse(item.announcedAt) > Date.parse(latest) ? item.announcedAt : latest, recovery[0].announcedAt);
      const blockingCreditEvent = creditEvents.find((event) => Date.parse(event.knownAt) <= Date.parse(recoveryDetectedAt)) || null;
      return {
        ...baseResult,
        status: blockingCreditEvent ? "recovery_blocked_by_material_credit_event" : "reversible_stress_confirmed",
        recoveryMonths: recovery.map((item) => item.competenceMonth),
        recoveryAverage: round(recoveryAverage),
        recoveryPercentOfBaseline: round(recoveryAverage / baselineMedian * 100, 2),
        recoveryDetectedAt,
        blockingCreditEvent,
      };
    }
    return baseResult;
  }
  return emptyResult(ticker, notices.length);
}

function noticesFor(item) {
  const index = JSON.parse(readFileSync(path.join(ROOT, item.indexPath), "utf8"));
  return index.observationFiles.flatMap((descriptor) => {
    const payload = JSON.parse(readFileSync(path.join(ROOT, descriptor.file), "utf8"));
    return payload.observations.map((observation) => ({
      ticker: observation.ticker,
      competenceMonth: observation.competenceMonth,
      amountPerShare: observation.amountPerShare,
      announcedAt: observation.announcedAt,
      documentId: observation.documentId,
    }));
  });
}

function creditEventFor(ticker) {
  const truth = registry.primaryTruth.find((item) => item.ticker === ticker);
  if (!truth?.materialEvent) return null;
  return { ticker, ...truth.materialEvent };
}

function runTimeline(notices, creditEvent, recoveryThreshold) {
  const asOfValues = [...new Set([...notices.map((item) => item.announcedAt), ...(creditEvent ? [creditEvent.knownAt] : [])])]
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  let firstSignalAt = null;
  let lookAheadDetected = false;
  const transitions = [];
  let previous = "";
  for (const asOf of asOfValues) {
    const knownNotices = notices.filter((item) => Date.parse(item.announcedAt) <= Date.parse(asOf));
    if (!knownNotices.length) continue;
    const knownEvents = creditEvent && Date.parse(creditEvent.knownAt) <= Date.parse(asOf) ? [creditEvent] : [];
    const result = detect(knownNotices, recoveryThreshold, knownEvents);
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
  return {
    firstSignalAt,
    finalResult: detect(notices, recoveryThreshold, creditEvent ? [creditEvent] : []),
    lookAheadDetected,
    transitions,
  };
}

function scoreCase(item, run) {
  const truth = phaseC.cases.find((candidate) => candidate.ticker === item.ticker)?.groundTruth;
  if (!truth || truth.status !== "verified") return { scored: false, correct: null, reason: "ground_truth_inconclusive" };
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
const loaded = registry.cases.map((item) => ({ item, notices: noticesFor(item), creditEvent: creditEventFor(item.ticker) }));
const candidates = thresholds.map((recoveryThreshold) => {
  const cases = loaded.map(({ item, notices, creditEvent }) => {
    const run = runTimeline(notices, creditEvent, recoveryThreshold);
    return {
      ticker: item.ticker,
      role: item.role,
      finalStatus: run.finalResult.status,
      firstSignalAt: run.firstSignalAt,
      stressDetectedAt: run.finalResult.stressDetectedAt,
      recoveryDetectedAt: run.finalResult.recoveryDetectedAt,
      recoveryPercentOfBaseline: run.finalResult.recoveryPercentOfBaseline,
      lookAheadDetected: run.lookAheadDetected,
      transitions: run.transitions,
      ...scoreCase(item, run),
    };
  });
  const scored = cases.filter((item) => item.scored);
  return {
    recoveryThreshold,
    scoredCases: scored.length,
    correct: scored.filter((item) => item.correct).length,
    severeMisses: cases.filter((item) => item.role === "severe_deterioration" && item.scored && !item.correct).length,
    healthyFalseAlerts: cases.filter((item) => item.role === "healthy_control" && item.scored && !item.correct).length,
    reversibleMisses: cases.filter((item) => item.role === "reversible_stress" && item.scored && !item.correct).length,
    lookAheadDetected: cases.some((item) => item.lookAheadDetected),
    cases,
  };
});

function rank(values) {
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
  source: { datasetHash: phaseC.datasetHash, cohortIdentityHash: phaseC.cohortIdentityHash },
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
const summary = {
  selectedRecoveryThreshold: selected.recoveryThreshold,
  selectedCorrect: selected.correct,
  selectedCases: selected.cases.map((item) => ({ ticker: item.ticker, status: item.finalStatus, correct: item.correct, scored: item.scored })),
  folds,
  reportHash: hash(report),
};
console.log(JSON.stringify(summary, null, 2));
