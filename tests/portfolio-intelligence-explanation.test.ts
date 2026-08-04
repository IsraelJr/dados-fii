import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import {
  PORTFOLIO_EXPLANATION_DISCLAIMER,
  buildDeterministicPortfolioExplanation,
  derivePortfolioExplanationConfidence,
  normalizePortfolioExplanationOutput,
  sanitizePortfolioExplanationInput,
} from "../src/lib/portfolio-intelligence/PortfolioIntelligenceExplanation.ts";
import type { AIInsightsMetadata } from "../src/types/ai-insights.ts";

const metadata: AIInsightsMetadata = {
  engineVersion: "test-engine",
  promptVersion: "portfolio-intelligence-explanation-v1",
  model: "test-model",
  fingerprint: "abc123",
  generatedAt: "2026-08-04T15:00:00.000Z",
  cached: false,
};

function rawResult() {
  return {
    policyVersion: "1.0.0",
    generatedAt: "2026-08-04T15:00:00.000Z",
    asOf: "2026-08-04T15:00:00.000Z",
    metrics: {
      income: { latestIncome: 120, blockVariationPercent: -8 },
      portfolio: { validPatrimonyTotal: 5_000 },
    },
    dataQuality: {
      state: "partial",
      reasons: [{
        code: "MISSING_SEGMENTS",
        conclusion: "segments",
        impact: "reduced_confidence",
        message: "Parte das posições não possui segmento confirmado.",
        evidence: { missing: 1 },
      }],
      missingFields: ["segment"],
      confidence: { trend: "high", concentration: "high", segments: "medium", income: "high" },
    },
    signals: [{
      code: "RENDA_EM_QUEDA",
      severity: "warning",
      title: "A renda recente recuou",
      summary: "A média recente ficou abaixo do bloco anterior.",
      confidence: "high",
      evidence: {
        previousAverage: 130,
        recentAverage: 120,
        variationPercent: -7.69,
      },
      policyVersion: "1.0.0",
    }, {
      code: "CONCENTRACAO_ELEVADA",
      severity: "attention",
      title: "A carteira está concentrada",
      summary: "Poucas posições representam parcela relevante do patrimônio conhecido.",
      confidence: "medium",
      evidence: { largestTicker: "TGAR11", largestSharePercent: 44.27 },
      policyVersion: "1.0.0",
    }],
    warnings: [{
      code: "SEGMENT_COVERAGE_INSUFFICIENT",
      message: "A leitura por segmento possui cobertura parcial.",
      competence: "2026-07",
    }],
    privateOwnerId: "must-not-leave-client-boundary",
    email: "private@example.com",
  };
}

test("sanitizer forwards only validated signals, quality reasons and warnings", () => {
  const sanitized = sanitizePortfolioExplanationInput(rawResult());
  assert.equal(sanitized.deterministicFieldsAreImmutable, true);
  assert.equal(sanitized.signals.length, 2);
  assert.equal(sanitized.signals[0]?.code, "RENDA_EM_QUEDA");
  assert.equal(sanitized.dataQuality.state, "partial");
  assert.equal(sanitized.dataQuality.reasons[0]?.code, "MISSING_SEGMENTS");
  assert.equal(sanitized.warnings[0]?.code, "SEGMENT_COVERAGE_INSUFFICIENT");
  const serialized = JSON.stringify(sanitized);
  assert.doesNotMatch(serialized, /privateOwnerId|private@example.com|validPatrimonyTotal|latestIncome|missingFields/);
});

test("sanitizer rejects unknown, duplicate and non-finite signal evidence", () => {
  const unknown = rawResult();
  unknown.signals[0] = { ...unknown.signals[0], code: "BUY_NOW" };
  assert.throws(() => sanitizePortfolioExplanationInput(unknown), /Código do sinal/);

  const duplicate = rawResult();
  duplicate.signals[1] = { ...duplicate.signals[1], code: "RENDA_EM_QUEDA" };
  assert.throws(() => sanitizePortfolioExplanationInput(duplicate), /duplicado/i);

  const nonFinite = rawResult();
  nonFinite.signals[0] = {
    ...nonFinite.signals[0],
    evidence: { variationPercent: Number.POSITIVE_INFINITY },
  };
  assert.throws(() => sanitizePortfolioExplanationInput(nonFinite), /Evidência/);
});

