import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("fund route derives robots from the centralized SEO decision", () => {
  const layout = read("src/app/fii/[ticker]/layout.tsx");

  assert.match(layout, /loadFundSeoPageData/);
  assert.match(layout, /eligibility\.decision === "index"/);
  assert.match(layout, /eligibility\.decision !== "not-found"/);
  assert.match(layout, /robots:\s*\{/);
  assert.doesNotMatch(layout, /export const metadata/);
});

test("invalid, inactive and missing funds are converted to real 404 responses", () => {
  const layout = read("src/app/fii/[ticker]/layout.tsx");

  assert.match(layout, /import \{ notFound, permanentRedirect \} from "next\/navigation"/);
  assert.match(layout, /eligibility\.decision === "not-found"\) notFound\(\)/);
});

test("non-canonical ticker casing permanently redirects to the uppercase URL", () => {
  const layout = read("src/app/fii/[ticker]/layout.tsx");

  assert.match(layout, /rawTicker !== pageData\.ticker/);
  assert.match(layout, /permanentRedirect\(`\/fii\/\$\{pageData\.ticker\}`\)/);
  assert.match(layout, /canonical: `\/fii\/\$\{canonicalTicker\}`/);
});

test("SEO page loader uses the regulatory service and never the repository directly", () => {
  const loader = read("src/lib/seo/FundSeoPageData.ts");

  assert.match(loader, /regulatoryDataService\.getByTicker/);
  assert.match(loader, /cache\(async/);
  assert.doesNotMatch(loader, /RegulatoryRepository/);
  assert.doesNotMatch(loader, /firebaseAdmin|adminDb|firestore/i);
});

test("editorial registry defaults to no approved programmatic pages", () => {
  const registry = read("src/lib/seo/FundSeoEditorialRegistry.ts");

  assert.match(registry, /Object\.freeze\(\{\}\)/);
  assert.doesNotMatch(registry, /MXRF11|KNCR11|BTLG11|XPML11|TGAR11|BODB11/);
});
