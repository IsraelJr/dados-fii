import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryPortfolioHistoryRepository } from "../src/lib/portfolio/InMemoryPortfolioHistoryRepository";
import { PortfolioHistoryService } from "../src/lib/portfolio/PortfolioHistoryService";
import type { PortfolioHistoryEntry } from "../src/lib/portfolio/PortfolioHistory";

const NOW = new Date("2026-07-27T12:00:00.000Z");

function service() {
  const repository = new InMemoryPortfolioHistoryRepository();
  return {
    repository,
    service: new PortfolioHistoryService(repository, () => NOW),
  };
}

test("isola histórico por owner mesmo com carteira e competência iguais", async () => {
  const context = service();
  await context.service.createManual({ ownerId: "user-a" }, {
    portfolioId: "default",
    year: 2026,
    month: 6,
    totalValue: "R$ 10.000,00",
  });
  await context.service.createManual({ ownerId: "user-b" }, {
    portfolioId: "default",
    year: 2026,
    month: 6,
    totalValue: "R$ 20.000,00",
  });

  const userA = await context.service.list({ ownerId: "user-a" }, "default");
  const userB = await context.service.list({ ownerId: "user-b" }, "default");

  assert.equal(userA.length, 1);
  assert.equal(userB.length, 1);
  assert.equal(userA[0].totalValue, 10000);
  assert.equal(userB[0].totalValue, 20000);
});

test("rejeita duplicidade na mesma competência e owner", async () => {
  const context = service();
  const input = {
    portfolioId: "default",
    year: 2026,
    month: 6,
    dividends: "100,00",
  } as const;

  await context.service.createManual({ ownerId: "user-a" }, input);
  await assert.rejects(
    context.service.createManual({ ownerId: "user-a" }, input),
    /HISTORY_ENTRY_ALREADY_EXISTS/,
  );
});

test("atualiza somente registro manual e preserva createdAt", async () => {
  const context = service();
  const created = await context.service.createManual({ ownerId: "user-a" }, {
    portfolioId: "default",
    year: 2026,
    month: 6,
    totalValue: "10.000,00",
  });

  const updated = await context.service.updateManual(
    { ownerId: "user-a" },
    created,
    { totalValue: "11.500,50", dividends: "120,00" },
  );

  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.totalValue, 11500.5);
  assert.equal(updated.dividends, 120);
  const stored = await context.service.list({ ownerId: "user-a" }, "default");
  assert.deepEqual(stored, [updated]);
});

test("não permite usar owner diferente para editar registro de outro usuário", async () => {
  const context = service();
  const created = await context.service.createManual({ ownerId: "user-a" }, {
    portfolioId: "default",
    year: 2026,
    month: 6,
    totalValue: 10000,
  });

  await assert.rejects(
    context.service.updateManual(
      { ownerId: "user-b" },
      created,
      { totalValue: 1 },
    ),
    /HISTORY_ENTRY_NOT_FOUND/,
  );
});

test("não permite excluir snapshot automático", async () => {
  const context = service();
  const snapshot: PortfolioHistoryEntry = {
    schemaVersion: 1,
    portfolioId: "default",
    competence: "2026-06",
    totalValue: 10000,
    dividends: 100,
    source: "automatic_snapshot",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };

  await assert.rejects(
    context.service.deleteManual({ ownerId: "user-a" }, snapshot),
    /Somente registros manuais/,
  );
});

test("exclui registro manual sem afetar outro owner", async () => {
  const context = service();
  const userA = await context.service.createManual({ ownerId: "user-a" }, {
    portfolioId: "default",
    year: 2026,
    month: 6,
    totalValue: 10000,
  });
  await context.service.createManual({ ownerId: "user-b" }, {
    portfolioId: "default",
    year: 2026,
    month: 6,
    totalValue: 20000,
  });

  await context.service.deleteManual({ ownerId: "user-a" }, userA);
  assert.deepEqual(await context.service.list({ ownerId: "user-a" }, "default"), []);
  assert.equal((await context.service.list({ ownerId: "user-b" }, "default")).length, 1);
});
