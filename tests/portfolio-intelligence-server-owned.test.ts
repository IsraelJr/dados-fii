import assert from "node:assert/strict";
import test from "node:test";
import type {
  PortfolioIntelligenceInput,
  PortfolioIntelligenceResult,
} from "../src/lib/portfolio-intelligence/PortfolioIntelligence";
import type { PortfolioIntelligenceReference } from "../src/lib/portfolio-intelligence/PortfolioIntelligenceIncremental";
import { comparePortfolioIntelligenceReferences } from "../src/lib/portfolio-intelligence/PortfolioIntelligenceIncremental";
import type {
  PortfolioIntelligenceReferenceRepository,
  PortfolioIntelligenceReferenceStoreResult,
} from "../src/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalService";
import { PortfolioIntelligenceService } from "../src/lib/portfolio-intelligence/PortfolioIntelligenceService";
import { PORTFOLIO_INTELLIGENCE_POLICY } from "../src/lib/portfolio-intelligence/PortfolioIntelligencePolicy";
import type { PublicFundData } from "../src/types/regulatory";
import type {
  PortfolioIntelligenceCanonicalSource,
  PortfolioIntelligenceSourceRepository,
} from "../src/server/repositories/FirestorePortfolioIntelligenceSourceRepositoryCore";
import {
  extractPortfolioIntelligenceWallet,
  normalizePortfolioIntelligenceSnapshotDocument,
} from "../src/server/repositories/FirestorePortfolioIntelligenceSourceRepositoryCore";
import { PortfolioIntelligenceCanonicalInputService } from "../src/server/services/PortfolioIntelligenceCanonicalInputService";
import {
  PortfolioIntelligenceReferenceFactory,
  sha256PortfolioIntelligenceValue,
} from "../src/server/services/PortfolioIntelligenceReferenceFactory";
import { PortfolioIncrementalServerAnalysisService } from "../src/server/services/PortfolioIncrementalServerAnalysisService";
import { PortfolioIncrementalStoredComparisonService } from "../src/server/services/PortfolioIncrementalStoredComparisonService";
import {
  resolvePortfolioIntelligenceReferenceTransition,
  type PortfolioIntelligencePersistedReferencePair,
} from "../src/server/repositories/FirestorePortfolioIntelligenceReferenceRepositoryCore";

const AS_OF = "2026-08-10T15:00:00.000Z";

function sourceData(): PortfolioIntelligenceCanonicalSource {
  return Object.freeze({
    wallet: Object.freeze([
      Object.freeze({ ticker: "AAAA11", quantity: 10 }),
      Object.freeze({ ticker: "BBBB11", quantity: 5 }),
    ]),
    snapshots: Object.freeze([
      Object.freeze({ competence: "2026-01", dividends: 47 }),
      Object.freeze({ competence: "2026-02", dividends: 450.03 }),
      Object.freeze({ competence: "2026-03", dividends: 87.06 }),
      Object.freeze({ competence: "2026-04", dividends: 40 }),
      Object.freeze({ competence: "2026-05", dividends: 50 }),
      Object.freeze({ competence: "2026-06", dividends: 60 }),
    ]),
  });
}

class MemorySource implements PortfolioIntelligenceSourceRepository {
  readonly value: PortfolioIntelligenceCanonicalSource;
  calls = 0;

  constructor(value: PortfolioIntelligenceCanonicalSource) {
    this.value = value;
  }

  async load() {
    this.calls += 1;
    return this.value;
  }
}

class MemoryReferences implements PortfolioIntelligenceReferenceRepository {
  current: PortfolioIntelligenceReference | null = null;

  async compareAndStore(input: Readonly<{
    ownerId: string;
    portfolioId: string;
    current: PortfolioIntelligenceReference;
  }>): Promise<PortfolioIntelligenceReferenceStoreResult> {
    const previous = this.current;
    this.current = input.current;
    return {
      previous,
      current: input.current,
      stored: true,
      baselineState: previous ? "found" : "missing",
    };
  }
}

