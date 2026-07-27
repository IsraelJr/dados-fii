import assert from "node:assert/strict";
import test from "node:test";
import {
  assertFreshPremiumPeerSnapshot,
  buildPremiumPeerSnapshot,
} from "../src/lib/reports/PremiumPeerSnapshot";
import type { FundScores, ScoreResult } from "../src/types/scores";

function score(value: number, confidence = 80): ScoreResult {
  return { score: value, confidence, level: "strong", reasons: [], metrics: {} };
}

function scores(value: number, confidence = 80): FundScores {
  return {
    engineVersion: "test",
    generatedAt: "2026-07-27T00:00:00.000Z",
    risk: score(value, confidence),
    dividend: score(value, confidence),
    governance: score(value, confidence),
    growth: score(value, confidence),
    liquidity: score(value, confidence),
    quality: score(value, confidence),
    premium: score(value, confidence),
  };
}

test("snapshot materializa grupos e estatísticas determinísticas em um artefato", () => {
  const snapshot = buildPremiumPeerSnapshot([
    { ticker: "MXRF11", fundKind: "fii", segment: "Papel", scores: scores(60) },
    { ticker: "BODB11", fundKind: "fii", segment: "Papel", scores: scores(80) },
    { ticker: "HGLG11", fundKind: "fii", segment: "Logística", scores: scores(70) },
    { ticker: "VGIA11", fundKind: "fiagro", segment: "Agro", scores: scores(50) },
    { ticker: "KNCA11", fundKind: "fiagro", segment: "Agro", scores: scores(40, 20) },
  ], "2026-07-27T00:00:00.000Z");

  assert.equal(snapshot.sourceFundCount, 5);
  assert.match(snapshot.sourceHash, /^[a-f0-9]{64}$/);
  const paper = snapshot.groups.find((group) => group.fundKind === "fii" && group.segment === "papel");
  assert.equal(paper?.memberCount, 2);
  assert.deepEqual(paper?.scoreStats.premium, { count: 2, sum: 140 });
  const fiagro = snapshot.kindGroups.find((group) => group.fundKind === "fiagro");
  assert.equal(fiagro?.memberCount, 1, "fundos com confiança Premium abaixo de 25 não entram nos pares");
});

test("snapshot ausente, futuro ou vencido falha fechado", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");
  const current = buildPremiumPeerSnapshot([], "2026-07-27T11:00:00.000Z");
  assert.doesNotThrow(() => assertFreshPremiumPeerSnapshot(current, now));
  assert.throws(() => assertFreshPremiumPeerSnapshot(null, now), /ausente/);
  assert.throws(
    () => assertFreshPremiumPeerSnapshot({ ...current, generatedAt: "2026-07-29T12:00:00.000Z" }, now),
    /vencido/,
  );
  assert.throws(
    () => assertFreshPremiumPeerSnapshot({ ...current, generatedAt: "2026-07-24T00:00:00.000Z" }, now),
    /vencido/,
  );
});
