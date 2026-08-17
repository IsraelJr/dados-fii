import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { PortfolioIntelligenceService } from "../src/lib/portfolio-intelligence/PortfolioIntelligenceService";
import type {
  PortfolioIntelligencePositionInput,
  PortfolioIntelligenceResult,
} from "../src/lib/portfolio-intelligence/PortfolioIntelligence";
import {
  assertUniquePortfolioIncrementalChanges,
  comparePortfolioIntelligenceReferences,
  createPortfolioIntelligenceReference,
  sanitizePortfolioIntelligenceReference,
} from "../src/lib/portfolio-intelligence/PortfolioIntelligenceIncremental";

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

function withLatestIncome(
  result: PortfolioIntelligenceResult,
  latestIncome: number | null,
): PortfolioIntelligenceResult {
  return {
    ...result,
    metrics: {
      ...result.metrics,
      income: { ...result.metrics.income, latestIncome },
    },
  };
}

function withLatestCompetence(
  result: PortfolioIntelligenceResult,
  latestClosedCompetence: string | null,
): PortfolioIntelligenceResult {
  return {
    ...result,
    metrics: {
      ...result.metrics,
      income: { ...result.metrics.income, latestClosedCompetence },
    },
  };
}

function stableJsonForTest(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJsonForTest).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJsonForTest(item)}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Valor não serializável no teste.");
  return serialized;
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
  assert.equal(comparison.status, "unchanged");
  assert.equal(comparison.materialChanges.length, 0);
  assert.ok(!comparison.materialChanges.some((item) => item.code === "LATEST_INCOME_CHANGED"));
  assert.equal(comparison.changes.find((item) => item.code === "DATA_FINGERPRINT_CHANGED")?.material, false);
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

test("referência v2 persiste proveniência mínima com fingerprints SHA-256", () => {
  const reference = createPortfolioIntelligenceReference(analyze());
  assert.equal(reference.schemaVersion, 2);
  assert.match(reference.fingerprint, /^[a-f0-9]{64}$/);
  assert.match(reference.dataFingerprint, /^[a-f0-9]{64}$/);
  assert.match(reference.policyFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(reference.domainVersion, "2.0.0");
  assert.deepEqual(Object.keys(reference.quality.confidence).sort(), [
    "concentration",
    "income",
    "segments",
    "trend",
  ]);
  assert.equal(reference.quality.monthsRequired, 6);
  assert.deepEqual(
    sanitizePortfolioIntelligenceReference(reference),
    reference,
  );
});

test("fingerprint da referência é SHA-256 do conteúdo canônico", () => {
  const reference = createPortfolioIntelligenceReference(analyze());
  const canonical = {
    schemaVersion: reference.schemaVersion,
    dataFingerprint: reference.dataFingerprint,
    policyFingerprint: reference.policyFingerprint,
    domainVersion: reference.domainVersion,
    policyVersion: reference.policyVersion,
    signals: reference.signals,
    metrics: reference.metrics,
    quality: reference.quality,
  };
  const expected = createHash("sha256").update(stableJsonForTest(canonical)).digest("hex");
  assert.equal(reference.fingerprint, expected);
});

test("fingerprints de proveniência fornecidos pelo servidor são validados e preservados", () => {
  const dataFingerprint = "a".repeat(64);
  const policyFingerprint = "b".repeat(64);
  const reference = createPortfolioIntelligenceReference(analyze(), {
    dataFingerprint,
    policyFingerprint,
  });
  assert.equal(reference.dataFingerprint, dataFingerprint);
  assert.equal(reference.policyFingerprint, policyFingerprint);
  assert.throws(
    () => createPortfolioIntelligenceReference(analyze(), { dataFingerprint: "não-é-sha-256" }),
    /Fingerprint dos dados inválido/,
  );
});

test("transições null, zero e número possuem semântica explícita", () => {
  const base = analyze();
  const cases = [
    {
      before: null,
      after: 0,
      code: "LATEST_INCOME_CHANGED_AVAILABILITY",
      category: "quality",
      state: "reduced",
    },
    {
      before: null,
      after: 100,
      code: "LATEST_INCOME_CHANGED_AVAILABILITY",
      category: "quality",
      state: "reduced",
    },
    {
      before: 100,
      after: null,
      code: "LATEST_INCOME_CHANGED_AVAILABILITY",
      category: "quality",
      state: "aggravated",
    },
    {
      before: 0,
      after: 100,
      code: "LATEST_INCOME_CHANGED",
      category: "data",
      state: "reduced",
    },
    {
      before: 100,
      after: 0,
      code: "LATEST_INCOME_CHANGED",
      category: "data",
      state: "aggravated",
    },
  ] as const;

  for (const item of cases) {
    const comparison = comparePortfolioIntelligenceReferences(
      createPortfolioIntelligenceReference(withLatestIncome(base, item.before)),
      createPortfolioIntelligenceReference(withLatestIncome(base, item.after)),
    );
    const found = comparison.materialChanges.find((change) => change.code === item.code);
    assert.equal(found?.category, item.category, `${String(item.before)} -> ${String(item.after)}`);
    assert.equal(found?.state, item.state, `${String(item.before)} -> ${String(item.after)}`);
    if (item.before === 0 || item.after === 0) {
      assert.ok(found, "transição envolvendo zero nunca pode desaparecer");
    }
  }
});

test("números inválidos falham fechado na criação e na leitura persistida", () => {
  const base = analyze();
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, "20.91"] as const) {
    assert.throws(
      () => createPortfolioIntelligenceReference(withLatestIncome(base, invalid as unknown as number)),
      /Última renda inválido/,
    );
  }
  const reference = createPortfolioIntelligenceReference(base);
  assert.throws(
    () => sanitizePortfolioIntelligenceReference({
      ...reference,
      metrics: { ...reference.metrics, latestIncome: Number.NaN },
    }),
    /Última renda inválido/,
  );
});

