import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Native strip-types requires explicit extension.
import { isFundSeoManifestFresh } from "../src/lib/seo/FundSeoManifest.ts";
import type { FundSeoManifest } from "../src/lib/seo/FundSeoManifest.ts";

const manifest: FundSeoManifest = {
  schemaVersion: 1,
  generatedAt: "2026-08-04T12:00:00.000Z",
  total: 0,
  indexableTotal: 0,
  entries: [],
};

test("SEO manifest is accepted only inside the configured freshness window", () => {
  assert.equal(isFundSeoManifestFresh(manifest, "2026-08-06T00:00:00.000Z"), true);
  assert.equal(isFundSeoManifestFresh(manifest, "2026-08-06T00:00:00.001Z"), false);
});

test("future, invalid and absent SEO manifests fail closed", () => {
  assert.equal(isFundSeoManifestFresh(manifest, "2026-08-04T11:59:59.999Z"), false);
  assert.equal(isFundSeoManifestFresh(manifest, "invalid"), false);
  assert.equal(isFundSeoManifestFresh(null, "2026-08-04T12:00:00.000Z"), false);
  assert.equal(isFundSeoManifestFresh(manifest, "2026-08-04T12:00:00.000Z", 0), false);
});
