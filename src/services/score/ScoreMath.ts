import type { ScoreSemaphore, ScoreValue } from "./ScoreTypes.ts";

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function averageAssessedScores(scores: ScoreValue[]) {
  const assessed = scores.filter((score): score is number => (
    typeof score === "number" && Number.isFinite(score)
  ));
  if (!assessed.length) return 0;
  return clampScore(assessed.reduce((total, score) => total + score, 0) / assessed.length);
}

export function scoreSemaphore(score: number): ScoreSemaphore {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}
