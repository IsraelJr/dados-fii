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
import { PortfolioIncrementalExplanationService } from "../src/server/services/PortfolioIncrementalExplanationService";

const metadata: PortfolioExplanationMetadata = {
  engineVersion: "test-engine",
  promptVersion: "portfolio-incremental-explanation-v3",
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

type SanitizedInput = ReturnType<typeof sanitizePortfolioIncrementalExplanationInput>;

function validAiOutput(input: SanitizedInput, summary = "A carteira apresentou mudanças confirmadas pela comparação determinística.") {
  return {
    summaryStyle: "plain",
    changeExplanations: input.changes.map((change) => ({ id: change.id, focus: "meaning" })),
    limitationCodes: ["NO_RECALCULATION", "DATA_DEPENDENCY"],
    ...(summary === "A carteira apresentou mudanças confirmadas pela comparação determinística."
      ? {}
      : { summary }),
  };
}

function expandedComparison(changeCount = 15) {
  const base = comparison();
  const template = base.materialChanges[0];
  assert.ok(template);
  const categories = ["data", "rule", "coverage", "quality"] as const;
  return {
    ...base,
    materialChanges: Array.from({ length: changeCount }, (_, index) => ({
      ...template,
      id: `expanded:${String(index).padStart(2, "0")}`,
      category: categories[index % categories.length],
      code: `EXPANDED_${String(index).padStart(2, "0")}`,
      title: `Mudança expandida ${String(index).padStart(2, "0")}`,
      evidence: { ...template.evidence },
    })),
  };
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

test("sanitização aceita mais de doze mudanças e seleciona no máximo seis deterministicamente", () => {
  const expanded = expandedComparison();
  const forward = sanitizePortfolioIncrementalExplanationInput(expanded);
  const reversed = sanitizePortfolioIncrementalExplanationInput({
    ...expanded,
    materialChanges: [...expanded.materialChanges].reverse(),
  });

  assert.equal(forward.changes.length, 6);
  assert.deepEqual(
    forward.changes.map((change) => change.id),
    reversed.changes.map((change) => change.id),
  );
  assert.equal(new Set(forward.changes.map((change) => change.id)).size, forward.changes.length);
});

test("sanitização valida ids de toda a lista antes do corte", () => {
  const expanded = expandedComparison();
  const duplicated = expanded.materialChanges.map((change, index) => (
    index === expanded.materialChanges.length - 1
      ? { ...change, id: expanded.materialChanges[0]?.id }
      : change
  ));
  assert.throws(
    () => sanitizePortfolioIncrementalExplanationInput({ ...expanded, materialChanges: duplicated }),
    /Mudança duplicada/,
  );
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
  const payload = validAiOutput(input);
  const output = normalizePortfolioIncrementalExplanationOutput({
    ...payload,
    changeExplanations: [...payload.changeExplanations].reverse(),
  }, input, metadata);
  assert.equal(output.source, "ai");
  assert.deepEqual(
    output.changeExplanations.map((item) => item.id),
    input.changes.map((item) => item.id),
  );
  assert.deepEqual(
    output.changeExplanations.map((item) => item.title),
    input.changes.map((item) => item.title),
  );
});

test("saída de IA deve conter exatamente todos os ids sanitizados", () => {
  const input = sanitizePortfolioIncrementalExplanationInput(comparison());
  const payload = validAiOutput(input);
  assert.ok(payload.changeExplanations.length > 1);

  assert.throws(() => normalizePortfolioIncrementalExplanationOutput({
    ...payload,
    changeExplanations: payload.changeExplanations.slice(1),
  }, input, metadata), /Explicações de mudanças inválidas/);

  assert.throws(() => normalizePortfolioIncrementalExplanationOutput({
    ...payload,
    changeExplanations: [
      ...payload.changeExplanations,
      { ...payload.changeExplanations[0], id: "data:SINAL_EXTRA:new" },
    ],
  }, input, metadata), /Explicações de mudanças inválidas/);

  assert.throws(() => normalizePortfolioIncrementalExplanationOutput({
    ...payload,
    changeExplanations: payload.changeExplanations.map((item, index) => (
      index === payload.changeExplanations.length - 1
        ? { ...item, id: payload.changeExplanations[0]?.id }
        : item
    )),
  }, input, metadata), /Identificador incompatível/);
});

test("saída de IA com id inexistente falha fechado", () => {
  const input = sanitizePortfolioIncrementalExplanationInput(comparison());
  const payload = validAiOutput(input);
  assert.throws(() => normalizePortfolioIncrementalExplanationOutput({
    ...payload,
    changeExplanations: payload.changeExplanations.map((item, index) => (
      index === 0 ? { ...item, id: "data:SINAL_INVENTADO:new" } : item
    )),
  }, input, metadata), /Identificador incompatível/);
});

test("saída de IA rejeita algarismos, números por extenso e multiplicadores", () => {
  const input = sanitizePortfolioIncrementalExplanationInput(comparison());
  const forbidden = [
    "A renda caiu 10%.",
    "A renda avançou vinte por cento.",
    "A renda ficou duas vezes maior.",
    "A renda dobrou no período.",
    "A renda pode dobrar no período.",
    "A renda apresentaria duplicação no período.",
    "A renda triplicou no período.",
    "A renda caiu pela metade.",
    "A renda equivale a um terço do patamar anterior.",
    "A renda atingiu ２０ unidades.",
  ];

  for (const summary of forbidden) {
    assert.throws(
      () => normalizePortfolioIncrementalExplanationOutput(validAiOutput(input, summary), input, metadata),
      /introduziu números/,
      summary,
    );
  }
});

test("saída de IA rejeita recomendações ampliadas de posição e investimento", () => {
  const input = sanitizePortfolioIncrementalExplanationInput(comparison());
  const forbidden = [
    "Reduza sua posição.",
    "Aumente a alocação.",
    "Invista no fundo.",
    "Desfaça-se da posição.",
    "Zere a exposição.",
    "Você deve reduzir sua posição.",
    "A recomendação é a venda.",
    "Reduzir a posição seria prudente.",
    "Faça um aporte no fundo.",
    "Evite esse ativo.",
    "Diversifique a carteira.",
    "Rebalanceie a carteira.",
    "Realocar seria prudente.",
    "Busque equilibrar a carteira.",
  ];

  for (const summary of forbidden) {
    assert.throws(
      () => normalizePortfolioIncrementalExplanationOutput(validAiOutput(input, summary), input, metadata),
      /introduziu recomendação/,
      summary,
    );
  }
});

test("saída de IA contraditória ou com fato externo não comprovável falha fechado", () => {
  const input = sanitizePortfolioIncrementalExplanationInput(comparison());
  const payload = validAiOutput(input);
  const contradictory = {
    ...payload,
    changeExplanations: payload.changeExplanations.map((item, index) => (
      index === 0 ? { ...item, explanation: "A renda aumentou e o fundo enfrenta crise de liquidez." } : item
    )),
  };
  assert.throws(
    () => normalizePortfolioIncrementalExplanationOutput(contradictory, input, metadata),
    /afirmação não comprovável/,
  );
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

test("flag de IA desligada retorna fallback sem chamar provedor", async () => {
  let providerCalls = 0;
  const service = new PortfolioIncrementalExplanationService({
    async generateText() {
      providerCalls += 1;
      throw new Error("provider-must-not-run");
    },
  }, () => false);
  const input = sanitizePortfolioIncrementalExplanationInput(comparison());
  const output = await service.generate(input);
  assert.equal(providerCalls, 0);
  assert.equal(output.source, "deterministic-fallback");
});

test("provedor recebe somente diferenças sanitizadas e resultado compatível", async () => {
  const calls: string[] = [];
  const input = sanitizePortfolioIncrementalExplanationInput(comparison());
  const service = new PortfolioIncrementalExplanationService({
    async generateText(options) {
      calls.push(options.input.map((message) => message.content).join(" "));
      return {
        text: JSON.stringify(validAiOutput(input)),
        metadata,
      };
    },
  }, () => true);

  const output = await service.generate(input);
  assert.equal(output.source, "ai");
  assert.equal(calls.length, 1);
  assert.match(calls[0], /deterministicFieldsAreImmutable/);
  assert.match(calls[0], /exatamente um item para cada id/);
  assert.match(calls[0], /dobrou, triplicou/);
  assert.match(calls[0], /opções enumeradas/);
  assert.doesNotMatch(calls[0], /ownerId|x-wallet-session|cookie|portfolio-e2e@example\.test/i);
});
