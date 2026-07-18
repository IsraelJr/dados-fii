import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BacktestEngine } from "../src/lib/risk-lab/BacktestEngine";
import { loadRiskDataset } from "../src/lib/risk-lab/DatasetLoader";
import { RiskRuleEngine } from "../src/lib/risk-lab/RuleEngine";
import { PILOT_RISK_RULES } from "../src/lib/risk-lab/rules";

const raw = JSON.parse(readFileSync(new URL("../docs/risk-lab/datasets/candidate-hctr-tgar-v0.1.json", import.meta.url), "utf8"));
const goldRaw = JSON.parse(readFileSync(new URL("../docs/risk-lab/datasets/gold-hctr-tgar-v0.1.json", import.meta.url), "utf8"));
const dataset = loadRiskDataset(raw);
const goldDataset = loadRiskDataset(goldRaw);
const backtest = new BacktestEngine(new RiskRuleEngine(PILOT_RISK_RULES));

function rowsFor(ticker: string) {
  return backtest.run(dataset.snapshots.filter((snapshot) => snapshot.ticker === ticker)).rows;
}

test("document-backed candidate dataset uses publication dates instead of competence dates", () => {
  assert.equal(dataset.metadata.quality, "candidate");
  assert.equal(dataset.metadata.productionApproved, false);

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

test("gold seed has explicit approval only for HCTR11 admin unit test", () => {
  assert.equal(goldDataset.metadata.quality, "gold");
  assert.equal(goldDataset.metadata.productionApproved, true);
  assert.equal(goldDataset.metadata.productionApproval?.scope, "admin_unit_test_only");
  assert.deepEqual(goldDataset.metadata.productionApproval?.allowedTickers, ["HCTR11"]);
  assert.match(goldDataset.metadata.productionApproval?.approvalHash || "", /^[a-f0-9]{64}$/);
  assert.equal(goldDataset.snapshots.length, 1);

  const cashEvidence = goldDataset.snapshots[0].observations.cashResultPerShare?.evidence[0];
  assert.equal(cashEvidence?.sourceType, "primary_regulatory");
  assert.equal(cashEvidence?.page, 3);
  assert.equal(cashEvidence?.publishedAt, "2024-12-12T15:54:00-03:00");
  assert.equal(cashEvidence?.reviewMethod, "manual_document_review");
});

test("gold HCTR11 seed reproduces the red distribution-without-result alert", () => {
  const [row] = backtest.run(goldDataset.snapshots).rows;
  const criticalHit = row.hits.find((hit) => hit.ruleId === "HY-003");

  assert.equal(row.deteriorationAlert, "red");
  assert.ok(criticalHit);
  assert.equal(criticalHit.confidence, 99);
  assert.equal(row.confidence, 95);
});

test("gold datasets reject secondary evidence, missing pages and automated-only review", () => {
  const secondary = structuredClone(goldRaw);
  secondary.snapshots[0].observations.cashResultPerShare.evidence[0].sourceType = "secondary";
  assert.throws(() => loadRiskDataset(secondary), /sourceType must be primary/);

  const missingPage = structuredClone(goldRaw);
  delete missingPage.snapshots[0].observations.cashResultPerShare.evidence[0].page;
  assert.throws(() => loadRiskDataset(missingPage), /page is required/);

  const automated = structuredClone(goldRaw);
  automated.snapshots[0].observations.cashResultPerShare.evidence[0].reviewMethod = "automated_extraction";
  assert.throws(() => loadRiskDataset(automated), /reviewMethod must be manual_document_review/);
});

test("production approval rejects missing audit metadata, invalid hash and wider ticker scope", () => {
  const missingApproval = structuredClone(goldRaw);
  delete missingApproval.metadata.productionApproval;
  assert.throws(() => loadRiskDataset(missingApproval), /productionApproval is required/);

  const invalidHash = structuredClone(goldRaw);
  invalidHash.metadata.productionApproval.approvalHash = "invalid";
  assert.throws(() => loadRiskDataset(invalidHash), /SHA-256/);

  const invalidScope = structuredClone(goldRaw);
  invalidScope.metadata.productionApproval.scope = "public";
  assert.throws(() => loadRiskDataset(invalidScope), /Unsupported production approval scope/);

  const widerTicker = structuredClone(goldRaw);
  widerTicker.metadata.productionApproval.allowedTickers = ["TGAR11"];
  assert.throws(() => loadRiskDataset(widerTicker), /disallowed ticker: HCTR11/);
});

test("candidate datasets cannot be approved for production", () => {
  const invalidRelease = structuredClone(raw);
  invalidRelease.metadata.productionApproved = true;
  assert.throws(() => loadRiskDataset(invalidRelease), /Only gold datasets can be approved for production/);
});
