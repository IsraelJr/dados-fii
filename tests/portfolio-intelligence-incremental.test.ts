import assert from "node:assert/strict";
import test from "node:test";
import {
  PortfolioIntelligenceService,
  comparePortfolioIntelligenceReferences,
  createPortfolioIntelligenceReference,
  sanitizePortfolioIntelligenceReference,
  type PortfolioIntelligencePositionInput,
  type PortfolioIntelligenceResult,
} from "../src/lib/portfolio-intelligence/index";

const service = new PortfolioIntelligenceService();
const BASE_TIME = "2026-08-04T12:00:00.000Z";

function history(values: readonly number[]) {
  return values.map((dividends, index) => ({
    competence: `2026-${String(index + 1).padStart(2, "0")}`,
    dividends,
  }));
}

function position(ticker: string, value: number, income = value / 10): PortfolioIntelligencePositionInput {
  return { ticker, quantity: value, price: 1, estimatedIncome: income, segment: "Tijolo" };
}

function analyze(options: Readonly<{
  history?: readonly number[];
  positions?: readonly PortfolioIntelligencePositionInput[];
  generatedAt?: string;
  asOf?: string;
}> = {}) {
  return service.analyze({
    snapshots: history(options.history ?? [100, 100, 100, 100, 100, 100]),
    positions: options.positions ?? [position("AAAA11", 60), position("BBBB11", 40)],
  }, {
    asOf: options.asOf ?? "2026-07-15T12:00:00.000Z",
    generatedAt: options.generatedAt ?? BASE_TIME,
  });
}

function withResult(
  result: PortfolioIntelligenceResult,
  patch: Partial<PortfolioIntelligenceResult>,
): PortfolioIntelligenceResult {
  return { ...result, ...patch };
}

test("primeira análise cria uma base honesta sem inventar mudança", () => {
  const current = createPortfolioIntelligenceReference(analyze());
  const comparison = comparePortfolioIntelligenceReferences(null, current);
  assert.equal(comparison.status, "baseline");
  assert.equal(comparison.previous, null);
  assert.equal(comparison.materialChanges.length, 0);
  assert.match(comparison.summary.message, /primeira análise válida/i);
});

test("fingerprint ignora horário de geração e data-base quando o conteúdo é idêntico", () => {
  const first = createPortfolioIntelligenceReference(analyze({
    generatedAt: "2026-08-04T12:00:00.000Z",
    asOf: "2026-07-15T12:00:00.000Z",
  }));
  const second = createPortfolioIntelligenceReference(analyze({
    generatedAt: "2026-08-04T18:00:00.000Z",
    asOf: "2026-07-16T12:00:00.000Z",
  }));
  assert.equal(first.fingerprint, second.fingerprint);
  const comparison = comparePortfolioIntelligenceReferences(first, second);
  assert.equal(comparison.status, "unchanged");
  assert.equal(comparison.materialChanges.length, 0);
  assert.ok(comparison.unchangedSignalCodes.length > 0);
});

test("sinal inalterado não reaparece como novidade", () => {
  const reference = createPortfolioIntelligenceReference(analyze());
  const comparison = comparePortfolioIntelligenceReferences(reference, reference);
  assert.equal(comparison.status, "unchanged");
  assert.equal(comparison.changes.length, 0);
  assert.deepEqual(comparison.unchangedSignalCodes, reference.signals.map((signal) => signal.code));
});

test("novo sinal e sinal resolvido são classificados deterministicamente", () => {
  const stable = createPortfolioIntelligenceReference(analyze({ history: [100, 100, 100, 100, 100, 100] }));
  const falling = createPortfolioIntelligenceReference(analyze({ history: [100, 100, 100, 80, 80, 80] }));
  const introduced = comparePortfolioIntelligenceReferences(stable, falling);
  assert.ok(introduced.materialChanges.some((item) => (
    item.code === "SIGNAL_RENDA_EM_QUEDA" && item.state === "new" && item.category === "data"
  )));
  assert.ok(introduced.materialChanges.some((item) => (
    item.code === "SIGNAL_RENDA_ESTAVEL" && item.state === "resolved"
  )));

  const resolved = comparePortfolioIntelligenceReferences(falling, stable);
  assert.ok(resolved.materialChanges.some((item) => (
    item.code === "SIGNAL_RENDA_EM_QUEDA" && item.state === "resolved"
  )));
});

