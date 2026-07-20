import { createHash } from "node:crypto";
import type {
  AutomaticCreditEventScreen,
  AutomaticMonthlySeries,
  AutomaticSourceSummary,
} from "@/types/riskLabAutomatic";
import type {
  CohortGroundTruth,
  CohortPrimaryEvidence,
  CohortStructuredBlocker,
} from "@/types/riskLabCohortBacktest";
import type { VerifiedDividendNotice } from "@/types/riskLabDividendStress";
import type { OutOfSampleValidationCase } from "@/types/riskLabValidation";

const STRESS_THRESHOLD = 0.8;
const RECOVERY_THRESHOLD = 0.9;
const EPSILON = 1e-12;

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

function monthIndex(value: string) {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function contiguous(items: VerifiedDividendNotice[]) {
  return items.every((item, index) => index === 0 || monthIndex(item.competenceMonth) === monthIndex(items[index - 1].competenceMonth) + 1);
}

function latestKnownAt(items: VerifiedDividendNotice[]) {
  return items.reduce(
    (latest, item) => Date.parse(item.announcedAt) > Date.parse(latest) ? item.announcedAt : latest,
    items[0].announcedAt,
  );
}

/**
 * Referência independente do detector sequencial. Usa somente a definição
 * pré-registrada da coorte sobre a série primária completa.
 */
export function derivePrimaryStressTruth(raw: VerifiedDividendNotice[]) {
  const observations = [...raw].sort((left, right) => monthIndex(left.competenceMonth) - monthIndex(right.competenceMonth));
  if (observations.length < 9) return { stressAt: null, recoveryAt: null };

  for (let stressEndIndex = 8; stressEndIndex < observations.length; stressEndIndex += 1) {
    const baseline = observations.slice(stressEndIndex - 8, stressEndIndex - 2);
    const stress = observations.slice(stressEndIndex - 2, stressEndIndex + 1);
    if (!contiguous([...baseline, ...stress])) continue;
    const baselineMedian = median(baseline.map((item) => item.amountPerShare));
    if (baselineMedian <= 0) continue;
    const stressAverage = average(stress.map((item) => item.amountPerShare));
    if (stressAverage - baselineMedian * STRESS_THRESHOLD > EPSILON) continue;

    const stressAt = latestKnownAt(stress);
    for (let recoveryEndIndex = stressEndIndex + 3; recoveryEndIndex < observations.length; recoveryEndIndex += 1) {
      const recovery = observations.slice(recoveryEndIndex - 2, recoveryEndIndex + 1);
      const fullPath = observations.slice(stressEndIndex - 8, recoveryEndIndex + 1);
      if (!contiguous(fullPath) || !contiguous(recovery)) continue;
      const recoveryAverage = average(recovery.map((item) => item.amountPerShare));
      if (baselineMedian * RECOVERY_THRESHOLD - recoveryAverage > EPSILON) continue;
      return { stressAt, recoveryAt: latestKnownAt(recovery) };
    }
    return { stressAt, recoveryAt: null };
  }
  return { stressAt: null, recoveryAt: null };
}

function blocker(
  code: string,
  stage: CohortStructuredBlocker["stage"],
  message: string,
  sourceUrl: string | null = null,
  year: number | null = null,
): CohortStructuredBlocker {
  return { code, stage, message, sourceUrl, year };
}

export interface CohortPrimaryVerificationInput {
  item: OutOfSampleValidationCase;
  monthlySeries: AutomaticMonthlySeries;
  screen: AutomaticCreditEventScreen;
  sources: AutomaticSourceSummary[];
  requiredYears: number[];
  sourceCoveragePercent: number;
  primaryEvidenceComplete: boolean;
  evidence: CohortPrimaryEvidence[];
}

export class CohortPrimaryVerificationService {
  verify(input: CohortPrimaryVerificationInput): CohortGroundTruth {
    const {
      item,
      monthlySeries,
      screen,
      sources,
      requiredYears,
      sourceCoveragePercent,
      primaryEvidenceComplete,
      evidence,
    } = input;
    const blockers: CohortStructuredBlocker[] = [];

    for (const year of requiredYears) {
      const source = sources.find((candidate) => candidate.year === year);
      if (!source?.fetched || !source.sourceHash) {
        blockers.push(blocker(
          "PRIMARY_SOURCE_YEAR_UNAVAILABLE",
          "source",
          `Fonte oficial anual ${year} não foi obtida com hash verificável.`,
          source?.sourceUrl || null,
          year,
        ));
      }
    }

    if (sourceCoveragePercent !== 100) {
      blockers.push(blocker(
        "PRIMARY_SOURCE_COVERAGE_INCOMPLETE",
        "source",
        `Cobertura anual das fontes oficiais em ${sourceCoveragePercent}%.`,
      ));
    }
    if (!primaryEvidenceComplete) {
      blockers.push(blocker(
        "PRIMARY_EVIDENCE_INCOMPLETE",
        "source",
        "Há observação sem knownAt, URL, trecho, página, hash ou versão verificável.",
      ));
    }
    if (monthlySeries.status !== "ready" || monthlySeries.longestContiguousSequence < 9) {
      blockers.push(blocker(
        "DIVIDEND_SERIES_NOT_READY",
        "dividend-series",
        `Série primária insuficiente: status ${monthlySeries.status}, sequência contínua ${monthlySeries.longestContiguousSequence}.`,
      ));
    }
    if (screen.status === "inconclusive") {
      blockers.push(blocker(
        "CREDIT_SCREEN_INCONCLUSIVE",
        "credit-screen",
        `Triagem de crédito inconclusiva com ${screen.ambiguousDocuments.length} documento(s) crítico(s) ambíguo(s).`,
        screen.ambiguousDocuments[0]?.sourceUrl || null,
      ));
    }

    const eventAt = [...screen.verifiedEvents]
      .sort((left, right) => Date.parse(left.knownAt) - Date.parse(right.knownAt))[0]?.knownAt || null;
    const stressTruth = derivePrimaryStressTruth(monthlySeries.observations);

    if (item.role === "severe_deterioration" && !eventAt) {
      blockers.push(blocker(
        "MATERIAL_EVENT_NOT_VERIFIED",
        "ground-truth",
        "O caso grave não possui evento material confirmado em fonte primária na janela pré-registrada.",
      ));
    }

    if (item.role === "healthy_control" && screen.status === "material_event_confirmed") {
      blockers.push(blocker(
        "HEALTHY_CONTROL_HAS_MATERIAL_EVENT",
        "ground-truth",
        "O controle saudável possui evento material confirmado e não pode manter esse rótulo.",
        screen.verifiedEvents[0]?.sourceUrl || null,
      ));
    }

    if (item.role === "reversible_stress") {
      if (screen.status === "material_event_confirmed") {
        blockers.push(blocker(
          "REVERSIBLE_CASE_HAS_MATERIAL_EVENT",
          "ground-truth",
          "Evento material confirmado contradiz o rótulo pré-registrado de estresse reversível.",
          screen.verifiedEvents[0]?.sourceUrl || null,
        ));
      }
      if (!stressTruth.stressAt || !stressTruth.recoveryAt) {
        blockers.push(blocker(
          "REVERSIBLE_WINDOW_NOT_VERIFIED",
          "ground-truth",
          "A série primária completa não confirmou estresse de 20% seguido de recuperação a 90%.",
        ));
      }
    }

    const identity = {
      ticker: item.ticker,
      role: item.role,
      eventAt: item.role === "severe_deterioration" ? eventAt : null,
      stressAt: item.role === "reversible_stress" ? stressTruth.stressAt : null,
      recoveryAt: item.role === "reversible_stress" ? stressTruth.recoveryAt : null,
      sourceCoveragePercent,
      dividendObservationCount: monthlySeries.observations.length,
      longestContiguousSequence: monthlySeries.longestContiguousSequence,
      evidence: evidence.map((entry) => ({
        observationId: entry.observationId,
        knownAt: entry.knownAt,
        sourceHash: entry.sourceHash,
        protocolHash: entry.protocolHash,
      })),
      blockers,
    };

    return {
      status: blockers.length === 0 ? "verified" : "blocked",
      eventAt: item.role === "severe_deterioration" ? eventAt : null,
      stressAt: item.role === "reversible_stress" ? stressTruth.stressAt : null,
      recoveryAt: item.role === "reversible_stress" ? stressTruth.recoveryAt : null,
      sourceCoveragePercent,
      dividendObservationCount: monthlySeries.observations.length,
      longestContiguousSequence: monthlySeries.longestContiguousSequence,
      verificationHash: hashValue(identity),
      evidence,
      blockers,
    };
  }
}

export const cohortPrimaryVerificationService = new CohortPrimaryVerificationService();
