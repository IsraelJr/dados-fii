import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { HealthEngine } from "../src/lib/health/HealthEngine.ts";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { RegulatoryCache } from "../src/lib/regulatory/RegulatoryCache.ts";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { ValidationRunner } from "../src/lib/validation/ValidationRunner.ts";

const now = "2026-07-14T12:00:00.000Z";

function cacheMetrics() {
  return { entries: 1, hits: 8, misses: 2, sets: 1, evictions: 0, expired: 0, hitRate: 80, maxEntries: 500, ttlMs: 300_000 };
}

test("HealthEngine returns Firestore, Parser, QA, Publication, Rollback, Cache and Score", () => {
  const health = new HealthEngine().evaluate({
    generatedAt: now,
    firestore: { ok: true, latencyMs: 12, legacyFundsAvailable: true },
    parsers: [{ parser: "cvm-v2", status: "healthy", successRate: 100, successes: 4, failures: 0, updatedAt: now }],
    latestValidation: {
      id: "run-1",
      status: "completed",
      startedAt: now,
      finishedAt: now,
      durationMs: 100,
      actor: "admin@dadosfii.com",
      totals: { processed: 4, valid: 4, invalid: 0, errors: 0, warnings: 0 },
      healthScore: 100,
      results: [],
      parserHealth: [],
      checks: [],
      coverage: { fii: 2, fiagro: 2, fiInfra: 0, unknown: 0 },
    },
    auditEvents: [
      { id: "publish-1", action: "publish", ticker: "TGAR11", createdAt: now },
      { id: "rollback-1", action: "rollback", ticker: "VGIA11", createdAt: now },
    ],
    fundCache: cacheMetrics(),
    marketCache: { ...cacheMetrics(), maxEntries: 1, ttlMs: 60_000 },
    scoreProbe: { enabled: true, ok: true, version: "1.0.0" },
    ttlMs: 300_000,
    marketTtlMs: 60_000,
    collections: { funds: "RegulatoryFunds" },
  });
  assert.equal(health.ok, true);
  assert.equal(health.status, "healthy");
  assert.deepEqual(Object.keys(health.components), ["firestore", "parser", "qa", "publication", "rollback", "cache", "score"]);
  assert.equal(health.components.firestore.latencyMs, 12);
  assert.equal(health.components.score.score, 100);
});

test("HealthEngine marks a failed mandatory component as down", () => {
  const health = new HealthEngine().evaluate({
    generatedAt: now,
    firestore: { ok: false, latencyMs: 20, legacyFundsAvailable: false, error: "offline" },
    parsers: [],
    latestValidation: null,
    auditEvents: [],
    fundCache: { ...cacheMetrics(), entries: 0 },
    marketCache: { ...cacheMetrics(), entries: 0, maxEntries: 1 },
    scoreProbe: { enabled: true, ok: true, version: "1.0.0" },
    ttlMs: 300_000,
    marketTtlMs: 60_000,
    collections: {},
  });
  assert.equal(health.ok, false);
  assert.equal(health.status, "down");
  assert.equal(health.components.firestore.score, 0);
});

test("RegulatoryCache exposes operational hit, miss and eviction metrics", () => {
  const cache = new RegulatoryCache<number>(10_000, 1);
  cache.set("a", 1);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("missing"), null);
  cache.set("b", 2);
  const stats = cache.stats();
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 1);
  assert.equal(stats.evictions, 1);
  assert.equal(stats.entries, 1);
});

test("ValidationRunner records FII/FIAGRO coverage and structured checks", () => {
  const runner = new ValidationRunner({
    canonicalFrom: (ticker, legacy) => ({
      schemaVersion: 1,
      ticker,
      kind: legacy.kind as "FII" | "FIAGRO",
      currentVersion: 1,
      sources: [{ provider: "test", kind: "regulatory" }],
      raw: legacy,
    }),
    normalizeTicker: (value) => String(value || "").toUpperCase(),
    validateFund: () => [],
    now: () => now,
  });
  const run = runner.complete({
    id: "run-2",
    actor: "admin@dadosfii.com",
    startedAt: now,
    startedMs: Date.now() - 10,
    legacyRecords: [
      { id: "TGAR11", data: { code: "TGAR11", kind: "FII" } },
      { id: "VGIA11", data: { code: "VGIA11", kind: "FIAGRO" } },
    ],
    overlayRecords: [],
    market: { items: [{ code: "TGAR11", price: "100" }], error: null },
    scoreProbe: { enabled: true, ok: true },
  });
  assert.equal(run.status, "completed");
  assert.deepEqual(run.coverage, { fii: 1, fiagro: 1, fiInfra: 0, unknown: 0 });
  assert.equal(run.checks.length, 4);
  assert.ok(run.checks.every((item) => item.status === "passed"));
});

test("ValidationRunner produces an auditable failed run", () => {
  const runner = new ValidationRunner({
    canonicalFrom: () => { throw new Error("unused"); },
    normalizeTicker: (value) => String(value || ""),
    validateFund: () => [],
    now: () => now,
  });
  const run = runner.failed({ id: "failed-1", actor: "admin@dadosfii.com", startedAt: now, startedMs: Date.now(), error: "Firestore indisponível" });
  assert.equal(run.status, "failed");
  assert.equal(run.healthScore, 0);
  assert.equal(run.checks[0].status, "failed");
  assert.equal(run.error, "Firestore indisponível");
});
