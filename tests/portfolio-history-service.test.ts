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
    dividends: "R$ 100,00",
  });
  await context.service.createManual({ ownerId: "user-b" }, {
    portfolioId: "default",
    year: 2026,
    month: 6,
    dividends: "R$ 200,00",
  });

  const userA = await context.service.list({ ownerId: "user-a" }, "default");
  const userB = await context.service.list({ ownerId: "user-b" }, "default");

  assert.equal(userA.length, 1);
  assert.equal(userB.length, 1);
  assert.equal(userA[0].totalValue, null);
  assert.equal(userB[0].totalValue, null);
  assert.equal(userA[0].dividends, 100);
  assert.equal(userB[0].dividends, 200);
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

test("atualiza somente dividendos e preserva createdAt", async () => {
  const context = service();
  const created = await context.service.createManual({ ownerId: "user-a" }, {
    portfolioId: "default",
    year: 2026,
    month: 6,
    dividends: "100,00",
  });

  const updated = await context.service.updateManual(
    { ownerId: "user-a" },
    created,
    { dividends: "120,00" },
  );

  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.totalValue, null);
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
    dividends: 100,
  });

  await assert.rejects(
    context.service.updateManual(
      { ownerId: "user-b" },
      created,
      { dividends: 1 },
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
    dividends: 100,
  });
  await context.service.createManual({ ownerId: "user-b" }, {
    portfolioId: "default",
    year: 2026,
    month: 6,
    dividends: 200,
  });

  await context.service.deleteManual({ ownerId: "user-a" }, userA);
  await context.service.deleteManualByCompetence({ ownerId: "user-a" }, "default", "2026-06");
  assert.deepEqual(await context.service.list({ ownerId: "user-a" }, "default"), []);
  assert.equal((await context.service.list({ ownerId: "user-b" }, "default")).length, 1);
});

test("cleanup por competência é idempotente e valida entrada antes do repository", async () => {
  const context = service();
  await context.service.deleteManualByCompetence({ ownerId: "user-a" }, "default", "2026-02");
  await context.service.deleteManualByCompetence({ ownerId: "user-a" }, "default", "2026-02");
  await assert.rejects(
    context.service.deleteManualByCompetence({ ownerId: "user-a" }, "default", "2026-2"),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "INVALID_COMPETENCE",
  );
});
