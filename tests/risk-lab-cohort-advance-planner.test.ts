import assert from "node:assert/strict";
import test from "node:test";
import { planRiskLabCohortAdvance } from "../src/lib/risk-lab/RiskLabCohortAdvancePlanner";

const RELEASE = "a".repeat(40);
const OTHER_RELEASE = "b".repeat(40);
const TICKERS = ["DEVA11", "VSLH11", "KNCR11", "KNSC11", "MCCI11", "RBRY11"] as const;

function snapshot(
  status: string,
  completedTickers: string[],
  releaseCommit = RELEASE,
) {
  return {
    releaseCommit,
    status,
    cases: completedTickers.map((ticker) => ({ ticker })),
  };
}

test("inicializa quando não existe tentativa para o release ativo", () => {
  assert.deepEqual(planRiskLabCohortAdvance(RELEASE, TICKERS, null), {
    action: "initialize",
    ticker: null,
  });
  assert.deepEqual(
    planRiskLabCohortAdvance(RELEASE, TICKERS, snapshot("running", [], OTHER_RELEASE)),
    { action: "initialize", ticker: null },
  );
});

test("seleciona sempre o primeiro ticker ainda não persistido", () => {
  assert.deepEqual(
    planRiskLabCohortAdvance(RELEASE, TICKERS, snapshot("running", ["DEVA11", "VSLH11"])),
    { action: "case", ticker: "KNCR11" },
  );
  assert.deepEqual(
    planRiskLabCohortAdvance(RELEASE, TICKERS, snapshot("running", ["VSLH11", "DEVA11", "KNSC11"])),
    { action: "case", ticker: "KNCR11" },
  );
});

test("finaliza somente após os seis casos únicos estarem persistidos", () => {
  assert.deepEqual(
    planRiskLabCohortAdvance(RELEASE, TICKERS, snapshot("running", [...TICKERS])),
    { action: "finalize", ticker: null },
  );
});

test("execução já encerrada é idempotente e não reinicia", () => {
  for (const status of ["passed", "failed", "blocked"]) {
    assert.deepEqual(
      planRiskLabCohortAdvance(RELEASE, TICKERS, snapshot(status, [...TICKERS])),
      { action: "noop", ticker: null },
    );
  }
});

test("falha fechada para release ou coorte inválida", () => {
  assert.throws(
    () => planRiskLabCohortAdvance("main", TICKERS, null),
    /Release ativa inválida/,
  );
  assert.throws(
    () => planRiskLabCohortAdvance(RELEASE, [], null),
    /Coorte inválida/,
  );
  assert.throws(
    () => planRiskLabCohortAdvance(RELEASE, ["DEVA11", "DEVA11"], null),
    /Coorte inválida/,
  );
});