function publicFund(ticker: string, fields: Record<string, unknown>): PublicFundData {
  return {
    code: ticker,
    ticker,
    fundKind: "FII",
    regulatoryMeta: {
      schemaVersion: 1,
      currentVersion: 1,
      cache: "miss",
      sources: [],
      validation: { valid: true, issues: [] },
    },
    ...fields,
  };
}

test("entrada server-owned usa getMany uma vez e propaga o mesmo asOf", async () => {
  const source = new MemorySource(sourceData());
  const calls: Array<{ values: unknown[]; limit: number | undefined; asOf: Date | string | undefined }> = [];
  const service = new PortfolioIntelligenceCanonicalInputService({
    source,
    regulatory: {
      async getMany(values, limit, options) {
        calls.push({ values, limit, asOf: options?.asOf });
        return {
          items: {
            AAAA11: publicFund("AAAA11", { price: "R$ 10,50", lastDividend: 0.8, segment_new: "Tijolo" }),
            BBBB11: publicFund("BBBB11", { price: "20.91", segment: "Papel" }),
          },
          errors: { BBBB11: "renda indisponível" },
        };
      },
    },
  });

  const input = await service.load({ ownerId: "owner-a", portfolioId: "default", asOf: AS_OF });

  assert.equal(source.calls, 1);
  assert.deepEqual(calls, [{ values: ["AAAA11", "BBBB11"], limit: 120, asOf: AS_OF }]);
  assert.deepEqual(input.snapshots, sourceData().snapshots);
  assert.deepEqual(input.positions, [
    { ticker: "AAAA11", quantity: 10, price: 10.5, estimatedIncome: 8, segment: "Tijolo" },
    { ticker: "BBBB11", quantity: 5, price: 20.91, estimatedIncome: null, segment: "Papel" },
  ]);
});

test("carteira diferente de default falha antes de qualquer leitura", async () => {
  const source = new MemorySource(sourceData());
  const canonical = new PortfolioIntelligenceCanonicalInputService({
    source,
    regulatory: {
      async getMany() {
        throw new Error("não deveria consultar dados regulatórios");
      },
    },
  });

  await assert.rejects(
    canonical.load({ ownerId: "owner-a", portfolioId: "retirement", asOf: AS_OF }),
    /PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED/,
  );
  assert.equal(source.calls, 0);
});

test("wallet canônica vazia é autoritativa e não promove favoritos a posições", () => {
  assert.deepEqual(extractPortfolioIntelligenceWallet({
    wallet: [],
    favorites: ["FAKE11"],
    monitoredFiis: [{ ticker: "OTHER11", quotas: 3 }],
  }), []);
  assert.deepEqual(extractPortfolioIntelligenceWallet({
    favorites: [{ ticker: "LEGACY11", quotas: 2 }],
  }), [{ ticker: "LEGACY11", quotas: 2 }]);
  assert.deepEqual(extractPortfolioIntelligenceWallet({
    wallet: { items: [{ ticker: "CANON11", quotas: 4 }] },
    favorites: [{ ticker: "IGNORED11", quotas: 9 }],
  }), [{ ticker: "CANON11", quotas: 4 }]);
});

test("snapshot preserva renda zero como fato conhecido e distingue ausência", () => {
  assert.deepEqual(normalizePortfolioIntelligenceSnapshotDocument("2026-02", {
    monthKey: "2026-02",
    estimatedDividendIncome: 0,
    totalValue: 0,
  }), { competence: "2026-02", dividends: 0, totalValue: 0 });
  assert.deepEqual(normalizePortfolioIntelligenceSnapshotDocument("2026-03", {
    monthKey: "2026-03",
    totalValue: 100,
  }), { competence: "2026-03", dividends: null, totalValue: 100 });
  assert.equal(normalizePortfolioIntelligenceSnapshotDocument("2026-04", {
    monthKey: "2026-04",
    totalValue: 0,
  }), null);
});

