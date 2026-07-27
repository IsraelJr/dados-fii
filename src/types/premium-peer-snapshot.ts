import type { FundScores } from "@/types/scores";

export const PREMIUM_PEER_SCORE_KEYS = [
  "risk",
  "dividend",
  "governance",
  "growth",
  "liquidity",
  "quality",
  "premium",
] as const;

export type PremiumPeerScoreKey = typeof PREMIUM_PEER_SCORE_KEYS[number];

export type PremiumPeerScoreStats = {
  count: number;
  sum: number;
};

export type PremiumPeerAggregate = {
  fundKind: string;
  segment: string | null;
  memberCount: number;
  scoreStats: Record<PremiumPeerScoreKey, PremiumPeerScoreStats>;
  premiumScores: Array<{ ticker: string; score: number; confidence: number }>;
};

export type PremiumPeerSnapshot = {
  schemaVersion: 1;
  snapshotVersion: "premium-peer-snapshot-v1";
  generatedAt: string;
  sourceFundCount: number;
  sourceHash: string;
  groups: PremiumPeerAggregate[];
  kindGroups: PremiumPeerAggregate[];
};

export type PremiumPeerFundInput = {
  ticker: string;
  fundKind: string;
  segment: string | null;
  scores?: FundScores;
};
