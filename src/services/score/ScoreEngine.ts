import { averageAssessedScores, clampScore, scoreSemaphore } from "./ScoreMath.ts";
import type { ScoreEngineInput, ScoreEngineResult } from "./ScoreTypes.ts";

const OVERALL_WEIGHTS = {
  dataQuality: 1,
  documentation: 1,
  governanceEvidence: 1,
  investorBase: 1,
  patrimonial: 1,
  growth: 1,
  stability: 1,
} as const;

const RISK_WEIGHTS = {
  dataQuality: 0.2,
  stability: 0.55,
  patrimonial: 0.25,
} as const;

export function calculateRegulatoryScores(input: ScoreEngineInput): ScoreEngineResult {
  const dataQuality = clampScore(
    (input.coverage * 0.45)
      + (input.qaScore * 0.45)
      - Math.min(input.conflictCount * 10, 45)
      + 10
  );
  const documentation = clampScore(
    Math.min(100, 35 + input.documentsCount * 5 + input.documentTypesCount * 5)
  );
  const governanceEvidence = input.documentsCount === 0
    ? 30
    : clampScore(
        45
          + Math.min(input.documentsCount, 8) * 4
          + Math.min(input.documentTypesCount, 5) * 5
      );
  const investorBase = input.shareholdersChangePct === null
    ? 50
    : clampScore(50 + input.shareholdersChangePct * 2.5);
  const patrimonial = clampScore(
    55
      + (input.netWorthChangePct ?? 0) * 1.5
      + (input.vpCotaChangePct ?? 0) * 4
  );
  const growth = input.historyLength < 2
    ? null
    : clampScore(
        50
          + (input.netWorthChangePct ?? 0) * 2
          + (input.shareholdersChangePct ?? 0) * 1.5
      );
  const stabilityPenalty = Math.abs(input.vpCotaChangePct ?? 0) * 4
    + Math.max(0, -(input.netWorthChangePct ?? 0)) * 2
    + (input.delinquentValue !== null && input.delinquentValue > 0 ? 30 : 0);
  const stability = clampScore(100 - stabilityPenalty);
  const risk = clampScore(100 - (
    dataQuality * RISK_WEIGHTS.dataQuality
      + stability * RISK_WEIGHTS.stability
      + patrimonial * RISK_WEIGHTS.patrimonial
  ));
  const liquidity = null;
  const overall = averageAssessedScores([
    dataQuality,
    documentation,
    governanceEvidence,
    investorBase,
    patrimonial,
    growth,
    stability,
  ]);
  const scores = {
    overall,
    dataQuality,
    documentation,
    governanceEvidence,
    investorBase,
    patrimonial,
    growth,
    stability,
    liquidity,
    risk,
  };

  return {
    version: "regulatory-score-engine-v1",
    methodologyVersion: 1,
    scores,
    semaphore: scoreSemaphore(overall),
    assessedDimensions: Object.entries(scores)
      .filter(([, value]) => value !== null)
      .map(([key]) => key),
    unavailableDimensions: Object.entries(scores)
      .filter(([, value]) => value === null)
      .map(([key]) => key),
    weights: {
      overall: { ...OVERALL_WEIGHTS },
      risk: { ...RISK_WEIGHTS },
    },
  };
}