test("factory v2 produz somente hashes SHA-256 e não persiste carteira bruta", () => {
  const input: PortfolioIntelligenceInput = Object.freeze({
    snapshots: sourceData().snapshots,
    positions: Object.freeze([
      Object.freeze({
        ticker: "AAAA11",
        quantity: 73.123456,
        price: 19.876543,
        estimatedIncome: 8.765432,
        segment: "Tijolo",
      }),
    ]),
  });
  const analysis = new PortfolioIntelligenceService().analyze(input, {
    asOf: AS_OF,
    generatedAt: AS_OF,
  });
  const reference = new PortfolioIntelligenceReferenceFactory().create(analysis, input);
  const serialized = JSON.stringify(reference);

  assert.match(reference.fingerprint, /^[a-f0-9]{64}$/);
  assert.match(reference.dataFingerprint, /^[a-f0-9]{64}$/);
  assert.match(reference.policyFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(serialized.includes("positions"), false);
  assert.equal(serialized.includes("snapshots"), false);
  assert.equal(serialized.includes("quantity"), false);
  assert.equal(serialized.includes("owner-a"), false);
  assert.equal(serialized.includes("@"), false);
});

test("data fingerprint é estável por ordem e muda quando a fonte canônica muda", () => {
  const factory = new PortfolioIntelligenceReferenceFactory();
  const base: PortfolioIntelligenceInput = Object.freeze({
    snapshots: sourceData().snapshots,
    positions: Object.freeze([
      Object.freeze({ ticker: "AAAA11", quantity: 10, price: 10, estimatedIncome: 1, segment: "Tijolo" }),
      Object.freeze({ ticker: "BBBB11", quantity: 5, price: 20, estimatedIncome: 2, segment: "Papel" }),
    ]),
  });
  const reordered: PortfolioIntelligenceInput = Object.freeze({
    snapshots: Object.freeze([...base.snapshots].reverse()),
    positions: Object.freeze([...base.positions].reverse()),
  });
  const changed: PortfolioIntelligenceInput = Object.freeze({
    ...base,
    positions: Object.freeze(base.positions.map((position) => (
      position.ticker === "AAAA11" ? Object.freeze({ ...position, quantity: 11 }) : position
    ))),
  });
  const projectionEquivalent: PortfolioIntelligenceInput = Object.freeze({
    ...base,
    positions: Object.freeze(base.positions.map((position) => (
      position.ticker === "AAAA11"
        ? Object.freeze({ ...position, quantity: position.quantity + 0.00000001 })
        : position
    ))),
  });
  const analyzer = new PortfolioIntelligenceService();
  const first = factory.create(analyzer.analyze(base, { asOf: AS_OF, generatedAt: AS_OF }), base);
  const same = factory.create(analyzer.analyze(reordered, { asOf: AS_OF, generatedAt: AS_OF }), reordered);
  const different = factory.create(analyzer.analyze(changed, { asOf: AS_OF, generatedAt: AS_OF }), changed);
  const sameProjection = factory.create(
    analyzer.analyze(projectionEquivalent, { asOf: AS_OF, generatedAt: AS_OF }),
    projectionEquivalent,
  );

  assert.equal(first.dataFingerprint, same.dataFingerprint);
  assert.equal(first.policyFingerprint, same.policyFingerprint);
  assert.notEqual(first.dataFingerprint, different.dataFingerprint);
  assert.deepEqual(first.metrics, sameProjection.metrics);
  assert.notEqual(first.dataFingerprint, sameProjection.dataFingerprint);
  assert.equal(first.policyFingerprint, sha256PortfolioIntelligenceValue({
    schema: "portfolio-intelligence-policy-v2",
    policy: PORTFOLIO_INTELLIGENCE_POLICY,
  }));
});

test("fingerprint usa somente competências encerradas na data-base", () => {
  const factory = new PortfolioIntelligenceReferenceFactory();
  const base: PortfolioIntelligenceInput = Object.freeze({
    snapshots: Object.freeze([
      Object.freeze({ competence: "2026-07", dividends: 70 }),
      Object.freeze({ competence: "2026-08", dividends: 10 }),
      Object.freeze({ competence: "2026-09", dividends: 20 }),
    ]),
    positions: Object.freeze([
      Object.freeze({ ticker: "AAAA11", quantity: 10, price: 10, estimatedIncome: 1, segment: "Tijolo" }),
    ]),
  });
  const create = (input: PortfolioIntelligenceInput) => factory.create(
    new PortfolioIntelligenceService().analyze(input, { asOf: AS_OF, generatedAt: AS_OF }),
    input,
  );
  const first = create(base);
  const ignoredChanged = create(Object.freeze({
    ...base,
    snapshots: Object.freeze(base.snapshots.map((snapshot) => {
      if (snapshot.competence === "2026-08") return Object.freeze({ ...snapshot, dividends: 999 });
      if (snapshot.competence === "2026-09") return Object.freeze({ ...snapshot, dividends: 888 });
      return snapshot;
    })),
  }));
  const closedChanged = create(Object.freeze({
    ...base,
    snapshots: Object.freeze(base.snapshots.map((snapshot) => (
      snapshot.competence === "2026-07"
        ? Object.freeze({ ...snapshot, dividends: 71 })
        : snapshot
    ))),
  }));
  const positionChanged = create(Object.freeze({
    ...base,
    positions: Object.freeze([Object.freeze({ ...base.positions[0], quantity: 11 })]),
  }));

  assert.equal(first.dataFingerprint, ignoredChanged.dataFingerprint);
  assert.equal(comparePortfolioIntelligenceReferences(first, ignoredChanged).status, "unchanged");
  assert.notEqual(first.dataFingerprint, closedChanged.dataFingerprint);
  assert.notEqual(first.dataFingerprint, positionChanged.dataFingerprint);
});

test("fachada captura o relógio uma vez para load, análise e referência", async () => {
  let clockCalls = 0;
  const seen: { load?: Date | string; analysis?: Readonly<{ asOf: Date | string; generatedAt?: Date | string }> } = {};
  const input = Object.freeze({
    snapshots: sourceData().snapshots,
    positions: Object.freeze([
      Object.freeze({ ticker: "AAAA11", quantity: 10, price: 10, estimatedIncome: 1, segment: "Tijolo" }),
    ]),
  });
  const analyzer = new PortfolioIntelligenceService();
  const references = new MemoryReferences();
  const service = new PortfolioIncrementalServerAnalysisService({
    input: {
      async load(request) {
        seen.load = request.asOf;
        return input;
      },
    },
    analyzer: {
      analyze(value, options): PortfolioIntelligenceResult {
        seen.analysis = options;
        return analyzer.analyze(value, options);
      },
    },
    references,
    referenceFactory: new PortfolioIntelligenceReferenceFactory(),
    clock: () => {
      clockCalls += 1;
      return new Date(AS_OF);
    },
  });

  const output = await service.compareAndStore({ ownerId: "owner-a", portfolioId: "default" });

  assert.equal(clockCalls, 1);
  assert.equal(seen.load, AS_OF);
  assert.deepEqual(seen.analysis, { asOf: AS_OF, generatedAt: AS_OF });
  assert.equal(output.comparison.status, "baseline");
  assert.equal(output.persistence.stored, true);
});

test("mesmo conteúdo com asOf posterior encerra a mudança e continua explicável", async () => {
  const base: PortfolioIntelligenceInput = Object.freeze({
    snapshots: sourceData().snapshots,
    positions: Object.freeze([
      Object.freeze({ ticker: "AAAA11", quantity: 10, price: 10, estimatedIncome: 1, segment: "Tijolo" }),
    ]),
  });
  const changed: PortfolioIntelligenceInput = Object.freeze({
    ...base,
    snapshots: Object.freeze(base.snapshots.map((snapshot) => (
      snapshot.competence === "2026-06"
        ? Object.freeze({ ...snapshot, dividends: 30 })
        : snapshot
    ))),
  });
  let pair: PortfolioIntelligencePersistedReferencePair | null = null;
  let inputCall = 0;
  const times = [
    new Date("2026-08-01T12:00:00.000Z"),
    new Date("2026-08-02T12:00:00.000Z"),
    new Date("2026-08-03T12:00:00.000Z"),
  ];
  const service = new PortfolioIncrementalServerAnalysisService({
    input: {
      async load() {
        inputCall += 1;
        return inputCall === 1 ? base : changed;
      },
    },
    analyzer: new PortfolioIntelligenceService(),
    references: {
      async compareAndStore({ current }) {
        const transition = resolvePortfolioIntelligenceReferenceTransition(pair, current);
        if (transition.nextPair) pair = transition.nextPair;
        return transition.result;
      },
    },
    referenceFactory: new PortfolioIntelligenceReferenceFactory(),
    clock: () => times.shift()!,
  });

  await service.compareAndStore({ ownerId: "owner-a" });
  const changedResponse = await service.compareAndStore({ ownerId: "owner-a" });
  const unchangedResponse = await service.compareAndStore({ ownerId: "owner-a" });
  assert.equal(changedResponse.comparison.status, "changed");
  assert.equal(unchangedResponse.persistence.stored, true);
  assert.equal(unchangedResponse.comparison.status, "unchanged");
  assert.notEqual(unchangedResponse.comparison.comparisonId, changedResponse.comparison.comparisonId);
  assert.equal(unchangedResponse.comparison.previous?.asOf, "2026-08-02T12:00:00.000Z");
  assert.equal(unchangedResponse.comparison.current.asOf, "2026-08-03T12:00:00.000Z");

  const loader = new PortfolioIncrementalStoredComparisonService({
    async readPair() {
      return pair;
    },
  });
  const loaded = await loader.load({
    ownerId: "owner-a",
    portfolioId: "default",
    currentFingerprint: unchangedResponse.comparison.current.fingerprint,
    comparisonId: unchangedResponse.comparison.comparisonId,
  });
  assert.equal(loaded.comparisonId, unchangedResponse.comparison.comparisonId);
});

test("fachada rejeita portfolioId não default antes do relógio e das dependências", async () => {
  let clockCalls = 0;
  let loadCalls = 0;
  const service = new PortfolioIncrementalServerAnalysisService({
    input: {
      async load() {
        loadCalls += 1;
        return { snapshots: [], positions: [] };
      },
    },
    analyzer: new PortfolioIntelligenceService(),
    references: new MemoryReferences(),
    referenceFactory: new PortfolioIntelligenceReferenceFactory(),
    clock: () => {
      clockCalls += 1;
      return new Date(AS_OF);
    },
  });

  await assert.rejects(
    service.compareAndStore({ ownerId: "owner-a", portfolioId: "other" }),
    /PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED/,
  );
  assert.equal(clockCalls, 0);
  assert.equal(loadCalls, 0);
});

test("explicação recarrega comparação persistida por fingerprint sem mutação", async () => {
  const input = Object.freeze({
    snapshots: sourceData().snapshots,
    positions: Object.freeze([
      Object.freeze({ ticker: "AAAA11", quantity: 10, price: 10, estimatedIncome: 1, segment: "Tijolo" }),
    ]),
  });
  const analyzer = new PortfolioIntelligenceService();
  const factory = new PortfolioIntelligenceReferenceFactory();
  const previous = factory.create(analyzer.analyze(input, {
    asOf: "2026-08-01T12:00:00.000Z",
    generatedAt: "2026-08-01T12:00:00.000Z",
  }), input);
  const changedInput = Object.freeze({
    ...input,
    snapshots: Object.freeze(input.snapshots.map((snapshot) => (
      snapshot.competence === "2026-06"
        ? Object.freeze({ ...snapshot, dividends: 30 })
        : snapshot
    ))),
  });
  const current = factory.create(analyzer.analyze(changedInput, {
    asOf: "2026-08-02T12:00:00.000Z",
    generatedAt: "2026-08-02T12:00:00.000Z",
  }), changedInput);
  let reads = 0;
  const service = new PortfolioIncrementalStoredComparisonService({
    async readPair() {
      reads += 1;
      return { previous, current };
    },
  });
  const expectedComparison = comparePortfolioIntelligenceReferences(previous, current);

  const comparison = await service.load({
    ownerId: "owner-a",
    portfolioId: "default",
    currentFingerprint: current.fingerprint,
    comparisonId: expectedComparison.comparisonId,
  });
  assert.equal(reads, 1);
  assert.equal(comparison.previous?.fingerprint, previous.fingerprint);
  assert.equal(comparison.current.fingerprint, current.fingerprint);

  await assert.rejects(
    service.load({
      ownerId: "owner-a",
      portfolioId: "default",
      currentFingerprint: previous.fingerprint,
      comparisonId: expectedComparison.comparisonId,
    }),
    /PORTFOLIO_INCREMENTAL_REFERENCE_FINGERPRINT_MISMATCH/,
  );
  assert.equal(reads, 2);
});

test("fingerprint inválido da explicação falha antes de ler persistência", async () => {
  let reads = 0;
  const service = new PortfolioIncrementalStoredComparisonService({
    async readPair() {
      reads += 1;
      return null;
    },
  });

  await assert.rejects(
    service.load({
      ownerId: "owner-a",
      currentFingerprint: "não-é-hash",
      comparisonId: "a".repeat(64),
    }),
    /PORTFOLIO_INCREMENTAL_REFERENCE_FINGERPRINT_MISMATCH/,
  );
  assert.equal(reads, 0);
});

test("explicação rejeita comparação antiga quando o conteúdo retorna ao mesmo fingerprint", async () => {
  const analyzer = new PortfolioIntelligenceService();
  const factory = new PortfolioIntelligenceReferenceFactory();
  const firstInput = sourceData();
  const middleInput = Object.freeze({
    snapshots: Object.freeze(firstInput.snapshots.map((snapshot) => (
      snapshot.competence === "2026-06" ? Object.freeze({ ...snapshot, dividends: 12 }) : snapshot
    ))),
    positions: Object.freeze([
      Object.freeze({ ticker: "AAAA11", quantity: 10, price: 10, estimatedIncome: 1, segment: "Tijolo" }),
    ]),
  });
  const canonicalFirst = Object.freeze({
    snapshots: firstInput.snapshots,
    positions: middleInput.positions,
  });
  const x = factory.create(analyzer.analyze(canonicalFirst, {
    asOf: "2026-08-01T12:00:00.000Z",
    generatedAt: "2026-08-01T12:00:00.000Z",
  }), canonicalFirst);
  const yOld = factory.create(analyzer.analyze(middleInput, {
    asOf: "2026-08-02T12:00:00.000Z",
    generatedAt: "2026-08-02T12:00:00.000Z",
  }), middleInput);
  const z = factory.create(analyzer.analyze(canonicalFirst, {
    asOf: "2026-08-03T12:00:00.000Z",
    generatedAt: "2026-08-03T12:00:00.000Z",
  }), canonicalFirst);
  const yCurrent = factory.create(analyzer.analyze(middleInput, {
    asOf: "2026-08-04T12:00:00.000Z",
    generatedAt: "2026-08-04T12:00:00.000Z",
  }), middleInput);
  const oldComparison = comparePortfolioIntelligenceReferences(x, yOld);
  assert.equal(yOld.fingerprint, yCurrent.fingerprint);
  assert.notEqual(oldComparison.comparisonId, comparePortfolioIntelligenceReferences(z, yCurrent).comparisonId);

  const service = new PortfolioIncrementalStoredComparisonService({
    async readPair() {
      return { previous: z, current: yCurrent };
    },
  });
  await assert.rejects(
    service.load({
      ownerId: "owner-a",
      portfolioId: "default",
      currentFingerprint: yOld.fingerprint,
      comparisonId: oldComparison.comparisonId,
    }),
    /PORTFOLIO_INCREMENTAL_REFERENCE_FINGERPRINT_MISMATCH/,
  );
});