test("mudança exclusivamente de política não produz narrativa financeira", () => {
  const base = analyze();
  const previous = createPortfolioIntelligenceReference(base);
  const current = createPortfolioIntelligenceReference({
    ...base,
    policyVersion: "2.0.0",
    signals: [],
  });
  assert.equal(previous.dataFingerprint, current.dataFingerprint);
  assert.notEqual(previous.policyFingerprint, current.policyFingerprint);
  const comparison = comparePortfolioIntelligenceReferences(previous, current);
  assert.deepEqual(comparison.materialChanges.map((item) => item.category), ["rule"]);
  assert.equal(comparison.materialChanges[0]?.code, "POLICY_VERSION_CHANGED");
});

test("mudança do fingerprint da política sem mudar a versão também é regra", () => {
  const base = analyze();
  const dataFingerprint = "a".repeat(64);
  const previous = createPortfolioIntelligenceReference(base, {
    dataFingerprint,
    policyFingerprint: "b".repeat(64),
  });
  const current = createPortfolioIntelligenceReference(base, {
    dataFingerprint,
    policyFingerprint: "c".repeat(64),
  });
  const comparison = comparePortfolioIntelligenceReferences(previous, current);
  assert.deepEqual(comparison.materialChanges.map((item) => item.code), ["POLICY_FINGERPRINT_CHANGED"]);
  assert.equal(comparison.materialChanges[0]?.category, "rule");
});

test("mudança simultânea de dados e regra mantém causa metodológica separada", () => {
  const base = analyze();
  const previous = createPortfolioIntelligenceReference(withLatestIncome(base, 100), {
    dataFingerprint: "a".repeat(64),
    policyFingerprint: "b".repeat(64),
  });
  const current = createPortfolioIntelligenceReference({
    ...withLatestIncome(base, 80),
    policyVersion: "2.0.0",
  }, {
    dataFingerprint: "c".repeat(64),
    policyFingerprint: "d".repeat(64),
  });
  const comparison = comparePortfolioIntelligenceReferences(previous, current);
  assert.equal(comparison.materialChanges.find((item) => item.code === "POLICY_VERSION_CHANGED")?.category, "rule");
  assert.equal(comparison.materialChanges.find((item) => item.code === "LATEST_INCOME_CHANGED")?.category, "data");
});

test("sinal que desaparece por perda de qualidade não é marcado como resolvido", () => {
  const previousResult = analyze({
    positions: [position("AAAA11", 100)],
  });
  const currentResult = analyze({
    positions: [{
      ticker: "AAAA11",
      quantity: 100,
      price: null,
      estimatedIncome: null,
      segment: null,
    }],
  });
  assert.ok(previousResult.signals.some((signal) => signal.code === "CONCENTRACAO_ELEVADA"));
  assert.ok(!currentResult.signals.some((signal) => signal.code === "CONCENTRACAO_ELEVADA"));
  assert.equal(currentResult.dataQuality.confidence.concentration, "low");

  const comparison = comparePortfolioIntelligenceReferences(
    createPortfolioIntelligenceReference(previousResult),
    createPortfolioIntelligenceReference(currentResult),
  );
  const signal = comparison.materialChanges.find((item) => item.code === "SIGNAL_CONCENTRACAO_ELEVADA");
  assert.equal(signal?.category, "quality");
  assert.equal(signal?.state, "aggravated");
  assert.match(signal?.summary ?? "", /não comprova/i);
});

