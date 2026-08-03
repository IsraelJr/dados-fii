import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCanEditPortfolioHistory,
  buildCompetence,
  createManualPortfolioHistoryEntry,
  detectPortfolioHistoryConflict,
  insertPortfolioHistoryEntry,
  parseOptionalMoney,
  PortfolioHistoryValidationError,
  requirePortfolioHistoryCompetence,
  type PortfolioHistoryEntry,
} from "../src/lib/portfolio/PortfolioHistory";

const NOW = new Date("2026-07-27T12:00:00.000Z");

function expectCode(fn: () => unknown, code: PortfolioHistoryValidationError["code"]) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof PortfolioHistoryValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

test("normaliza competência para YYYY-MM", () => {
  assert.equal(buildCompetence(2026, 1), "2026-01");
  assert.equal(buildCompetence("2026", "12"), "2026-12");
  expectCode(() => buildCompetence(2026, 0), "INVALID_MONTH");
  expectCode(() => buildCompetence(2026, 13), "INVALID_MONTH");
  expectCode(() => buildCompetence("ano", 1), "INVALID_YEAR");
});

test("valida competência estrita de persistência entre os meses 01 e 12", () => {
  for (let month = 1; month <= 12; month += 1) {
    const competence = `2026-${String(month).padStart(2, "0")}`;
    assert.equal(requirePortfolioHistoryCompetence(competence), competence);
  }
  for (const invalid of ["2026-00", "2026-13", "2026-2", "26-02", "1999-12", "2026-02-extra", ""]) {
    expectCode(() => requirePortfolioHistoryCompetence(invalid), "INVALID_COMPETENCE");
  }
});

test("normaliza moeda pt-BR sem converter erro em zero", () => {
  assert.equal(parseOptionalMoney("R$ 1.234,56"), 1234.56);
  assert.equal(parseOptionalMoney("1234,5"), 1234.5);
  assert.equal(parseOptionalMoney("1234.50"), 1234.5);
  assert.equal(parseOptionalMoney(0), 0);
  assert.equal(parseOptionalMoney(""), null);
  assert.equal(parseOptionalMoney(undefined), null);
  expectCode(() => parseOptionalMoney("1,2,3"), "INVALID_MONEY");
  expectCode(() => parseOptionalMoney(Number.NaN), "INVALID_MONEY");
  expectCode(() => parseOptionalMoney(Number.POSITIVE_INFINITY), "INVALID_MONEY");
  expectCode(() => parseOptionalMoney(-1), "INVALID_MONEY");
});

test("cria registro manual apenas com dividendos e patrimônio nulo", () => {
  const entry = createManualPortfolioHistoryEntry({
    portfolioId: "default",
    year: 2026,
    month: 6,
    dividends: "125,40",
  }, NOW);

  assert.deepEqual(entry, {
    schemaVersion: 1,
    portfolioId: "default",
    competence: "2026-06",
    totalValue: null,
    dividends: 125.4,
    source: "manual",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  });
  assert.equal(Object.isFrozen(entry), true);
});

test("aceita dividendo zero como valor válido", () => {
  const entry = createManualPortfolioHistoryEntry({
    portfolioId: "default",
    year: 2026,
    month: 7,
    dividends: 0,
  }, NOW);

  assert.equal(entry.totalValue, null);
  assert.equal(entry.dividends, 0);
});

test("rejeita competência futura e ausência de dividendos", () => {
  expectCode(() => createManualPortfolioHistoryEntry({
    portfolioId: "default",
    year: 2026,
    month: 8,
    dividends: 100,
  }, NOW), "FUTURE_COMPETENCE");

  expectCode(() => createManualPortfolioHistoryEntry({
    portfolioId: "default",
    year: 2026,
    month: 7,
    dividends: "",
  }, NOW), "EMPTY_ENTRY");
});

test("rejeita identificador de carteira inválido", () => {
  expectCode(() => createManualPortfolioHistoryEntry({
    portfolioId: "../other-user",
    year: 2026,
    month: 7,
    dividends: 100,
  }, NOW), "INVALID_PORTFOLIO_ID");
});

test("detecta duplicidade manual e conflito com snapshot", () => {
  const manual = createManualPortfolioHistoryEntry({
    portfolioId: "default",
    year: 2026,
    month: 6,
    dividends: 100,
  }, NOW);

  assert.deepEqual(detectPortfolioHistoryConflict(manual, manual), {
    competence: "2026-06",
    existingSource: "manual",
    incomingSource: "manual",
    resolution: "reject_duplicate",
  });

  const snapshot: PortfolioHistoryEntry = {
    ...manual,
    source: "automatic_snapshot",
    totalValue: 10000,
  };
  assert.deepEqual(detectPortfolioHistoryConflict(snapshot, manual), {
    competence: "2026-06",
    existingSource: "automatic_snapshot",
    incomingSource: "manual",
    resolution: "require_explicit_resolution",
  });
});

test("insere ordenado e falha fechado em duplicidade", () => {
  const june = createManualPortfolioHistoryEntry({
    portfolioId: "default",
    year: 2026,
    month: 6,
    dividends: 100,
  }, NOW);
  const may = createManualPortfolioHistoryEntry({
    portfolioId: "default",
    year: 2026,
    month: 5,
    dividends: 10,
  }, NOW);

  const entries = insertPortfolioHistoryEntry([june], may);
  assert.deepEqual(entries.map((entry) => entry.competence), ["2026-05", "2026-06"]);
  assert.equal(Object.isFrozen(entries), true);
  expectCode(() => insertPortfolioHistoryEntry(entries, june), "DUPLICATE_COMPETENCE");
});

test("somente registro manual pode ser editado ou excluído", () => {
  const manual = createManualPortfolioHistoryEntry({
    portfolioId: "default",
    year: 2026,
    month: 6,
    dividends: 100,
  }, NOW);
  assert.doesNotThrow(() => assertCanEditPortfolioHistory(manual));

  expectCode(() => assertCanEditPortfolioHistory({
    ...manual,
    source: "automatic_snapshot",
  }), "IMMUTABLE_SNAPSHOT");
  expectCode(() => assertCanEditPortfolioHistory({
    ...manual,
    source: "legacy",
  }), "IMMUTABLE_SNAPSHOT");
});
