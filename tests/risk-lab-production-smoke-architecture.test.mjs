import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const smokeService = readFileSync("src/lib/risk-lab/RiskLabProductionSmokeService.ts", "utf8");
const smokeStore = readFileSync("src/lib/risk-lab/RiskLabProductionSmokeStore.ts", "utf8");
const scanStore = readFileSync("src/lib/risk-lab/RiskLabAutomaticScanStore.ts", "utf8");
const smokeRoute = readFileSync("src/app/api/system/risk-lab-production-smoke/route.ts", "utf8");
const adminRoute = readFileSync("src/app/api/admin/system/risk-lab/automatic/route.ts", "utf8");
const evidence = JSON.parse(
  readFileSync("docs/production-evidence/risk-lab/risk-lab-3-4-20260720-v1.json", "utf8"),
);

function executable(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("production smoke covers the official Sprint 3.4 matrix", () => {
  for (const value of [
    "HCTR11",
    "MCCI11",
    "RBRY11",
    "invalid-ticker",
    "insufficient-series",
    "ambiguous-credit-event",
  ]) {
    assert.match(smokeService, new RegExp(value));
  }

  for (const checkId of [
    "deployment.production",
    "feature.automatic-discovery",
    "rate-limit.contract",
    "persistence.scans",
    "audit.scans",
    "isolation.external-effects",
    "integrity.scan-hashes",
  ]) {
    assert.match(smokeService, new RegExp(checkId.replaceAll(".", "\\.")));
  }
});

test("automatic scans and smoke evidence use repositories with locks and audit", () => {
  assert.match(scanStore, /RiskLabAutomaticScans/);
  assert.match(scanStore, /RiskLabAutomaticScanAudit/);
  assert.match(scanStore, /runTransaction/);
  assert.match(smokeStore, /RiskLabProductionSmokeRuns/);
  assert.match(smokeStore, /RiskLabProductionSmokeAudit/);
  assert.match(smokeStore, /RiskLabProductionSmokeLocks/);
  assert.match(smokeStore, /acquireLock/);
  assert.match(smokeStore, /releaseLock/);
  assert.match(adminRoute, /repository:\s*riskLabAutomaticScanStore/);
});

test("production evidence endpoint is permanently read-only after closure", () => {
  assert.match(smokeRoute, /export async function GET\(\)/);
  assert.match(smokeRoute, /getPublicEvidence/);
  assert.doesNotMatch(
    smokeRoute,
    /NextRequest|searchParams|run\(\)|VERCEL_GIT_COMMIT_SHA|github-actions|TOKEN|AUTOMATIC_TRIGGER/,
  );

  for (const temporaryPath of [
    ".github/workflows/risk-lab-production-smoke.yml",
    ".github/workflows/risk-lab-production-smoke-release.yml",
    ".github/workflows/risk-lab-closure.yml",
    ".github/workflows/risk-lab-3-4-finalize-pr59.yml",
    ".github/scripts/close-risk-lab-3-4.py",
    ".github/risk-lab-production-smoke.trigger",
    ".github/risk-lab-production-smoke-release.trigger",
    ".github/risk-lab-closure.trigger",
  ]) {
    assert.equal(existsSync(temporaryPath), false, `${temporaryPath} should be removed`);
  }
});

test("approved production evidence is immutable and complete", () => {
  assert.equal(evidence.status, "passed");
  assert.equal(evidence.sprint, "3.4");
  assert.equal(evidence.releaseCommit, "e9a5d6ec263c0aa87961133a361891f60175dba4");
  assert.equal(evidence.checks.length, 11);
  assert.equal(evidence.checks.every((item) => item.status === "passed"), true);
  assert.equal(evidence.cases.length, 6);
  assert.equal(evidence.blockers.length, 0);
  assert.equal(evidence.evidenceHash, "deb0f79597c2fbfb87214c6d05df37cbe782e084e4a7289a487042c3582a567f");
  assert.equal(
    evidence.cases.every(
      (item) => item.premiumIntegrated === false && item.notificationsSent === false,
    ),
    true,
  );
});

test("smoke remains isolated from Premium and notifications", () => {
  const source = executable(smokeService);
  assert.doesNotMatch(
    source,
    /getPremiumReport|AIInsights|sendEmail|sendNotification|createAlert/,
  );
  assert.match(source, /premiumIntegrated:\s*false/);
  assert.match(source, /notificationsSent:\s*false/);
  assert.match(adminRoute, /RISK_LAB_AUTOMATIC_RATE_LIMIT/);
});
