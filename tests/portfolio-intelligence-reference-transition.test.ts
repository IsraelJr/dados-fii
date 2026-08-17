import assert from "node:assert/strict";
import test from "node:test";
import type { PortfolioIntelligenceInput } from "../src/lib/portfolio-intelligence/PortfolioIntelligence";
import { PortfolioIntelligenceService } from "../src/lib/portfolio-intelligence/PortfolioIntelligenceService";
import {
  portfolioIntelligenceReferenceDocumentId,
  resolvePortfolioIntelligenceReferenceTransition,
} from "../src/server/repositories/FirestorePortfolioIntelligenceReferenceRepositoryCore";
import { PortfolioIntelligenceReferenceFactory } from "../src/server/services/PortfolioIntelligenceReferenceFactory";

function input(multiplier = 1): PortfolioIntelligenceInput {
  return Object.freeze({
    snapshots: Object.freeze([
      Object.freeze({ competence: "2026-01", dividends: 47 * multiplier }),
      Object.freeze({ competence: "2026-02", dividends: 450.03 * multiplier }),
      Object.freeze({ competence: "2026-03", dividends: 87.06 * multiplier }),
      Object.freeze({ competence: "2026-04", dividends: 40 * multiplier }),
      Object.freeze({ competence: "2026-05", dividends: 50 * multiplier }),
      Object.freeze({ competence: "2026-06", dividends: 60 * multiplier }),
    ]),
    positions: Object.freeze([
      Object.freeze({ ticker: "AAAA11", quantity: 10, price: 10 * multiplier, estimatedIncome: 8, segment: "Tijolo" }),
    ]),
  });
}

function reference(asOf: string, multiplier = 1) {
  const canonical = input(multiplier);
  const result = new PortfolioIntelligenceService().analyze(canonical, {
    asOf,
    generatedAt: asOf,
  });
  return new PortfolioIntelligenceReferenceFactory().create(result, canonical);
}

test("transição cria baseline e avança previous/current monotonamente", () => {
  const first = reference("2026-08-01T12:00:00.000Z", 1);
  const created = resolvePortfolioIntelligenceReferenceTransition(null, first);
  assert.equal(created.result.previous, null);
  assert.equal(created.result.baselineState, "missing");
  assert.equal(created.nextPair?.current.fingerprint, first.fingerprint);

  const second = reference("2026-08-02T12:00:00.000Z", 1.1);
  const advanced = resolvePortfolioIntelligenceReferenceTransition(created.nextPair!, second);
  assert.equal(advanced.result.previous?.fingerprint, first.fingerprint);
  assert.equal(advanced.nextPair?.previous?.fingerprint, first.fingerprint);
  assert.equal(advanced.nextPair?.current.fingerprint, second.fingerprint);
});

test("replay exato é idempotente e preserva previous/current", () => {
  const previous = reference("2026-08-01T12:00:00.000Z", 1);
  const current = reference("2026-08-02T12:00:00.000Z", 1.1);
  const pair = Object.freeze({ previous, current });
  const replay = resolvePortfolioIntelligenceReferenceTransition(pair, current);

  assert.equal(replay.result.stored, false);
  assert.equal(replay.result.previous?.fingerprint, previous.fingerprint);
  assert.equal(replay.nextPair, null);
  assert.equal(pair.previous.fingerprint, previous.fingerprint);
  assert.equal(pair.current.fingerprint, current.fingerprint);
});

test("referência stale e conflito no mesmo asOf falham fechado", () => {
  const current = reference("2026-08-03T12:00:00.000Z", 1.1);
  const pair = Object.freeze({
    previous: reference("2026-08-02T12:00:00.000Z", 1),
    current,
  });

  assert.throws(
    () => resolvePortfolioIntelligenceReferenceTransition(
      pair,
      reference("2026-08-02T18:00:00.000Z", 1.2),
    ),
    /PORTFOLIO_INCREMENTAL_REFERENCE_STALE/,
  );
  assert.throws(
    () => resolvePortfolioIntelligenceReferenceTransition(
      pair,
      reference("2026-08-03T12:00:00.000Z", 1.3),
    ),
    /PORTFOLIO_INCREMENTAL_REFERENCE_CONFLICT/,
  );
  assert.equal(pair.current.fingerprint, current.fingerprint);
});

test("mesmos dados em asOf posterior avançam a referência e encerram a mudança anterior", () => {
  const current = reference("2026-08-03T12:00:00.000Z", 1);
  const later = reference("2026-08-04T12:00:00.000Z", 1);
  const previous = reference("2026-08-02T12:00:00.000Z", 0.9);
  const transition = resolvePortfolioIntelligenceReferenceTransition(
    Object.freeze({ previous, current }),
    later,
  );

  assert.equal(current.dataFingerprint, later.dataFingerprint);
  assert.equal(current.fingerprint, later.fingerprint);
  assert.equal(transition.result.stored, true);
  assert.equal(transition.result.previous?.fingerprint, current.fingerprint);
  assert.equal(transition.result.current.asOf, later.asOf);
  assert.equal(transition.nextPair?.previous?.asOf, current.asOf);
  assert.equal(transition.nextPair?.current.asOf, later.asOf);
});

test("document id é SHA-256 determinístico e isolado por owner", () => {
  const first = portfolioIntelligenceReferenceDocumentId("owner-a", "default");
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, portfolioIntelligenceReferenceDocumentId("owner-a", "default"));
  assert.notEqual(first, portfolioIntelligenceReferenceDocumentId("owner-b", "default"));
  assert.equal(first.includes("owner-a"), false);
});
