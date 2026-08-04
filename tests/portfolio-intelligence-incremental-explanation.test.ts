import assert from "node:assert/strict";
import test from "node:test";
import {
  PortfolioIntelligenceService,
  buildDeterministicPortfolioIncrementalExplanation,
  comparePortfolioIntelligenceReferences,
  createPortfolioIntelligenceReference,
  normalizePortfolioIncrementalExplanationOutput,
  sanitizePortfolioIncrementalExplanationInput,
  type PortfolioExplanationMetadata,
} from "../src/lib/portfolio-intelligence/index";

const metadata: PortfolioExplanationMetadata = {
  engineVersion: "test-engine",
  promptVersion: "portfolio-incremental-explanation-v1",
  model: "test-model",
  fingerprint: "test-fingerprint",
  generatedAt: "2026-08-04T19:00:00.000Z",
  cached: false,
};

function result(values: readonly number[], generatedAt: string) {
  return new PortfolioIntelligenceService().analyze({
    snapshots: values.map((dividends, index) => ({
      competence: `2026-${String(index + 1).padStart(2, "0")}`,
      dividends,
    })),
    positions: [
      { ticker: "AAAA11", quantity: 60, price: 1, estimatedIncome: 6, segment: "Tijolo" },
      { ticker: "BBBB11", quantity: 40, price: 1, estimatedIncome: 4, segment: "Tijolo" },
    ],
  }, {
    asOf: "2026-07-15T12:00:00.000Z",
    generatedAt,
  });
}

function comparison() {
  return comparePortfolioIntelligenceReferences(
    createPortfolioIntelligenceReference(result([100, 100, 100, 100, 100, 100], "2026-08-04T12:00:00.000Z")),
    createPortfolioIntelligenceReference(result([100, 100, 100, 80, 80, 80], "2026-08-04T18:00:00.000Z")),
  );
}

test("sanitização envia somente mudanças materiais e campos determinísticos", () => {
  const input = sanitizePortfolioIncrementalExplanationInput(comparison());
  assert.equal(input.deterministicFieldsAreImmutable, true);
  assert.ok(input.changes.length > 0);
  assert.ok(input.changes.length <= 6);
  assert.ok(input.changes.every((change) => typeof change.id === "string"));
  assert.equal("positions" in input, false);
  assert.equal("ownerId" in input, false);
  assert.equal("email" in input, false);
});

test("fallback mantém ids e títulos determinados pelo domínio", () => {
  const input = sanitizePortfolioIncrementalExplanationInput(comparison());
  const output = buildDeterministicPortfolioIncrementalExplanation(input);
  assert.equal(output.source, "deterministic-fallback");
  assert.deepEqual(
    output.changeExplanations.map((item) => item.id),
    input.changes.map((item) => item.id),
  );
  assert.deepEqual(
    output.changeExplanations.map((item) => item.title),
    input.changes.map((item) => item.title),
  );
  assert.match(output.disclaimer, /Não é recomendação/);
});

test("saída de IA aceita somente ids existentes e preserva títulos", () => {
  const input = sanitizePortfolioIncrementalExplanationInput(comparison());
  const first = input.changes[0];
  assert.ok(first);
  const output = normalizePortfolioIncrementalExplanationOutput({
    summary: "A carteira apresentou uma mudança já confirmada pela comparação determinística.",
    changeExplanations: [{
      id: first.id,
      explanation: "A alteração merece acompanhamento porque representa uma diferença real entre as referências válidas.",
      whyItMatters: "Isso ajuda a separar novidade de repetição e mantém a leitura focada no que mudou.",
    }],
    limitations: ["A explicação não recalcula a comparação nem altera a materialidade."],
  }, input, metadata);
  assert.equal(output.source, "ai");
  assert.equal(output.changeExplanations[0]?.title, first.title);
});

test("saída de IA com id inexistente falha fechado", () => {
  const input = sanitizePortfolioIncrementalExplanationInput(comparison());
  assert.throws(() => normalizePortfolioIncrementalExplanationOutput({
    summary: "Resumo válido sem números.",
    changeExplanations: [{
      id: "data:SINAL_INVENTADO:new",
      explanation: "Explicação inventada.",
      whyItMatters: "Importância inventada.",
    }],
    limitations: ["Limitação válida."],
  }, input, metadata), /Identificador incompatível/);
});

test("saída de IA não pode introduzir números nem recomendação", () => {
  const input = sanitizePortfolioIncrementalExplanationInput(comparison());
  const first = input.changes[0];
  assert.ok(first);
  assert.throws(() => normalizePortfolioIncrementalExplanationOutput({
    summary: "A renda caiu dez por cento 10%.",
    changeExplanations: [{
      id: first.id,
      explanation: "A alteração foi calculada.",
      whyItMatters: "Ajuda a acompanhar a carteira.",
    }],
    limitations: ["Limitação válida."],
  }, input, metadata), /introduziu números/);

  assert.throws(() => normalizePortfolioIncrementalExplanationOutput({
    summary: "A mudança foi confirmada.",
    changeExplanations: [{
      id: first.id,
      explanation: "Você deve vender o fundo.",
      whyItMatters: "Ajuda a acompanhar a carteira.",
    }],
    limitations: ["Limitação válida."],
  }, input, metadata), /introduziu recomendação/);
});

test("comparação sem mudança material não pode consumir IA", () => {
  const reference = createPortfolioIntelligenceReference(result(
    [100, 100, 100, 100, 100, 100],
    "2026-08-04T12:00:00.000Z",
  ));
  const unchanged = comparePortfolioIntelligenceReferences(reference, reference);
  assert.throws(
    () => sanitizePortfolioIncrementalExplanationInput(unchanged),
    /Mudanças materiais inválidas/,
  );
});
