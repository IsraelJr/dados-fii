import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("sitemap reads one persisted manifest and never queries funds individually", () => {
  const sitemap = read("src/app/sitemap.ts");

  assert.match(sitemap, /FundSeoManifestRuntime/);
  assert.match(sitemap, /fundSeoManifestService\.getCurrent\(\)/);
  assert.equal((sitemap.match(/\.getCurrent\(/g) || []).length, 1);
  assert.match(sitemap, /isFundSeoManifestFresh\(manifest\)/);
  assert.match(sitemap, /entry\.indexable && entry\.canonicalPath && entry\.lastModified/);
  assert.match(sitemap, /url: `\$\{SITE_URL\}\$\{entry\.canonicalPath\}`/);
  assert.doesNotMatch(sitemap, /getByTicker|getMany|listFunds|getFundDirectory|rebuild\(/);
  assert.doesNotMatch(sitemap, /adminDb|firebase-admin|RegulatoryRepository/);
});

test("sitemap fails closed to static routes when the manifest is absent, stale or unreadable", () => {
  const sitemap = read("src/app/sitemap.ts");

  assert.match(sitemap, /if \(!isFundSeoManifestFresh\(manifest\)\) return staticRoutes/);
  assert.match(sitemap, /try\s*\{/);
  assert.match(sitemap, /catch \(error\)/);
  assert.match(sitemap, /return staticRoutes/);
  assert.doesNotMatch(sitemap, /FALLBACK_TICKERS/);
});

test("manifest persistence is isolated from pure consistency validation", () => {
  const repository = read("src/lib/seo/FundSeoManifestRepository.ts");
  const validation = read("src/lib/seo/FundSeoManifestValidation.ts");
  const collections = read("src/lib/regulatory/RegulatoryTypes.ts");

  assert.match(collections, /seoManifests: "RegulatorySeoManifests"/);
  assert.match(repository, /REGULATORY_COLLECTIONS\.seoManifests/);
  assert.match(repository, /doc\("current"\)/);
  assert.match(repository, /FIRESTORE_SAFE_DOCUMENT_BYTES/);
  assert.match(repository, /validateFundSeoManifest/);
  assert.match(repository, /action: "seo-manifest"/);

  assert.match(validation, /tickers duplicados/);
  assert.match(validation, /ordenado por ticker/);
  assert.match(validation, /canonical incompatível/);
  assert.match(validation, /data de modificação inválida/);
  assert.doesNotMatch(validation, /firebaseAdmin|adminDb|adminFieldValue|RegulatoryRepository/);
});

test("admin and cron routes invoke the runtime composition without direct Firestore access", () => {
  const adminRoute = read("src/app/api/admin/system/seo-manifest/route.ts");
  const cronRoute = read("src/app/api/cron/seo-manifest/route.ts");
  const config = JSON.parse(read("vercel.json"));
  const cron = config.crons.find((item) => item.path === "/api/cron/seo-manifest");

  assert.match(adminRoute, /FundSeoManifestRuntime/);
  assert.match(adminRoute, /authorizeAdminRequest/);
  assert.match(adminRoute, /fundSeoManifestService\.getCurrent/);
  assert.match(adminRoute, /fundSeoManifestService\.rebuild/);
  assert.doesNotMatch(adminRoute, /adminDb|firebase-admin|RegulatoryRepository/);

  assert.match(cronRoute, /FundSeoManifestRuntime/);
  assert.match(cronRoute, /timingSafeEqual/);
  assert.match(cronRoute, /CRON_SECRET/);
  assert.match(cronRoute, /fundSeoManifestService\.rebuild\("cron:seo-manifest"\)/);
  assert.doesNotMatch(cronRoute, /adminDb|firebase-admin|RegulatoryRepository/);
  assert.equal(cron?.schedule, "30 12 * * *");
});

test("manifest service remains pure and runtime composes its infrastructure dependencies", () => {
  const service = read("src/lib/seo/FundSeoManifestService.ts");
  const runtime = read("src/lib/seo/FundSeoManifestRuntime.ts");

  assert.equal((service.match(/\.getMany\(/g) || []).length, 1);
  assert.doesNotMatch(service, /new RegulatoryDataService/);
  assert.doesNotMatch(service, /getByTicker|listFunds/);
  assert.match(service, /new RegulatoryCache<FundSeoManifest>/);
  assert.match(service, /this\.rebuildPromise/);
  assert.doesNotMatch(service, /constructor\([^)]*private readonly/s);
  assert.doesNotMatch(
    service,
    /^import (?!type\b).*from ["']@\/lib\/regulatoryDataService["'];?$/m,
  );
  assert.doesNotMatch(
    service,
    /^import (?!type\b).*from ["']\.\/FundSeoManifestRepository["'];?$/m,
  );
  assert.doesNotMatch(service, /fundSeoManifestRepository|firebaseAdmin|adminDb/);
  assert.match(service, /import type \{ RegulatoryDataService \}/);
  assert.match(service, /import type \{ FundSeoManifestRepository \}/);

  assert.match(runtime, /regulatoryDataService/);
  assert.match(runtime, /fundSeoManifestRepository/);
  assert.match(runtime, /new FundSeoManifestService\(/);
});
