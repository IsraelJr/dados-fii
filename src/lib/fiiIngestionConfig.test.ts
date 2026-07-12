import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSupportedIngestionTicker,
  getIngestionAdapterId,
  getIngestionFundConfig,
  isSupportedIngestionTicker,
  SUPPORTED_INGESTION_TICKERS,
} from "./fiiIngestionConfig.ts";

test("FII funds reuse the traditional CVM adapter", () => {
  assert.equal(getIngestionFundConfig("TGAR11")?.fundType, "FII");
  assert.equal(getIngestionAdapterId("TGAR11"), "cvm-fii-v2");
  assert.equal(getIngestionFundConfig("mxrf11")?.fundType, "FII");
  assert.equal(getIngestionAdapterId("MXRF11"), "cvm-fii-v2");
});

test("FIAGRO funds reuse the FIAGRO CVM adapter", () => {
  assert.equal(getIngestionFundConfig("VGIA11")?.fundType, "FIAGRO");
  assert.equal(getIngestionAdapterId("VGIA11"), "cvm-fiagro-v2");
  assert.equal(getIngestionFundConfig("KNCA11")?.fundType, "FIAGRO");
  assert.equal(getIngestionAdapterId("KNCA11"), "cvm-fiagro-v2");
});

test("unsupported regulatory families are blocked before collection", () => {
  assert.equal(getIngestionFundConfig("BODB11")?.fundType, "FI_INFRA");
  assert.equal(isSupportedIngestionTicker("BODB11"), false);
  assert.throws(
    () => assertSupportedIngestionTicker("BODB11"),
    /adaptador FI-Infra ainda não foi desenvolvido/i
  );
});

test("only operational registry entries appear in the execution whitelist", () => {
  assert.deepEqual(
    [...SUPPORTED_INGESTION_TICKERS].sort(),
    ["KNCA11", "MXRF11", "TGAR11", "VGIA11"].sort()
  );
});
