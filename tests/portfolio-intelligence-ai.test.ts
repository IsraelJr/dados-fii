import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node strip-types exige extensão explícita.
import { PortfolioIntelligenceService } from "../src/lib/portfolio-intelligence/PortfolioIntelligenceService.ts";
// @ts-expect-error Node strip-types exige extensão explícita.
import {
  PORTFOLIO_INTELLIGENCE_AI_DISCLAIMER,
  PortfolioIntelligenceAIValidationError,
  buildPortfolioIntelligenceAISafeInput,
} from "../src/lib/portfolio-intelligence/PortfolioIntelligenceAIContract.ts";
// @ts-expect-error Node strip-types exige extensão explícita.
import { PortfolioIntelligenceAIService } from "../src/lib/portfolio-intelligence/PortfolioIntelligenceAIService.ts";
import type { AITextGeneration, AITextMessage } from "../src/types/ai-insights.ts";

function analysis(offset = 0) {
  return new PortfolioIntelligenceService().analyze({
    snapshots: [
      { competence: "2026-01", dividends: 100 },
      { competence: "2026-02", dividends: 100 },
      { competence: "2026-03", dividends: 100 },
      { competence: "2026-04", dividends: 110 + offset },
      { competence: "2026-05", dividends: 110 + offset },
      { competence: "2026-06", dividends: 110 + offset },
    ],
    positions: [
      { ticker: "AAAA11", quantity: 40, price: 10, estimatedIncome: 40, segment: "Papel" },
      { ticker: "BBBB11", quantity: 20, price: 10, estimatedIncome: 20, segment: "Tijolo" },
      { ticker: "CCCC11", quantity: 20, price: 10, estimatedIncome: 20, segment: "Tijolo" },
      { ticker: "DDDD11", quantity: 20, price: 10, estimatedIncome: 20, segment: "Tijolo" },
    ],
  }, {
    asOf: "2026-07-15T12:00:00.000Z",
    generatedAt: "2026-07-15T12:00:01.000Z",
  });
}

function generation(text: string): AITextGeneration {
  return {
    text,
    metadata: {
      engineVersion: "test-engine",
      promptVersion: "test-prompt",
      model: "test-model",
      fingerprint: "provider-fingerprint",
      generatedAt: "2026-07-15T12:00:02.000Z",
      cached: false,
    },
  };
}

class FakeGenerator {
  calls = 0;
  inputs: AITextMessage[][] = [];
  constructor(
    private readonly response: () => Promise<AITextGeneration>,
  ) {}

  async generateText(options: { input: AITextMessage[] }) {
    this.calls += 1;
    this.inputs.push(options.input);
    return this.response();
  }
}

function validOutput() {
  return JSON.stringify({
    headline: "A renda recente subiu com concentração relevante",
    summary: "Os dois blocos de três meses mostram alta já calculada, enquanto a maior posição continua acima do limite da política.",
    keyPoints: [
      "A média recente ficou acima da média dos três meses anteriores.",
      "A maior posição representa parcela relevante do patrimônio coberto.",
    ],
    limitations: [
      "A explicação usa somente o histórico e as posições presentes no resultado determinístico.",
    ],
  });
}

test("entrada segura contém somente métricas, sinais e qualidade validados", () => {
  const result = analysis();
  const safe = buildPortfolioIntelligenceAISafeInput(result);
  const serialized = JSON.stringify(safe);

  assert.equal(safe.policyVersion, result.policyVersion);
  assert.equal(safe.metrics.income.validMonthCount, 6);
  assert.ok(safe.signals.length > 0);
  assert.doesNotMatch(serialized, /generatedAt|asOf|snapshots|positions|quantity|email|token|cookie|session/i);

  const unsafe = structuredClone(result) as any;
  unsafe.signals[0].evidence.email = "usuario@example.com";
  assert.throws(
    () => buildPortfolioIntelligenceAISafeInput(unsafe),
    (error: unknown) => error instanceof PortfolioIntelligenceAIValidationError && error.code === "INVALID_INPUT",
  );
});

