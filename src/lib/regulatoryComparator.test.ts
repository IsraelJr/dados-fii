import test from "node:test";
import assert from "node:assert/strict";
import { compareRegulatoryFunds } from "./regulatoryComparator.ts";

test("comparator excludes unavailable liquidity instead of estimating it", () => {
  const result = compareRegulatoryFunds([
    {
      ticker: "KNCA11",
      scores: { overall: 88, risk: 12, liquidity: null },
      facts: {},
    },
    {
      ticker: "MXRF11",
      scores: { overall: 84, risk: 18, liquidity: null },
      facts: {},
    },
  ]);

  const liquidity = result.dimensions.find((dimension) => dimension.key === "liquidity");
  assert.equal(liquidity?.winner, null);
  assert.ok(liquidity?.values.every((item) => item.assessed === false));
  assert.equal(result.highlights.overallLeader?.ticker, "KNCA11");
  assert.equal(result.highlights.lowerObservedRisk?.ticker, "KNCA11");
});

test("comparator handles ties without declaring a single winner", () => {
  const result = compareRegulatoryFunds([
    { ticker: "VGIA11", scores: { overall: 80, risk: 20 }, facts: {} },
    { ticker: "KNCA11", scores: { overall: 80, risk: 20 }, facts: {} },
  ]);

  assert.equal(result.highlights.overallLeader?.ticker, null);
  assert.deepEqual(result.highlights.overallLeader?.ties.sort(), ["KNCA11", "VGIA11"]);
});

test("comparator rejects a single fund", () => {
  assert.throws(
    () => compareRegulatoryFunds([{ ticker: "KNCA11", scores: { overall: 90 }, facts: {} }]),
    /ao menos dois fundos/i
  );
});
