import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Native strip-types requires explicit extension.
import { validateFundSeoManifest } from "../src/lib/seo/FundSeoManifestValidation.ts";
import type { FundSeoManifest } from "../src/lib/seo/FundSeoManifest.ts";

function validManifest(): FundSeoManifest {
  return {
    schemaVersion: 1,
    generatedAt: "2026-08-04T12:00:00.000Z",
    total: 1,
    indexableTotal: 1,
    entries: [{
      ticker: "KNCR11",
      canonicalPath: "/fii/KNCR11",
      indexable: true,
      decision: "index",
      score: 100,
      lastModified: "2026-08-04T11:00:00.000Z",
      blockers: [],
      warnings: [],
    }],
  };
}

test("valid persisted SEO manifest is accepted without loading Firebase infrastructure", () => {
  assert.doesNotThrow(() => validateFundSeoManifest(validManifest()));
});

test("persisted SEO manifest rejects invalid dates and canonical paths", () => {
  const invalidGeneratedAt = validManifest();
  invalidGeneratedAt.generatedAt = "2026-08-04";
  assert.throws(() => validateFundSeoManifest(invalidGeneratedAt), /Data de geração/);

  const invalidCanonical = validManifest();
  invalidCanonical.entries[0].canonicalPath = "/fii/MXRF11";
  assert.throws(() => validateFundSeoManifest(invalidCanonical), /canonical incompatível/);

  const invalidModified = validManifest();
  invalidModified.entries[0].lastModified = "31/02/2026";
  assert.throws(() => validateFundSeoManifest(invalidModified), /data de modificação inválida/);
});

test("persisted SEO manifest rejects inconsistent decisions and scores", () => {
  const inconsistentDecision = validManifest();
  inconsistentDecision.entries[0].decision = "noindex";
  assert.throws(() => validateFundSeoManifest(inconsistentDecision), /estado indexável inconsistente/);

  const missingModified = validManifest();
  missingModified.entries[0].lastModified = null;
  assert.throws(() => validateFundSeoManifest(missingModified), /não possui data de modificação/);

  const invalidScore = validManifest();
  invalidScore.entries[0].score = 101;
  assert.throws(() => validateFundSeoManifest(invalidScore), /score inválido/);
});

test("persisted SEO manifest rejects duplicates, disorder and inconsistent totals", () => {
  const duplicate = validManifest();
  duplicate.entries.push({ ...duplicate.entries[0] });
  duplicate.total = 2;
  duplicate.indexableTotal = 2;
  assert.throws(() => validateFundSeoManifest(duplicate), /tickers duplicados/);

  const unordered = validManifest();
  unordered.entries = [
    { ...unordered.entries[0], ticker: "MXRF11", canonicalPath: "/fii/MXRF11" },
    { ...unordered.entries[0], ticker: "KNCR11", canonicalPath: "/fii/KNCR11" },
  ];
  unordered.total = 2;
  unordered.indexableTotal = 2;
  assert.throws(() => validateFundSeoManifest(unordered), /ordenado por ticker/);

  const inconsistentTotal = validManifest();
  inconsistentTotal.total = 2;
  assert.throws(() => validateFundSeoManifest(inconsistentTotal), /Total do manifesto SEO inconsistente/);
});