test("entrada idêntica usa cache e envia somente JSON seguro ao gerador", async () => {
  process.env.ENABLE_PORTFOLIO_INTELLIGENCE_AI = "true";
  const generator = new FakeGenerator(async () => generation(validOutput()));
  const service = new PortfolioIntelligenceAIService(generator);

  const first = await service.explain(analysis(), { requestKey: "test-user-a" });
  const second = await service.explain(analysis(), { requestKey: "test-user-a" });

  assert.equal(generator.calls, 1);
  assert.equal(first.mode, "ai");
  assert.equal(first.metadata.cached, false);
  assert.equal(second.metadata.cached, true);
  assert.equal(first.disclaimer, PORTFOLIO_INTELLIGENCE_AI_DISCLAIMER);
  const prompt = generator.inputs[0].map((item) => item.content).join("\n");
  assert.match(prompt, /Não refaça fórmulas, não altere números/);
  assert.match(prompt, /Não sugira comprar, vender, manter, aportar/);
  assert.doesNotMatch(prompt, /generatedAt|snapshots|positions|quantity|email|token|cookie|session/i);
});

test("requisições concorrentes idênticas são deduplicadas", async () => {
  process.env.ENABLE_PORTFOLIO_INTELLIGENCE_AI = "true";
  const generator = new FakeGenerator(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return generation(validOutput());
  });
  const service = new PortfolioIntelligenceAIService(generator);

  const [first, second] = await Promise.all([
    service.explain(analysis(), { requestKey: "test-user-b" }),
    service.explain(analysis(), { requestKey: "test-user-b" }),
  ]);

  assert.equal(generator.calls, 1);
  assert.equal(first.mode, "ai");
  assert.equal(second.mode, "ai");
  assert.ok(first.metadata.cached !== second.metadata.cached);
});

test("feature desligada retorna fallback determinístico sem chamar IA", async () => {
  process.env.ENABLE_PORTFOLIO_INTELLIGENCE_AI = "false";
  const generator = new FakeGenerator(async () => generation(validOutput()));
  const service = new PortfolioIntelligenceAIService(generator);

  const result = await service.explain(analysis());

  assert.equal(generator.calls, 0);
  assert.equal(result.mode, "deterministic_fallback");
  assert.equal(result.metadata.fallbackReason, "feature_disabled");
  assert.ok(result.keyPoints.length > 0);
  assert.ok(result.limitations.length > 0);
});

test("saída com orientação de investimento é rejeitada e substituída pelo fallback", async () => {
  process.env.ENABLE_PORTFOLIO_INTELLIGENCE_AI = "true";
  const generator = new FakeGenerator(async () => generation(JSON.stringify({
    headline: "Concentração elevada",
    summary: "Você deve comprar outro fundo para reduzir a concentração.",
    keyPoints: ["A maior posição supera o limite."],
    limitations: ["A análise considera apenas os dados enviados."],
  })));
  const service = new PortfolioIntelligenceAIService(generator);

  const result = await service.explain(analysis(), { requestKey: "test-user-c" });

  assert.equal(generator.calls, 1);
  assert.equal(result.mode, "deterministic_fallback");
  assert.equal(result.metadata.fallbackReason, "unsafe_ai_output");
  assert.doesNotMatch(`${result.headline} ${result.summary} ${result.keyPoints.join(" ")}`, /comprar|vender|aporte/i);
});

test("falha do provedor retorna fallback curto e reutiliza cache de falha", async () => {
  process.env.ENABLE_PORTFOLIO_INTELLIGENCE_AI = "true";
  const generator = new FakeGenerator(async () => {
    throw new Error("network unavailable");
  });
  const service = new PortfolioIntelligenceAIService(generator);

  const first = await service.explain(analysis(1), { requestKey: "test-user-d" });
  const second = await service.explain(analysis(1), { requestKey: "test-user-d" });

  assert.equal(generator.calls, 1);
  assert.equal(first.mode, "deterministic_fallback");
  assert.equal(first.metadata.fallbackReason, "ai_unavailable");
  assert.equal(second.metadata.cached, true);
});