test("sinal só é resolvido quando a dimensão atual possui qualidade suficiente", () => {
  const previousResult = analyze({ positions: [position("AAAA11", 100)] });
  const currentResult = analyze({
    positions: [
      position("AAAA11", 20),
      position("BBBB11", 20),
      position("CCCC11", 20),
      position("DDDD11", 20),
      position("EEEE11", 20),
    ],
  });
  assert.equal(currentResult.dataQuality.confidence.concentration, "high");
  const comparison = comparePortfolioIntelligenceReferences(
    createPortfolioIntelligenceReference(previousResult),
    createPortfolioIntelligenceReference(currentResult),
  );
  const signal = comparison.materialChanges.find((item) => item.code === "SIGNAL_CONCENTRACAO_ELEVADA");
  assert.equal(signal?.category, "data");
  assert.equal(signal?.state, "resolved");
});

test("DADOS_INSUFICIENTES não resolve enquanto a qualidade continuar parcial", () => {
  const insufficient = service.analyze({ snapshots: [], positions: [] }, {
    asOf: "2026-07-15T12:00:00.000Z",
    generatedAt: BASE_TIME,
  });
  assert.ok(insufficient.signals.some((signal) => signal.code === "DADOS_INSUFICIENTES"));
  const partialBase = analyze({ history: [100, 100] });
  const partialWithoutSignal: PortfolioIntelligenceResult = {
    ...partialBase,
    signals: partialBase.signals.filter((signal) => signal.code !== "DADOS_INSUFICIENTES"),
  };
  assert.notEqual(partialWithoutSignal.dataQuality.state, "sufficient");
  const comparison = comparePortfolioIntelligenceReferences(
    createPortfolioIntelligenceReference(insufficient),
    createPortfolioIntelligenceReference(partialWithoutSignal),
  );
  const signal = comparison.materialChanges.find((item) => item.code === "SIGNAL_DADOS_INSUFICIENTES");
  assert.equal(signal?.category, "quality");
  assert.equal(signal?.state, "aggravated");
});

test("mudanças de competência são explícitas e recuo é perda de cobertura", () => {
  const base = analyze();
  const advanced = comparePortfolioIntelligenceReferences(
    createPortfolioIntelligenceReference(withLatestCompetence(base, "2026-05")),
    createPortfolioIntelligenceReference(withLatestCompetence(base, "2026-06")),
  );
  const forward = advanced.materialChanges.find((item) => item.code === "LATEST_CLOSED_COMPETENCE_CHANGED");
  assert.equal(forward?.category, "coverage");
  assert.equal(forward?.state, "new");

  const regressed = comparePortfolioIntelligenceReferences(
    createPortfolioIntelligenceReference(withLatestCompetence(base, "2026-06")),
    createPortfolioIntelligenceReference(withLatestCompetence(base, "2026-05")),
  );
  assert.equal(
    regressed.materialChanges.find((item) => item.code === "LATEST_CLOSED_COMPETENCE_CHANGED")?.state,
    "aggravated",
  );
  assert.throws(
    () => createPortfolioIntelligenceReference(withLatestCompetence(base, "2026-13")),
    /Última competência encerrada inválido/,
  );
});

test("warnings preservam competência e entram ou saem sem desaparecer silenciosamente", () => {
  const base = analyze();
  const withWarning: PortfolioIntelligenceResult = {
    ...base,
    warnings: [{
      code: "CURRENT_COMPETENCE_IGNORED",
      competence: "2026-07",
      message: "Competência corrente excluída.",
    }],
  };
  const reference = createPortfolioIntelligenceReference(withWarning);
  assert.deepEqual(reference.quality.warnings, [{
    code: "CURRENT_COMPETENCE_IGNORED",
    competence: "2026-07",
  }]);
  const introduced = comparePortfolioIntelligenceReferences(
    createPortfolioIntelligenceReference(base),
    reference,
  );
  const code = "WARNING_CURRENT_COMPETENCE_IGNORED_2026_07";
  assert.equal(introduced.materialChanges.find((item) => item.code === code)?.category, "coverage");
  assert.equal(introduced.materialChanges.find((item) => item.code === code)?.state, "aggravated");

  const removed = comparePortfolioIntelligenceReferences(
    reference,
    createPortfolioIntelligenceReference(base),
  );
  assert.equal(removed.materialChanges.find((item) => item.code === code)?.state, "resolved");
  assert.throws(
    () => createPortfolioIntelligenceReference({
      ...base,
      warnings: [{
        code: "CURRENT_COMPETENCE_IGNORED",
        competence: "2026-00",
        message: "Inválido.",
      }],
    }),
    /Competência do aviso 1 inválido/,
  );
});

