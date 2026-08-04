import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("sitemap reads one persisted manifest and never queries funds individually", () => {
  const sitemap = read("src/app/sitemap.ts");

  assert.match(sitemap, /fundSeoManifestService\.getCurrent\(\)/);
  assert.equal((sitemap.match(/\.getCurrent\(/g) || []).length, 1);
  assert.match(sitemap, /entry\.indexable && entry\.canonicalPath && entry\.lastModified/);
  assert.match(sitemap, /url: `\$\{SITE_URL\}\$\{entry\.canonicalPath\}`/);
  assert.doesNotMatch(sitemap, /getByTicker|getMany|listFunds|getFundDirectory|rebuild\(/);
  assert.doesNotMatch(sitemap, /adminDb|firebase-admin|RegulatoryRepository/);
});

test("sitemap fails closed to static routes when the manifest read fails", () => {
  const sitemap = read("src/app/sitemap.ts");

  assert.match(sitemap, /try\s*\{/);
  assert.match(sitemap, /catch \(error\)/);
  assert.match(sitemap, /return staticRoutes/);
  assert.doesNotMatch(sitemap, /FALLBACK_TICKERS/);
});

test("manifest persistence is isolated in a repository with size and consistency guards", () => {
  const repository = read("src/lib/seo/FundSeoManifestRepository.ts");
  const collections = read("src/lib/regulatory/RegulatoryTypes.ts");

  assert.match(collections, /seoManifests: "RegulatorySeoManifests"/);
  assert.match(repository, /REGULATORY_COLLECTIONS\.seoManifests/);
  assert.match(repository, /doc\("current"\)/);
  assert.match(repository, /FIRESTORE_SAFE_DOCUMENT_BYTES/);
  assert.match(repository, /tickers duplicados/);
  assert.match(repository, /ordenado por ticker/);
  assert.match(repository, /action: "seo-manifest"/);
});

test("admin and cron routes invoke the domain service without direct Firestore access", () => {
  const adminRoute = read("src/app/api/admin/system/seo-manifest/route.ts");
  const cronRoute = read("src/app/api/cron/seo-manifest/route.ts");
  const config = JSON.parse(read("vercel.json"));
  const cron = config.crons.find((item) => item.path === "/api/cron/seo-manifest");

  assert.match(adminRoute, /authorizeAdminRequest/);
  assert.match(adminRoute, /fundSeoManifestService\.getCurrent/);
  assert.match(adminRoute, /fundSeoManifestService\.rebuild/);
  assert.doesNotMatch(adminRoute, /adminDb|firebase-admin|RegulatoryRepository/);

  assert.match(cronRoute, /timingSafeEqual/);
  assert.match(cronRoute, /CRON_SECRET/);
  assert.match(cronRoute, /fundSeoManifestService\.rebuild\("cron:seo-manifest"\)/);
  assert.doesNotMatch(cronRoute, /adminDb|firebase-admin|RegulatoryRepository/);
  assert.equal(cron?.schedule, "30 12 * * *");
});

test("manifest builder loads reviewed funds once in batch and does not create a second fund cache", () => {
  const service = read("src/lib/seo/FundSeoManifestService.ts");

  assert.equal((service.match(/\.getMany\(/g) || []).length, 1);
  assert.doesNotMatch(service, /new RegulatoryDataService/);
  assert.doesNotMatch(service, /getByTicker|listFunds/);
  assert.match(service, /new RegulatoryCache<FundSeoManifest>/);
  assert.match(service, /this\.rebuildPromise/);
});
