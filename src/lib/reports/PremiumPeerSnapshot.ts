import { createHash } from "node:crypto";
import {
  PREMIUM_PEER_SCORE_KEYS,
  type PremiumPeerAggregate,
  type PremiumPeerFundInput,
  type PremiumPeerScoreKey,
  type PremiumPeerSnapshot,
} from "@/types/premium-peer-snapshot";

function normalized(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function emptyStats() {
  return Object.fromEntries(
    PREMIUM_PEER_SCORE_KEYS.map((key) => [key, { count: 0, sum: 0 }]),
  ) as Record<PremiumPeerScoreKey, { count: number; sum: number }>;
}

function aggregate(funds: PremiumPeerFundInput[], fundKind: string, segment: string | null): PremiumPeerAggregate {
  const eligible = funds.filter((fund) => (fund.scores?.premium.confidence || 0) >= 25);
  const scoreStats = emptyStats();
  for (const fund of eligible) {
    for (const key of PREMIUM_PEER_SCORE_KEYS) {
      const score = fund.scores?.[key];
      const minimumConfidence = key === "premium" ? 25 : 35;
      if (score && Number.isFinite(score.score) && score.confidence >= minimumConfidence) {
        scoreStats[key].count += 1;
        scoreStats[key].sum += score.score;
      }
    }
  }
  return {
    fundKind,
    segment,
    memberCount: eligible.length,
    scoreStats,
    premiumScores: eligible
      .map((fund) => ({
        ticker: fund.ticker,
        score: fund.scores!.premium.score,
        confidence: fund.scores!.premium.confidence,
      }))
      .sort((left, right) => left.score - right.score || left.ticker.localeCompare(right.ticker)),
  };
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function buildPremiumPeerSnapshot(
  funds: PremiumPeerFundInput[],
  generatedAt = new Date().toISOString(),
): PremiumPeerSnapshot {
  const canonical = funds
    .filter((fund) => /^[A-Z]{4}11$/.test(fund.ticker) && fund.fundKind)
    .map((fund) => ({ ...fund, segment: fund.segment ? normalized(fund.segment) : null }))
    .sort((left, right) => left.ticker.localeCompare(right.ticker));
  const kinds = Array.from(new Set(canonical.map((fund) => fund.fundKind))).sort();
  const groups: PremiumPeerAggregate[] = [];
  const kindGroups: PremiumPeerAggregate[] = [];
  for (const fundKind of kinds) {
    const kindFunds = canonical.filter((fund) => fund.fundKind === fundKind);
    kindGroups.push(aggregate(kindFunds, fundKind, null));
    const segments = Array.from(new Set(kindFunds.map((fund) => fund.segment).filter(Boolean) as string[])).sort();
    for (const segment of segments) {
      groups.push(aggregate(kindFunds.filter((fund) => fund.segment === segment), fundKind, segment));
    }
  }
  const sourceProjection = canonical.map((fund) => ({
    ticker: fund.ticker,
    fundKind: fund.fundKind,
    segment: fund.segment,
    scores: PREMIUM_PEER_SCORE_KEYS.map((key) => {
      const score = fund.scores?.[key];
      return [key, score?.score ?? null, score?.confidence ?? null];
    }),
  }));
  return {
    schemaVersion: 1,
    snapshotVersion: "premium-peer-snapshot-v1",
    generatedAt,
    sourceFundCount: canonical.length,
    sourceHash: stableHash(sourceProjection),
    groups,
    kindGroups,
  };
}

export function assertFreshPremiumPeerSnapshot(
  snapshot: PremiumPeerSnapshot | null,
  now = new Date(),
  maxAgeMs = 48 * 60 * 60_000,
): asserts snapshot is PremiumPeerSnapshot {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.snapshotVersion !== "premium-peer-snapshot-v1") {
    throw new Error("Snapshot de pares Premium ausente ou incompatível.");
  }
  const generatedAt = Date.parse(snapshot.generatedAt);
  if (!Number.isFinite(generatedAt) || generatedAt > now.getTime() + 5 * 60_000 || now.getTime() - generatedAt > maxAgeMs) {
    throw new Error("Snapshot de pares Premium vencido.");
  }
  if (!/^[a-f0-9]{64}$/.test(snapshot.sourceHash)) throw new Error("Hash do snapshot de pares Premium inválido.");
}
