export type ScoreValue = number | null;

export type ScoreSemaphore = "green" | "yellow" | "red";

export type ScoreEngineInput = {
  historyLength: number;
  coverage: number;
  conflictCount: number;
  qaScore: number;
  documentsCount: number;
  documentTypesCount: number;
  netWorthChangePct: number | null;
  shareholdersChangePct: number | null;
  vpCotaChangePct: number | null;
  delinquentValue: number | null;
};

export type RegulatoryScores = {
  overall: number;
  dataQuality: number;
  documentation: number;
  governanceEvidence: number;
  investorBase: number;
  patrimonial: number;
  growth: ScoreValue;
  stability: number;
  liquidity: ScoreValue;
  risk: number;
};

export type ScoreEngineResult = {
  version: "regulatory-score-engine-v1";
  methodologyVersion: 1;
  scores: RegulatoryScores;
  semaphore: ScoreSemaphore;
  assessedDimensions: string[];
  unavailableDimensions: string[];
  weights: {
    overall: Record<string, number>;
    risk: Record<string, number>;
  };
};
