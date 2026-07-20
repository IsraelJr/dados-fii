import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Sprint 2.12 cron is protected, bounded and delegates to one orchestrator", () => {
  const route = read("src/app/api/cron/phase-2-closure/route.ts");
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /maxDuration = 300/);
  assert.match(route, /phase2ClosureService\.advance/);
  assert.match(route, /createHash\("sha256"\)/);
  assert.match(route, /step < 3/);
  assert.match(route, /240_000/);
  assert.doesNotMatch(route, /firebase-admin|adminDb|\.collection\(/);
});

test("Sprint 2.12 performs preview, protected apply, global validation and stratified reports", () => {
  const service = read("src/lib/phase2/Phase2ClosureService.ts");
  for (const operation of ["previewFundCatalog", "applyFundCatalog", "getFundCatalogStatus", "getFundDirectory", "getMany", "runValidation", "getSystemHealth", "getFreeReport", "getAIInsights", "getPremiumReport"]) {
    assert.match(service, new RegExp(`\\.${operation}\\(`));
  }
  assert.match(service, /FII.*FIAGRO.*FI_INFRA|selectStratifiedSamples/s);
  assert.match(service, /selectEdgeSamples/);
  assert.match(service, /smoke\.incomplete-report/);
  assert.match(service, /smoke\.lifecycle-exception/);
  assert.match(service, /schemaVersion\) < PHASE2_CLOSURE_SCHEMA_VERSION/);
  assert.match(service, /evidenceHash/);
  assert.doesNotMatch(service, /firebase-admin|adminDb|\.collection\(|api\.openai\.com/);
});

test("Sprint 2.12 state is locked, JSON-sanitized, audited and historically persisted", () => {
  const repository = read("src/lib/regulatory/RegulatoryRepository.ts");
  const types = read("src/lib/regulatory/RegulatoryTypes.ts");
  assert.match(types, /RegulatoryPhase2ClosureRuns/);
  assert.match(read("src/types/phase2-closure.ts"), /PHASE2_CLOSURE_SCHEMA_VERSION = 2/);
  assert.match(repository, /acquirePhase2ClosureLock/);
  assert.match(repository, /releasePhase2ClosureLock/);
  assert.match(repository, /savePhase2ClosureState/);
  assert.match(repository, /JSON\.parse\(JSON\.stringify\(value\)\)/);
  assert.match(repository, /collection\("history"\)/);
  assert.match(repository, /"phase2-closure"/);
  assert.match(repository, /transaction\.create\(backupRef/);
  assert.match(repository, /approvalHash/);
  assert.match(repository, /publicationHash/);
});

test("public closure evidence is read-only and does not expose credentials or approval hashes", () => {
  const route = read("src/app/api/system/phase-2-closure/route.ts");
  const service = read("src/lib/phase2/Phase2ClosureService.ts");
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function POST|CRON_SECRET|ADMIN_EMAILS|firebase-admin|adminDb/);
  assert.match(route, /noindex, nofollow/);
  assert.match(service, /actor: _actor, error: _error, retryAfter: _retryAfter/);
  assert.doesNotMatch(route, /approvalHash/);
});

test("production schedule has no temporary Phase 2 closure cron and Sprint CI includes the gates", () => {
  const vercel = read("vercel.json");
  const packageJson = read("package.json");
  const workflow = read(".github/workflows/phase-2-closure.yml");
  assert.equal((vercel.match(/\/api\/cron\/phase-2-closure\?attempt=/g) || []).length, 3);
  assert.match(packageJson, /phase-2-closure\.test\.ts/);
  assert.match(packageJson, /phase-2-closure-architecture\.test\.mjs/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run test:sprint2/);
  assert.match(workflow, /npm run test:risk-lab/);
});
