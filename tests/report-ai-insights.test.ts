import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { FreeReportEngine } from "../src/lib/reports/FreeReportEngine.ts";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { ScoreEngine } from "../src/lib/scores/ScoreEngine.ts";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { AIInsightsEngine } from "../src/lib/ai/AIInsightsEngine.ts";
import type { PublicFundData } from "../src/types/regulatory.ts";

const generatedAt = "2026-07-14T16:00:00.000Z";

function fund(): PublicFundData {
  const base = {
    code: "TGAR11",
    ticker: "TGAR11",
    fundKind: "FII" as const,
    name: "TG Ativo Real",
    cnpj: "00.000.000/0001-00",
    segment: "Híbrido",
    manager: "Gestora",
    administrator: "Administradora",
    price: "R$ 100,00",
    pvp: 1.03,
    dividendYield12m: 11,
    dailyLiquidity: 2_000_000,
    earnings2026: {
      February: { earnings: "0,90", payment_date: "15/03/2026" },
      March: { earnings: "1,00", payment_date: "15/04/2026" },
      April: { earnings: "0,95", payment_date: "15/05/2026" },
      May: { earnings: "1,05", payment_date: "15/06/2026" },
      June: { earnings: "1,00", payment_date: "15/07/2026" },
      July: { earnings: "1,10", payment_date: "15/08/2026" },
    },
    regulatoryMeta: {
      schemaVersion: 1,
      currentVersion: 2,
      cache: "miss" as const,
      sources: [{ provider: "CVM", kind: "regulatory" as const, parserVersion: "v2" }],
      validation: { valid: true, issues: [] },
    },
  };
  return { ...base, scores: new ScoreEngine().calculate(base, generatedAt) };
}

function report() {
  return new FreeReportEngine().generate(fund(), {
    ticker: "TGAR11",
    generatedAt,
    items: [{ id: "fact-1", ticker: "TGAR11", type: "material_fact", title: "Fato relevante", occurredAt: generatedAt, source: "CVM", metadata: {} }],
    total: 1,
    counts: { document: 0, event: 0, material_fact: 1, assembly: 0, regulation: 0 },
    appliedTypes: ["document", "event", "material_fact", "assembly", "regulation"],
    nextCursor: null,
    sources: ["CVM"],
  }, generatedAt);
}

test("free report is deterministic and consolidates score, quality and timeline data", () => {
  const first = report();
  const second = report();
  assert.deepEqual(first, second);
  assert.equal(first.ticker, "TGAR11");
  assert.equal(first.market.lastDividend, 1.1);
  assert.equal(first.market.lastDividendReference, "Julho/2026");
  assert.equal(first.analysis.valuation.premiumDiscountPercent, 3);
  assert.equal(first.analysis.valuation.annualizedDistributionOnNavPercent, 13.6);
  assert.equal(first.analysis.income.observations, 6);
  assert.equal(first.analysis.income.average3m, 1.05);
  assert.equal(first.analysis.income.previousAverage3m, 0.95);
  assert.equal(first.analysis.income.changeVsPrevious3mPercent, 10.53);
  assert.equal(first.analysis.income.trend, "rising");
  assert.equal(first.scores?.premium.reasons[0], "Nota composta calculada exclusivamente pelo ScoreEngine.");
  assert.equal(first.dataQuality.validationValid, true);
  assert.equal(first.recentEvents[0].type, "material_fact");
  assert.match(first.disclaimer.join(" "), /não constitui recomendação/i);
});