test("deterministic fallback preserves signal identity and reduces confidence for partial data", () => {
  const input = sanitizePortfolioExplanationInput(rawResult());
  const explanation = buildDeterministicPortfolioExplanation(input);
  assert.equal(explanation.source, "deterministic-fallback");
  assert.equal(explanation.overallConfidence, "medium");
  assert.deepEqual(explanation.signalExplanations.map((item) => item.code), [
    "RENDA_EM_QUEDA",
    "CONCENTRACAO_ELEVADA",
  ]);
  assert.deepEqual(explanation.signalExplanations.map((item) => item.confidence), ["high", "medium"]);
  assert.match(explanation.limitations.join(" "), /segmento confirmado/i);
  assert.equal(explanation.disclaimer, PORTFOLIO_EXPLANATION_DISCLAIMER);
  assert.equal(explanation.metadata, null);
});

test("overall confidence fails closed for insufficient data or missing signals", () => {
  const raw = rawResult();
  raw.dataQuality.state = "insufficient";
  const insufficient = sanitizePortfolioExplanationInput(raw);
  assert.equal(derivePortfolioExplanationConfidence(insufficient), "low");

  const emptyRaw = rawResult();
  emptyRaw.signals = [];
  const empty = sanitizePortfolioExplanationInput(emptyRaw);
  assert.equal(derivePortfolioExplanationConfidence(empty), "low");
  assert.equal(buildDeterministicPortfolioExplanation(empty).signalExplanations.length, 0);
});

test("AI output can explain only existing signals and inherits deterministic confidence", () => {
  const input = sanitizePortfolioExplanationInput(rawResult());
  const explanation = normalizePortfolioExplanationOutput({
    summary: "Os sinais mostram mudanças que merecem acompanhamento, sem alterar os cálculos já apresentados.",
    signalExplanations: [{
      code: "RENDA_EM_QUEDA",
      explanation: "A renda recente perdeu força em relação ao padrão anterior registrado.",
      whyItMatters: "A mudança pode afetar a previsibilidade da renda enquanto não houver confirmação de recuperação.",
    }],
    limitations: ["A leitura depende do histórico disponível e não antecipa rendimentos futuros."],
  }, input, metadata);
  assert.equal(explanation.source, "ai");
  assert.equal(explanation.signalExplanations[0]?.title, "A renda recente recuou");
  assert.equal(explanation.signalExplanations[0]?.confidence, "high");
  assert.equal(explanation.overallConfidence, "medium");
  assert.equal(explanation.metadata?.promptVersion, "portfolio-intelligence-explanation-v1");
});

test("AI output is rejected when it invents a signal, a number or an investment action", () => {
  const input = sanitizePortfolioExplanationInput(rawResult());
  const validBase = {
    summary: "Os sinais existentes foram traduzidos sem alterar a análise.",
    signalExplanations: [{
      code: "RENDA_EM_QUEDA",
      explanation: "A renda recente perdeu força diante do padrão anterior.",
      whyItMatters: "A previsibilidade pode ficar menor até que o histórico confirme outra direção.",
    }],
    limitations: ["A leitura não prevê rendimentos futuros."],
  };

  assert.throws(() => normalizePortfolioExplanationOutput({
    ...validBase,
    signalExplanations: [{ ...validBase.signalExplanations[0], code: "RENDA_EM_ALTA" }],
  }, input, metadata), /sinal inexistente/i);

  assert.throws(() => normalizePortfolioExplanationOutput({
    ...validBase,
    summary: "A renda caiu 8 por cento e pode continuar recuando.",
  }, input, metadata), /introduziu números/i);

  assert.throws(() => normalizePortfolioExplanationOutput({
    ...validBase,
    summary: "Você deve vender o fundo enquanto a renda está mais fraca.",
  }, input, metadata), /recomendação/i);
});
