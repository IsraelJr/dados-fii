import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Native strip-types requires explicit extension.
import { FreeReportEngine } from "../src/lib/reports/FreeReportEngine.ts";
// @ts-expect-error Native strip-types requires explicit extension.
import { PremiumReportEngine } from "../src/lib/reports/PremiumReportEngine.ts";
// @ts-expect-error Native strip-types requires explicit extension.
import { ScoreEngine } from "../src/lib/scores/ScoreEngine.ts";
// @ts-expect-error Native strip-types requires explicit extension.
import { ObservabilityEngine } from "../src/lib/observability/ObservabilityEngine.ts";
// @ts-expect-error Native strip-types requires explicit extension.
import { evaluateMonitorAlerts } from "../src/lib/monitor/MonitorRules.ts";
import type { FundAIInsights } from "../src/types/ai-insights.ts";
import type { PublicFundData, SystemHealth, ValidationRun } from "../src/types/regulatory.ts";

const now = "2026-07-14T18:00:00.000Z";

function publicFund(ticker = "TEST11", segment = "Logística", pvp = 0.8): PublicFundData {
  const base = {
    code: ticker,
    ticker,
    fundKind: "FII" as const,
    name: ticker,
    segment,
    manager: "Gestora",
    administrator: "Administradora",
    price: 80,
    pvp,
    dividendYield12m: 10,
    dailyLiquidity: 1_500_000,
    earnings2026: { July: { earnings: 0.8 } },
    regulatoryMeta: { schemaVersion: 1, currentVersion: 1, cache: "miss" as const, sources: [{ provider: "CVM", kind: "regulatory" as const }], validation: { valid: true, issues: [] } },
  };
  return { ...base, scores: new ScoreEngine().calculate(base, now) };
}

function freeReport() {
  return new FreeReportEngine().generate(publicFund(), null, now);
}

function ai(): FundAIInsights {
  return {
    ticker: "TEST11",
    executiveSummary: "Resumo estruturado.",
    changes: [], risks: [], opportunities: [], alerts: [], plainLanguage: "Explicação simples.",
    sources: [{ provider: "CVM", kind: "regulatory" }],
    metadata: { engineVersion: "1", promptVersion: "1", model: "test", fingerprint: "abc", generatedAt: now, cached: false },
  };
}

function health(ok = true): SystemHealth {
  const healthy = { status: "healthy" as const, score: 100, message: "ok", checkedAt: now };
  return {
    ok,
    status: ok ? "healthy" : "down",
    score: ok ? 100 : 35,
    generatedAt: now,
    components: { firestore: ok ? healthy : { ...healthy, status: "down", score: 0, message: "Firestore indisponível" }, parser: healthy, qa: healthy, publication: healthy, rollback: healthy, cache: healthy, score: healthy },
    latestValidation: null,
    parsers: [],
    cache: {
      entries: 1, ttlMs: 1, marketTtlMs: 1,
      funds: { entries: 1, hits: 1, misses: 0, sets: 1, evictions: 0, expired: 0, hitRate: 100, maxEntries: 10, ttlMs: 1 },
      market: { entries: 1, hits: 0, misses: 1, sets: 1, evictions: 0, expired: 0, hitRate: 0, maxEntries: 1, ttlMs: 1 },
    },
    collections: {},
  };
}

function validation(): ValidationRun {
  return {
    id: "run", status: "completed", startedAt: now, finishedAt: now, durationMs: 10, actor: "test",
    totals: { processed: 10, valid: 10, invalid: 0, errors: 0, warnings: 0 }, healthScore: 100,
    results: [], parserHealth: [], checks: [], coverage: { fii: 10, fiagro: 0, fiInfra: 0, unknown: 0 },
  };
}

test("Premium report contains valuation, stress, scenarios, peers, actions and AI", () => {
  const report = new PremiumReportEngine().generate(freeReport(), [publicFund("PEER11", "Logística", 1)], ai(), now);
  assert.equal(report.valuation.assessment, "discount");
  assert.equal(report.valuation.estimatedNavPerShare, 100);
  assert.equal(report.stressTest.length, 3);
  assert.equal(report.scenarios.length, 3);
  assert.equal(report.comparative.peerCount, 1);
  assert.ok(report.recommendations.some((item) => item.category === "valuation"));
  assert.equal(report.aiAnalysis.executiveSummary, "Resumo estruturado.");
  assert.match(report.disclaimer.join(" "), /não constitui recomendação/i);
});

test("Observability aggregates duration, retries, failures and canonical subsystems", async () => {
  const engine = new ObservabilityEngine();
  await engine.track("regulatory.read", async () => "ok");
  await engine.track("regulatory.publish", async () => { throw new Error("publish failed"); }).catch(() => undefined);
  engine.recordRetry("market.ingestion");
  const snapshot = engine.snapshot({
    health: health(), parsers: [{ parser: "cvm", status: "healthy", successRate: 90, successes: 9, failures: 1, updatedAt: now }],
    latestValidation: validation(), auditEvents: [{ id: "p", action: "publish", createdAt: now }],
    fundCache: health().cache.funds, marketCache: health().cache.market, aiCache: { hitRate: 50 }, generatedAt: now,
  });
  assert.equal(snapshot.summary.requests, 2);
  assert.equal(snapshot.summary.failures, 1);
  assert.equal(snapshot.summary.retries, 1);
  assert.equal(snapshot.ingestion.processed, 10);
  assert.equal(snapshot.parser.successRate, 90);
  assert.equal(snapshot.qa.healthScore, 100);
  assert.equal(snapshot.publication.publications, 1);
});

test("Automatic monitor derives critical alerts and resolves to healthy state", () => {
  const alerts = evaluateMonitorAlerts({
    health: health(false),
    parsers: [{ parser: "cvm", status: "degraded", successRate: 60, successes: 6, failures: 4, updatedAt: now }],
    latestValidation: null,
  }, now);
  assert.ok(alerts.some((item) => item.severity === "critical" && item.component === "system"));
  assert.ok(alerts.some((item) => item.component === "firestore"));
  assert.ok(alerts.some((item) => item.component === "cvm"));
  assert.ok(alerts.some((item) => item.code === "validation-missing"));
  assert.equal(new Set(alerts.map((item) => item.fingerprint)).size, alerts.length);

  const healthyAlerts = evaluateMonitorAlerts({ health: health(true), parsers: [], latestValidation: validation() }, now);
  assert.deepEqual(healthyAlerts, []);
});
