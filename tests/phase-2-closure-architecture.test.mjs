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
  assert.match(route, /step < 3/);
  assert.match(route, /240_000/);
  assert.doesNotMatch(route, /export async function POST|TOKEN_HASH|x-phase2-revalidate-token|firebase-admin|adminDb|\.collection\(/);
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

test("production schedule has no temporary Phase 2 closure cron and CI responsibilities are separated", () => {
  const vercel = read("vercel.json");
  const packageJson = read("package.json");
  const coreWorkflow = read(".github/workflows/phase-2-closure.yml");
  const riskLabWorkflow = read(".github/workflows/risk-lab.yml");
  assert.equal((vercel.match(/\/api\/cron\/phase-2-closure/g) || []).length, 0);
  assert.match(packageJson, /phase-2-closure\.test\.ts/);
  assert.match(packageJson, /phase-2-closure-architecture\.test\.mjs/);
  assert.match(coreWorkflow, /npm run typecheck/);
  assert.match(coreWorkflow, /npm run test:sprint2/);
  assert.doesNotMatch(coreWorkflow, /npm run test:risk-lab/);
  assert.match(riskLabWorkflow, /npm run test:risk-lab/);
});

test("persisted Phase 2 evidence is schema v2, passed and covers standard plus edge cases", () => {
  const document = JSON.parse(read("docs/production-evidence/phase-2/phase-2-closure-catalog-20260719204643291-c845f739-v2.json"));
  const evidence = document.evidence;
  assert.equal(document.ok, true);
  assert.equal(evidence.schemaVersion, 2);
  assert.equal(evidence.status, "passed");
  assert.equal(evidence.phase, "complete");
  assert.equal(evidence.evidenceHash, "2a3a3750eaeb55d4bae7c1240d3f29797d752a8382639edce60af02f869867c5");
  assert.equal(evidence.checks.filter((check) => check.status !== "passed").length, 0);
  assert.equal(evidence.smoke.samples.length, 5);
  assert.deepEqual(
    [...new Set(evidence.smoke.samples.map((sample) => sample.caseType))].sort(),
    ["exceptional", "incomplete", "standard"],
  );
  for (const sample of evidence.smoke.samples) {
    assert.equal(sample.basicDataComplete, true);
    assert.equal(sample.freeReport, true);
    assert.equal(sample.aiInsights, true);
    assert.equal(sample.premiumReport, true);
  }
});
