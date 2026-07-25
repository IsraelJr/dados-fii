export type AIInsightsContent = {
  executiveSummary: string;
  changes: string[];
  risks: string[];
  opportunities: string[];
  alerts: string[];
  plainLanguage: string;
};

export type AIInsightsMetadata = {
  engineVersion: string;
  promptVersion: string;
  model: string;
  fingerprint: string;
  generatedAt: string;
  cached: boolean;
};

export type FundAIInsights = AIInsightsContent & {
  ticker: string;
  sources: Array<{ provider: string; kind: string }>;
  metadata: AIInsightsMetadata;
};

export type PremiumAIInsights = {
  ticker: string;
  executiveSummary: string;
  differentiatedInsight: string;
  portfolioReading: string;
  peerReading: string;
  riskLabReading: string;
  dataQualityReading: string;
  managerModeConclusion: string;
  positiveTriggers: string[];
  negativeTriggers: string[];
  monitoringTriggers: string[];
  plainLanguage: string;
  sources: Array<{ provider: string; kind: string }>;
  metadata: AIInsightsMetadata;
};

export type AITextMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AITextGeneration = {
  text: string;
  metadata: AIInsightsMetadata;
};
