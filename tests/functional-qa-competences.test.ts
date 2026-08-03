import assert from "node:assert/strict";
import test from "node:test";
import {
  closedCurrentYearCompetences,
  closedQaDividendMonths,
} from "./e2e/support/closedCompetences";

test("janeiro não tenta gravar competência ainda aberta", () => {
  assert.deepEqual(closedCurrentYearCompetences({ year: 2026, month: 1 }), []);
  assert.deepEqual(closedQaDividendMonths({ year: 2026, month: 1 }), []);
});

test("fevereiro usa somente janeiro já encerrado", () => {
  assert.deepEqual(closedCurrentYearCompetences({ year: 2026, month: 2 }), ["2026-01"]);
  assert.deepEqual(closedQaDividendMonths({ year: 2026, month: 2 }).map((entry) => entry.competence), ["2026-01"]);
});

test("virada dezembro/janeiro nunca trata mês aberto como encerrado", () => {
  assert.deepEqual(closedCurrentYearCompetences({ year: 2026, month: 12 }), [
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
    "2026-07", "2026-08", "2026-09", "2026-10", "2026-11",
  ]);
  assert.deepEqual(closedCurrentYearCompetences({ year: 2027, month: 1 }), []);
  assert.equal(closedCurrentYearCompetences({ year: 2026, month: 12 }).includes("2026-12"), false);
  assert.equal(closedCurrentYearCompetences({ year: 2027, month: 1 }).includes("2026-12"), false);
});
