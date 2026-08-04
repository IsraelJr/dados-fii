import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { sanitizePortfolioExplanationInput } from "../src/lib/portfolio-intelligence/PortfolioIntelligenceExplanation.ts";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { PortfolioIntelligenceExplanationError, PortfolioIntelligenceExplanationService } from "../src/lib/portfolio-intelligence/PortfolioIntelligenceExplanationService.ts";
import type { AITextGeneration, AITextMessage } from "../src/types/ai-insights.ts";

function input(signals = true) {
  return sanitizePortfolioExplanationInput({
    policyVersion: "1.0.0",
    asOf: "2026-08-04T15:00:00.000Z",
    dataQuality: {
      state: signals ? "sufficient" : "insufficient",
      reasons: signals ? [] : [{
        code: "INSUFFICIENT_CLOSED_MONTHS",
        impact: "suppressed",
        message: "O histórico encerrado ainda é curto para uma leitura confiável.",
      }],
    },
    signals: signals ? [{
      code: "RENDA_INSTAVEL",
      severity: "attention",
      title: "A renda oscilou",
      summary: "Os rendimentos variaram de forma relevante no histórico recente.",
      confidence: "high",
      evidence: { coefficientOfVariationPercent: 24.5 },
    }] : [],
    warnings: [],
  });
}

function generation(text: string): AITextGeneration {
  return {
    text,
    metadata: {
      engineVersion: "test-engine",
      promptVersion: "portfolio-intelligence-explanation-v1",
      model: "test-model",
      fingerprint: "fingerprint",
      generatedAt: "2026-08-04T15:00:00.000Z",
      cached: false,
    },
  };
}

const validOutput = JSON.stringify({
  summary: "A renda apresentou oscilações que merecem acompanhamento, sem alterar os cálculos já exibidos.",
  signalExplanations: [{
    code: "RENDA_INSTAVEL",
    explanation: "O fluxo de renda variou mais do que um padrão previsível no período observado.",
    whyItMatters: "Oscilações podem reduzir a previsibilidade usada no planejamento da renda passiva.",
  }],
  limitations: ["A leitura depende do histórico disponível e não antecipa distribuições futuras."],
});

test("service sends only sanitized immutable signals, caps cost and reuses identical generations", async () => {
  const calls: Array<{
    purpose: string;
    promptVersion: string;
    input: AITextMessage[];
    model?: string;
    maxOutputTokens?: number;
  }> = [];
  const service = new PortfolioIntelligenceExplanationService({
    async generateText(options) {
      calls.push(options);
      return generation(validOutput);
    },
  });

  const first = await service.generate(input(), { requestKey: "test-user" });
  const second = await service.generate(input(), { requestKey: "test-user" });

  assert.equal(calls.length, 1);
  assert.equal(first.source, "ai");
  assert.equal(first.metadata?.cached, false);
  assert.equal(second.metadata?.cached, true);
  assert.equal(calls[0]?.purpose, "portfolio-intelligence-explanation");
  assert.equal(calls[0]?.promptVersion, "portfolio-intelligence-explanation-v1");
  assert.ok((calls[0]?.maxOutputTokens || 0) <= 1_200);

  const prompt = calls[0]?.input.map((message) => message.content).join(" ") || "";
  assert.match(prompt, /imutáveis/i);
  assert.match(prompt, /Não recalcule/i);
  assert.match(prompt, /RENDA_INSTAVEL/);
  assert.match(prompt, /deterministicFieldsAreImmutable/);
  assert.doesNotMatch(prompt, /ownerId|email|validPatrimonyTotal/);
});

test("concurrent identical requests share one provider call", async () => {
  let calls = 0;
  let release: () => void = () => undefined;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const service = new PortfolioIntelligenceExplanationService({
    async generateText() {
      calls += 1;
      await waiting;
      return generation(validOutput);
    },
  });

  const first = service.generate(input());
  const second = service.generate(input());
  release();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(firstResult.metadata?.cached, false);
  assert.equal(secondResult.metadata?.cached, true);
});

test("empty signal set returns deterministic fallback without provider cost", async () => {
  let calls = 0;
  const service = new PortfolioIntelligenceExplanationService({
    async generateText() {
      calls += 1;
      return generation(validOutput);
    },
  });
  const result = await service.generate(input(false));
  assert.equal(calls, 0);
  assert.equal(result.source, "deterministic-fallback");
  assert.equal(result.signalExplanations.length, 0);
  assert.equal(result.overallConfidence, "low");
});

test("invalid JSON and incompatible AI output fail closed with stable error codes", async () => {
  const invalidJson = new PortfolioIntelligenceExplanationService({
    async generateText() { return generation("not-json"); },
  });
  await assert.rejects(
    invalidJson.generate(input()),
    (error: unknown) => error instanceof PortfolioIntelligenceExplanationError
      && error.code === "PORTFOLIO_EXPLANATION_INVALID_JSON"
      && error.status === 502,
  );

  const inventedNumber = new PortfolioIntelligenceExplanationService({
    async generateText() {
      return generation(JSON.stringify({
        summary: "A renda variou 24 por cento no período.",
        signalExplanations: [{
          code: "RENDA_INSTAVEL",
          explanation: "A renda oscilou de forma relevante.",
          whyItMatters: "A previsibilidade ficou menor.",
        }],
        limitations: ["A análise não prevê o futuro."],
      }));
    },
  });
  await assert.rejects(
    inventedNumber.generate(input()),
    (error: unknown) => error instanceof PortfolioIntelligenceExplanationError
      && error.code === "PORTFOLIO_EXPLANATION_INVALID_OUTPUT"
      && error.status === 502,
  );
});

test("provider failures are wrapped without exposing raw errors", async () => {
  const service = new PortfolioIntelligenceExplanationService({
    async generateText() {
      throw new Error("secret provider detail");
    },
  });
  await assert.rejects(
    service.generate(input()),
    (error: unknown) => error instanceof PortfolioIntelligenceExplanationError
      && error.code === "PORTFOLIO_EXPLANATION_PROVIDER_ERROR"
      && error.status === 503
      && !error.message.includes("secret provider detail"),
  );
});
