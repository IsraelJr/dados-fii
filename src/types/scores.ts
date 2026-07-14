export type ScoreLevel = "critical" | "weak" | "fair" | "strong" | "excellent";

export type ScoreMetric = string | number | boolean | null;

export type ScoreResult = {
  score: number;
  confidence: number;
  level: ScoreLevel;
  reasons: string[];
  metrics: Record<string, ScoreMetric>;
};

export type FundScores = {
  engineVersion: string;
  generatedAt: string;
  risk: ScoreResult;
  dividend: ScoreResult;
  governance: ScoreResult;
  growth: ScoreResult;
  liquidity: ScoreResult;
  quality: ScoreResult;
  premium: ScoreResult;
};