test("mudança da política fica separada da mudança financeira", () => {
  const base = analyze();
  const previous = createPortfolioIntelligenceReference(base);
  const current = createPortfolioIntelligenceReference(withResult(base, { policyVersion: "2.0.0" }));
  const comparison = comparePortfolioIntelligenceReferences(previous, current);
  const rule = comparison.materialChanges.find((item) => item.code === "POLICY_VERSION_CHANGED");
  assert.equal(rule?.category, "rule");
  assert.equal(rule?.before, base.policyVersion);
  assert.equal(rule?.after, "2.0.0");
});

test("queda de qualidade não é apresentada como deterioração de um fundo", () => {
  const full = analyze();
  const partial = service.analyze({
    snapshots: history([100, 100]),
    positions: [position("AAAA11", 100)],
  }, { asOf: "2026-07-15T12:00:00.000Z", generatedAt: BASE_TIME });
  const comparison = comparePortfolioIntelligenceReferences(
    createPortfolioIntelligenceReference(full),
    createPortfolioIntelligenceReference(partial),
  );
  assert.ok(comparison.materialChanges.some((item) => item.category === "quality"));
  assert.ok(comparison.materialChanges.some((item) => item.category === "coverage"));
  assert.ok(comparison.materialChanges
    .filter((item) => item.code.startsWith("QUALITY_"))
    .every((item) => item.category === "quality"));
});

test("variação abaixo do limiar não vira mudança material", () => {
  const base = analyze();
  const previous = createPortfolioIntelligenceReference(base);
  const current = createPortfolioIntelligenceReference({
    ...base,
    generatedAt: "2026-08-04T13:00:00.000Z",
    metrics: {
      ...base.metrics,
      income: { ...base.metrics.income, latestIncome: (base.metrics.income.latestIncome ?? 100) * 1.02 },
    },
  });
  const comparison = comparePortfolioIntelligenceReferences(previous, current);
  assert.ok(!comparison.materialChanges.some((item) => item.code === "LATEST_INCOME_CHANGED"));
});

test("variação no limiar de três por cento é material", () => {
  const base = analyze();
  const previous = createPortfolioIntelligenceReference(base);
  const current = createPortfolioIntelligenceReference({
    ...base,
    generatedAt: "2026-08-04T13:00:00.000Z",
    metrics: {
      ...base.metrics,
      income: { ...base.metrics.income, latestIncome: (base.metrics.income.latestIncome ?? 100) * 0.97 },
    },
  });
  const comparison = comparePortfolioIntelligenceReferences(previous, current);
  const item = comparison.materialChanges.find((change) => change.code === "LATEST_INCOME_CHANGED");
  assert.equal(item?.state, "aggravated");
  assert.equal(item?.category, "data");
});

test("referência persistida exige fingerprint íntegro", () => {
  const reference = createPortfolioIntelligenceReference(analyze());
  assert.equal(sanitizePortfolioIntelligenceReference(reference).fingerprint, reference.fingerprint);
  assert.throws(
    () => sanitizePortfolioIntelligenceReference({ ...reference, fingerprint: " adulterado " }),
    /Fingerprint da referência incompatível/,
  );
});

test("ausência e zero continuam distintos na referência", () => {
  const result = analyze();
  const absent = createPortfolioIntelligenceReference({
    ...result,
    metrics: { ...result.metrics, income: { ...result.metrics.income, latestIncome: null } },
  });
  const zero = createPortfolioIntelligenceReference({
    ...result,
    metrics: { ...result.metrics, income: { ...result.metrics.income, latestIncome: 0 } },
  });
  assert.equal(absent.metrics.latestIncome, null);
  assert.equal(zero.metrics.latestIncome, 0);
  assert.notEqual(absent.fingerprint, zero.fingerprint);
});
