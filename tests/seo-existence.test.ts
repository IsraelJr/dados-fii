import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Native strip-types requires explicit extension.
import { evaluateFundSeoEligibility } from "../src/lib/seo/SeoEligibilityEvaluator.ts";

test("legacy fund without official catalog remains available as noindex", () => {
  const result = evaluateFundSeoEligibility({
    ticker: "ABCD11",
    publicRecordFound: true,
    catalog: null,
    market: { price: 10, asOf: "2026-08-04T12:00:00Z", plausible: true },
    technical: {
      canonicalPath: "/fii/ABCD11",
      httpStatus: 200,
      privateDataDetected: false,
    },
  });

  assert.equal(result.decision, "noindex");
  assert.ok(result.blockers.includes("MISSING_OFFICIAL_CATALOG"));
  assert.equal(result.blockers.includes("FUND_NOT_FOUND"), false);
});

test("ticker absent from public data and official catalog returns not found", () => {
  const result = evaluateFundSeoEligibility({
    ticker: "ABCD11",
    publicRecordFound: false,
    catalog: null,
    technical: {
      canonicalPath: "/fii/ABCD11",
      httpStatus: 200,
      privateDataDetected: false,
    },
  });

  assert.equal(result.decision, "not-found");
  assert.ok(result.blockers.includes("FUND_NOT_FOUND"));
});