test("queda de confiança é qualidade e não deterioração financeira", () => {
  const base = analyze();
  const lowerConfidence: PortfolioIntelligenceResult = {
    ...base,
    dataQuality: {
      ...base.dataQuality,
      confidence: { ...base.dataQuality.confidence, trend: "low" },
    },
  };
  const comparison = comparePortfolioIntelligenceReferences(
    createPortfolioIntelligenceReference(base),
    createPortfolioIntelligenceReference(lowerConfidence),
  );
  const confidence = comparison.materialChanges.find((item) => item.code === "QUALITY_CONFIDENCE_TREND");
  assert.equal(confidence?.category, "quality");
  assert.equal(confidence?.state, "aggravated");
});

test("cobertura de renda gera exatamente uma mudança INCOME_COVERAGE", () => {
  const base = analyze();
  const lowerCoverage: PortfolioIntelligenceResult = {
    ...base,
    dataQuality: {
      ...base.dataQuality,
      incomeCoveragePercent: 50,
      incomeKnownPositionCount: Math.max(0, base.dataQuality.incomeKnownPositionCount - 1),
    },
  };
  const comparison = comparePortfolioIntelligenceReferences(
    createPortfolioIntelligenceReference(base),
    createPortfolioIntelligenceReference(lowerCoverage),
  );
  assert.equal(comparison.changes.filter((item) => item.code === "INCOME_COVERAGE").length, 1);
});

test("alterações de contagem de cobertura não são reduzidas a fingerprint genérico", () => {
  const base = analyze();
  const changed: PortfolioIntelligenceResult = {
    ...base,
    dataQuality: {
      ...base.dataQuality,
      pricedPositionCount: base.dataQuality.pricedPositionCount + 1,
    },
  };
  const comparison = comparePortfolioIntelligenceReferences(
    createPortfolioIntelligenceReference(base),
    createPortfolioIntelligenceReference(changed),
  );
  const count = comparison.materialChanges.find((item) => item.code === "PRICED_POSITION_COUNT");
  assert.equal(count?.category, "coverage");
  assert.equal(count?.state, "reduced");
  assert.ok(!comparison.materialChanges.some((item) => item.code === "DATA_FINGERPRINT_CHANGED"));
});

test("mudança canônica não representada nas métricas mínimas continua auditável", () => {
  const base = analyze();
  const previous = createPortfolioIntelligenceReference(base, {
    dataFingerprint: "a".repeat(64),
    policyFingerprint: "b".repeat(64),
  });
  const current = createPortfolioIntelligenceReference(base, {
    dataFingerprint: "c".repeat(64),
    policyFingerprint: "b".repeat(64),
  });
  const comparison = comparePortfolioIntelligenceReferences(previous, current);
  assert.equal(comparison.status, "unchanged");
  assert.equal(comparison.materialChanges.length, 0);
  assert.equal(comparison.changes.length, 1);
  assert.equal(comparison.changes[0]?.code, "DATA_FINGERPRINT_CHANGED");
  assert.equal(comparison.changes[0]?.category, "data");
  assert.equal(comparison.changes[0]?.material, false);
});

test("unicidade de ids e códigos é fail-closed", () => {
  assert.throws(
    () => assertUniquePortfolioIncrementalChanges([
      { id: "data:A:new", code: "A" },
      { id: "data:B:new", code: "A" },
    ]),
    (error: unknown) => (
      error instanceof Error
      && error.name === "PortfolioIncrementalValidationError"
      && "code" in error
      && error.code === "DUPLICATE_CHANGE"
    ),
  );

  const comparison = comparePortfolioIntelligenceReferences(
    createPortfolioIntelligenceReference(analyze({
      history: [100, 100, 100, 100, 100, 100],
      positions: [position("AAAA11", 100)],
    })),
    createPortfolioIntelligenceReference(analyze({
      history: [100, 100, 100, 80, 80, 80],
      positions: [position("AAAA11", 50), position("BBBB11", 50, 0)],
    })),
  );
  assert.equal(new Set(comparison.changes.map((item) => item.id)).size, comparison.changes.length);
  assert.equal(new Set(comparison.changes.map((item) => item.code)).size, comparison.changes.length);
});

test("comparação é determinística para as mesmas referências", () => {
  const previous = createPortfolioIntelligenceReference(analyze({ history: [100, 100, 100, 100, 100, 100] }));
  const current = createPortfolioIntelligenceReference(analyze({ history: [100, 100, 100, 80, 80, 80] }));
  assert.deepEqual(
    comparePortfolioIntelligenceReferences(previous, current),
    comparePortfolioIntelligenceReferences(previous, current),
  );
});
