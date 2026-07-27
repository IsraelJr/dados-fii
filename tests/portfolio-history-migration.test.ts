import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLegacyWalletSnapshots } from "../src/lib/portfolio/LegacyPortfolioHistoryMigration.ts";
import { InMemoryPortfolioHistoryRepository } from "../src/lib/portfolio/InMemoryPortfolioHistoryRepository.ts";
import { PortfolioHistoryService } from "../src/lib/portfolio/PortfolioHistoryService.ts";

const NOW = new Date("2026-07-27T12:00:00.000Z");

test("normaliza somente o ano corrente e rejeita futuro ou valor inválido", () => {
  const result = normalizeLegacyWalletSnapshots("default", [
    { monthKey: "2026-01", totalValue: "10.000,00", estimatedMonthlyIncome: "100,00" },
    { monthKey: "2026-08", totalValue: 11000 },
    { monthKey: "2025-12", totalValue: 9000 },
    { monthKey: "inválido", totalValue: 1 },
    { monthKey: "2026-02", totalValue: "1,2,3" },
  ], NOW);

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].competence, "2026-01");
  assert.equal(result.entries[0].source, "legacy");
  assert.equal(result.entries[0].totalValue, 10000);
  assert.equal(result.entries[0].dividends, 100);
  assert.equal(result.rejected, 4);
});

test("deduplica competência no payload mantendo a última ocorrência válida", () => {
  const result = normalizeLegacyWalletSnapshots("default", [
    { monthKey: "2026-03", totalValue: 10000 },
    { monthKey: "2026-03", totalValue: 12000 },
  ], NOW);

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].totalValue, 12000);
});

test("importação é idempotente e não sobrescreve competência existente", async () => {
  const repository = new InMemoryPortfolioHistoryRepository();
  const service = new PortfolioHistoryService(repository, () => NOW);
  const normalized = normalizeLegacyWalletSnapshots("default", [
    { monthKey: "2026-01", totalValue: 10000 },
    { monthKey: "2026-02", totalValue: 11000 },
  ], NOW);

  assert.deepEqual(await service.importLegacy({ ownerId: "user-a" }, normalized.entries), {
    imported: 2,
    skipped: 0,
  });
  assert.deepEqual(await service.importLegacy({ ownerId: "user-a" }, normalized.entries), {
    imported: 0,
    skipped: 2,
  });
  assert.equal((await service.list({ ownerId: "user-a" }, "default")).length, 2);
});

test("migração de um usuário não afeta outro", async () => {
  const repository = new InMemoryPortfolioHistoryRepository();
  const service = new PortfolioHistoryService(repository, () => NOW);
  const normalized = normalizeLegacyWalletSnapshots("default", [
    { monthKey: "2026-01", totalValue: 10000 },
  ], NOW);

  await service.importLegacy({ ownerId: "user-a" }, normalized.entries);
  assert.equal((await service.list({ ownerId: "user-a" }, "default")).length, 1);
  assert.equal((await service.list({ ownerId: "user-b" }, "default")).length, 0);
});