test("AI Insights Engine returns the six canonical groups and reuses identical input", async () => {
  process.env.ENABLE_AI_INSIGHTS = "true";
  process.env.OPENAI_API_KEY = "test-key";
  let calls = 0;
  let requestBody = "";
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    requestBody = String(init?.body || "");
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        executiveSummary: "Resumo executivo baseado apenas nos dados.",
        changes: ["Um fato relevante foi registrado."],
        risks: ["Ausência do CNPJ oferece risco de transparência.", "Ágio e rendimento devem ser avaliados em conjunto."],
        opportunities: ["Governança é forte, com gestores e administrador identificados e dados sem erros.", "Acompanhar a consistência dos rendimentos."],
        alerts: ["Revisar novos documentos regulatórios."],
        plainLanguage: "O fundo tem dados úteis, mas ainda exige acompanhamento.",
      }),
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const engine = new AIInsightsEngine(fetcher);
  const first = await engine.generateFundInsights(report());
  const second = await engine.generateFundInsights(report());
  assert.equal(calls, 1);
  assert.equal(first.metadata.cached, false);
  assert.equal(second.metadata.cached, true);
  assert.equal(first.ticker, "TGAR11");
  assert.equal(first.changes.length, 1);
  assert.equal(first.risks.length, 1);
  assert.equal(first.opportunities.length, 1);
  assert.equal(first.alerts.length, 1);
  assert.equal(first.metadata.promptVersion, "fund-insights-v3");
  assert.match(requestBody, /premiumDiscountPercent/);
  assert.match(requestBody, /changeVsPrevious3mPercent/);
  assert.doesNotMatch(requestBody, /dataQuality/);
  assert.doesNotMatch(first.risks.join(" "), /CNPJ|transparência/i);
  assert.equal(first.opportunities.length, 1);
  assert.doesNotMatch(first.opportunities.join(" "), /governança é forte|gestor|administrador/i);
  assert.deepEqual(first.sources, [{ provider: "CVM", kind: "regulatory" }]);
  assert.ok(first.plainLanguage);
});

test("AI Insights omits internal registration gaps and zero-confidence scores from the model input", async () => {
  process.env.ENABLE_AI_INSIGHTS = "true";
  process.env.OPENAI_API_KEY = "test-key";
  const incomplete = report();
  incomplete.identity.cnpj = null;
  incomplete.identity.manager = null;
  incomplete.identity.administrator = null;
  incomplete.attentionPoints = [{
    category: "Qualidade",
    title: "Dado regulatório incompleto",
    detail: "CNPJ não informado.",
    level: "fair",
  }, {
    category: "Risco",
    title: "Risco: 0/100",
    detail: "Dados de risco insuficientes. Confiança do cálculo: 0%.",
    level: "critical",
    score: 0,
    confidence: 0,
  }];
  if (incomplete.scores) incomplete.scores.risk = { score: 0, confidence: 0, level: "critical", reasons: ["Dados insuficientes."], metrics: {} };
  let body = "";
  const engine = new AIInsightsEngine(async (_input, init) => {
    body = String(init?.body || "");
    return new Response(JSON.stringify({ output_text: JSON.stringify({
      executiveSummary: "A tendência recente de rendimentos foi avaliada com os dados confirmados.",
      changes: [], risks: [], opportunities: [], alerts: [],
      plainLanguage: "A leitura usa apenas indicadores com evidência disponível.",
    }) }), { status: 200 });
  });
  await engine.generateFundInsights(incomplete);
  assert.doesNotMatch(body, /dataQuality|CNPJ não informado|Dados de risco insuficientes|Confiança do cálculo: 0%/i);
  assert.doesNotMatch(body, /"cnpj":null|"manager":null|"administrator":null/);
  assert.doesNotMatch(body, /"cnpj":|"manager":|"administrator":/);
});

test("AI Insights Engine centralizes generic text generation for legacy reports", async () => {
  process.env.ENABLE_AI_INSIGHTS = "true";
  process.env.OPENAI_API_KEY = "test-key";
  const engine = new AIInsightsEngine(async () => new Response(JSON.stringify({ output_text: "# Relatório\nConteúdo" }), { status: 200 }));
  const result = await engine.generateText({
    purpose: "wallet-risk-report",
    promptVersion: "test-v1",
    input: [{ role: "user", content: "Gere o relatório" }],
    model: "test-model",
  });
  assert.match(result.text, /Relatório/);
  assert.equal(result.metadata.model, "test-model");
  assert.equal(result.metadata.promptVersion, "test-v1");
});
