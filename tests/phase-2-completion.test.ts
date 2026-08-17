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
// @ts-expect-error Native strip-types requires explicit extension.
import { calculatePremiumDiscountPercent, deriveFiiRiskData } from "../src/lib/fiiDerivedData.ts";
// @ts-expect-error Native strip-types requires explicit extension.
import { applyOfficialFundReference } from "../src/lib/regulatory/OfficialFundReferences.ts";
import type { PremiumAIInsights } from "../src/types/ai-insights.ts";
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

function ai(): PremiumAIInsights {
  return {
    ticker: "TEST11",
    executiveSummary: "Resumo estruturado.",
    differentiatedInsight: "Leitura combinada.",
    portfolioReading: "Impacto da posição.",
    peerReading: "Contexto da amostra.",
    riskLabReading: "Leitura histórica indisponível nesta fixture.",
    dataQualityReading: "Qualidade suficiente para o teste.",
    managerModeConclusion: "Ação restrita a monitoramento.",
    positiveTriggers: [],
    negativeTriggers: [],
    monitoringTriggers: ["Acompanhar a variação do rendimento."],
    plainLanguage: "Explicação simples.",
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
  assert.equal(report.comparative.percentile, null);
  assert.equal(report.comparative.sampleReliable, false);
  assert.match(report.comparative.explanation, /pelo menos 5/i);
  assert.equal(report.portfolioImpact.available, false);
  assert.ok(report.scenarios.every((item) => item.explanation.length > 40));
  assert.ok(report.recommendations.some((item) => item.category === "valuation"));
  assert.ok(!report.recommendations.some((item) => item.category === "governança"));
  assert.doesNotMatch(report.recommendations.map((item) => item.action).join(" "), /completar evidências/i);
  assert.equal(report.aiAnalysis.executiveSummary, "Resumo estruturado.");
  assert.match(report.disclaimer.join(" "), /não constitui recomendação/i);
});

test("Premium report translates scenarios and percentile into the user's portfolio", () => {
  const peers = ["PAAA11", "PAAB11", "PAAC11", "PAAD11", "PAAE11"]
    .map((ticker) => publicFund(ticker, "Logística", 1));
  const target = publicFund();
  const other = { ...publicFund("OUTR11"), price: 20 };
  const report = new PremiumReportEngine().generate(freeReport(), peers, ai(), now, [
    { ticker: "TEST11", quotas: 10, fund: target },
    { ticker: "OUTR11", quotas: 10, fund: other },
  ]);

  assert.equal(report.comparative.percentile, 100);
  assert.equal(report.comparative.sampleReliable, true);
  assert.match(report.comparative.explanation, /não mede rentabilidade futura/i);
  assert.equal(report.portfolioImpact.available, true);
  assert.equal(report.portfolioImpact.currentPositionValue, 800);
  assert.equal(report.portfolioImpact.portfolioValue, 1000);
  assert.equal(report.portfolioImpact.portfolioWeightPercent, 80);
  const adverse = report.portfolioImpact.scenarios.find((item) => item.id === "adverse");
  assert.equal(adverse?.projectedPositionValue, 680);
  assert.equal(adverse?.positionValueChange, -120);
  assert.equal(adverse?.projectedMonthlyIncome, 6.4);
  assert.equal(adverse?.monthlyIncomeChange, -1.6);
});

test("valuation ignores corrupted derived fields and recovers P/VP from equity and shares", () => {
  const derived = deriveFiiRiskData({
    price: "R$ 9,72",
    pvp: 1_812_047_861.05,
    vpCota: 0,
    netWorth: 2.3,
    equityValue: "R$ 4.111.884.081",
    numberShares: 437_325_297,
  }, { asOf: "2026-08-10" });
  assert.equal(derived.netWorth, 4_111_884_081);
  assert.equal(derived.vpCota, 9.4023);
  assert.equal(derived.pvp, 1.0338);

  const report = new FreeReportEngine().generate(publicFund("MXRF11", "Recebíveis", 1_812_047_861.05), null, now);
  assert.equal(report.market.pvp, null);
});

test("VGIA11 uses the official reference and rejects the inconsistent legacy P/VP", () => {
  const corrected = applyOfficialFundReference("VGIA11", {
    price: 9.58,
    pvp: 0.05,
    equityValuePerShare: 203.79,
  });
  const derived = deriveFiiRiskData(corrected, { asOf: "2026-08-10" });

  assert.equal(corrected.cnpj, "41.081.088/0001-09");
  assert.equal(derived.vpCota, 9.5);
  assert.equal(derived.pvp, 1.0084);
  assert.equal(calculatePremiumDiscountPercent(9.58, derived.vpCota), 0.8421);
});

test("MXRF11 receives the official CVM registration without overwriting valid market valuation", () => {
  const corrected = applyOfficialFundReference("MXRF11", { price: 10.5, pvp: 1.03273 });

  assert.equal(corrected.cnpj, "97.521.225/0001-25");
  assert.equal(corrected.corporateName, "MAXI RENDA FUNDO DE INVESTIMENTO IMOBILIÁRIO - FII - RESPONSABILIDADE LIMITADA");
  assert.equal(corrected.manager, "XP VISTA ASSET MANAGEMENT LTDA.");
  assert.equal(corrected.administrator, "BTG PACTUAL SERVIÇOS FINANCEIROS S/A DTVM");
  assert.equal(corrected.pvp, 1.03273);
  assert.equal(corrected.vpCota, undefined);
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
