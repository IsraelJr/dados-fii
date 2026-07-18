import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BacktestEngine } from "../src/lib/risk-lab/BacktestEngine";
import { loadRiskDataset } from "../src/lib/risk-lab/DatasetLoader";
import { RiskRuleEngine } from "../src/lib/risk-lab/RuleEngine";
import { PILOT_RISK_RULES } from "../src/lib/risk-lab/rules";

const raw = JSON.parse(readFileSync(new URL("../docs/risk-lab/datasets/candidate-hctr-tgar-v0.1.json", import.meta.url), "utf8"));
const dataset = loadRiskDataset(raw);
const backtest = new BacktestEngine(new RiskRuleEngine(PILOT_RISK_RULES));

function rowsFor(ticker: string) {
  return backtest.run(dataset.snapshots.filter((snapshot) => snapshot.ticker === ticker)).rows;
}

test("document-backed candidate dataset uses publication dates instead of competence dates", () => {
  assert.equal(dataset.metadata.quality, "candidate");

  const tgarJune = dataset.snapshots.find((snapshot) => snapshot.ticker === "TGAR11" && snapshot.observations.semesterCashResultPerShare);
  assert.ok(tgarJune);
  assert.equal(tgarJune.asOf, "2024-07-31T18:15:00-03:00");
  assert.equal(tgarJune.observations.semesterCashResultPerShare?.competenceDate, "2024-06-28T23:59:59-03:00");
  assert.equal(tgarJune.observations.semesterCashResultPerShare?.knownAt, "2024-07-31T18:15:00-03:00");
});

test("candidate dataset reproduces HCTR11 orange and red stages from published evidence", () => {
  const rows = rowsFor("HCTR11");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].asOf, "2024-11-22T18:19:00-03:00");
  assert.equal(rows[0].deteriorationAlert, "orange");
  assert.equal(rows[1].asOf, "2024-12-12T15:54:00-03:00");
  assert.equal(rows[1].deteriorationAlert, "red");
});

test("candidate dataset reproduces TGAR11 yellow and orange stages without inventing January cash data", () => {
  const rows = rowsFor("TGAR11");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].deteriorationAlert, "yellow");
  assert.equal(rows[1].deteriorationAlert, "green");
  assert.equal(rows[2].deteriorationAlert, "orange");
  assert.equal(dataset.snapshots.at(-1)?.observations.cashResultPerShare, undefined);
});

test("candidate dataset cannot be relabeled gold without stronger primary evidence", () => {
  const promoted = structuredClone(raw);
  promoted.metadata.quality = "gold";
  assert.throws(() => loadRiskDataset(promoted), /must be confirmed in a gold dataset/);
});
