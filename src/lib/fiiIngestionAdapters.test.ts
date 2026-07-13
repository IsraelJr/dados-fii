import test from "node:test";
import assert from "node:assert/strict";
import { getIngestionAdapter, listIngestionAdapters } from "./fiiIngestionAdapters.ts";

test("registers FII and FIAGRO adapters with the same capabilities", () => {
  const adapters = listIngestionAdapters();
  assert.deepEqual(adapters.map((item) => item.id).sort(), ["cvm-fiagro-v2", "cvm-fii-v2"]);
  for (const adapter of adapters) {
    assert.equal(adapter.parserVersion, 2);
    assert.equal(adapter.capabilities.monthlyData, true);
    assert.equal(adapter.capabilities.officialDocuments, true);
    assert.equal(adapter.capabilities.reconciliation, true);
    assert.equal(adapter.capabilities.sourceEvidence, true);
  }
});

test("resolves adapter metadata without ticker-specific conditions", () => {
  assert.equal(getIngestionAdapter("cvm-fii-v2").regulatoryFamily, "FII");
  assert.equal(getIngestionAdapter("cvm-fiagro-v2").regulatoryFamily, "FIAGRO");
});
