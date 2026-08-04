import assert from "node:assert/strict";
import test from "node:test";
import {
  PortfolioIntelligenceIncrementalService,
  PortfolioIntelligenceService,
  type PortfolioIntelligenceReference,
  type PortfolioIntelligenceReferenceRepository,
  type PortfolioIntelligenceReferenceStoreResult,
} from "../src/lib/portfolio-intelligence/index";

class MemoryReferenceRepository implements PortfolioIntelligenceReferenceRepository {
  readonly values = new Map<string, PortfolioIntelligenceReference>();
  writes = 0;

  async compareAndStore(input: Readonly<{
    ownerId: string;
    portfolioId: string;
    current: PortfolioIntelligenceReference;
  }>): Promise<PortfolioIntelligenceReferenceStoreResult> {
    const key = `${input.ownerId}:${input.portfolioId}`;
    const previous = this.values.get(key) ?? null;
    if (previous?.fingerprint === input.current.fingerprint) {
      return { previous, stored: false, baselineState: "found" };
    }
    this.values.set(key, input.current);
    this.writes += 1;
    return {
      previous,
      stored: true,
      baselineState: previous ? "found" : "missing",
    };
  }
}

function result(dividends: readonly number[], generatedAt = "2026-08-04T12:00:00.000Z") {
  return new PortfolioIntelligenceService().analyze({
    snapshots: dividends.map((value, index) => ({
      competence: `2026-${String(index + 1).padStart(2, "0")}`,
      dividends: value,
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

test("serviço salva a primeira referência e retorna baseline", async () => {
  const repository = new MemoryReferenceRepository();
  const service = new PortfolioIntelligenceIncrementalService(repository);
  const output = await service.compareAndStore({ ownerId: "user-a", result: result([100, 100, 100, 100, 100, 100]) });
  assert.equal(output.comparison.status, "baseline");
  assert.equal(output.persistence.stored, true);
  assert.equal(output.persistence.baselineState, "missing");
  assert.equal(repository.writes, 1);
});

test("mesmo conteúdo é idempotente apesar de novo horário de geração", async () => {
  const repository = new MemoryReferenceRepository();
  const service = new PortfolioIntelligenceIncrementalService(repository);
  await service.compareAndStore({ ownerId: "user-a", result: result([100, 100, 100, 100, 100, 100]) });
  const output = await service.compareAndStore({
    ownerId: "user-a",
    result: result([100, 100, 100, 100, 100, 100], "2026-08-04T18:00:00.000Z"),
  });
  assert.equal(output.comparison.status, "unchanged");
  assert.equal(output.persistence.stored, false);
  assert.equal(repository.writes, 1);
});

test("usuários e carteiras diferentes nunca compartilham referência", async () => {
  const repository = new MemoryReferenceRepository();
  const service = new PortfolioIntelligenceIncrementalService(repository);
  await service.compareAndStore({ ownerId: "user-a", portfolioId: "default", result: result([100, 100, 100, 100, 100, 100]) });

  const otherUser = await service.compareAndStore({
    ownerId: "user-b",
    portfolioId: "default",
    result: result([100, 100, 100, 80, 80, 80]),
  });
  const otherPortfolio = await service.compareAndStore({
    ownerId: "user-a",
    portfolioId: "retirement",
    result: result([100, 100, 100, 80, 80, 80]),
  });

  assert.equal(otherUser.comparison.status, "baseline");
  assert.equal(otherPortfolio.comparison.status, "baseline");
  assert.equal(repository.values.size, 3);
});

test("segunda análise material compara e substitui somente a referência atual", async () => {
  const repository = new MemoryReferenceRepository();
  const service = new PortfolioIntelligenceIncrementalService(repository);
  const first = await service.compareAndStore({
    ownerId: "user-a",
    result: result([100, 100, 100, 100, 100, 100]),
  });
  const second = await service.compareAndStore({
    ownerId: "user-a",
    result: result([100, 100, 100, 80, 80, 80]),
  });

  assert.equal(first.comparison.status, "baseline");
  assert.equal(second.comparison.status, "changed");
  assert.equal(second.comparison.previous?.fingerprint, first.comparison.current.fingerprint);
  assert.notEqual(second.comparison.current.fingerprint, first.comparison.current.fingerprint);
  assert.equal(repository.writes, 2);
});

test("identificador inválido falha antes da persistência", async () => {
  const repository = new MemoryReferenceRepository();
  const service = new PortfolioIntelligenceIncrementalService(repository);
  await assert.rejects(
    () => service.compareAndStore({ ownerId: "user-a", portfolioId: "../../outro", result: result([100, 100, 100, 100, 100, 100]) }),
    /Identificador da carteira inválido/,
  );
  assert.equal(repository.writes, 0);
});
