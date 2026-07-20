import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const smokeService = readFileSync("src/lib/risk-lab/RiskLabProductionSmokeService.ts", "utf8");
const smokeStore = readFileSync("src/lib/risk-lab/RiskLabProductionSmokeStore.ts", "utf8");
const scanStore = readFileSync("src/lib/risk-lab/RiskLabAutomaticScanStore.ts", "utf8");
const smokeRoute = readFileSync("src/app/api/system/risk-lab-production-smoke/route.ts", "utf8");
const adminRoute = readFileSync("src/app/api/admin/system/risk-lab/automatic/route.ts", "utf8");
const smokeWorkflow = readFileSync(".github/workflows/risk-lab-production-smoke.yml", "utf8");

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

test("temporary production trigger is bound to the exact deployed commit", () => {
  assert.match(smokeRoute, /AUTOMATIC_TRIGGER_EXPIRES_AT/);
  assert.match(smokeRoute, /VERCEL_ENV\s*===\s*"production"/);
  assert.match(smokeRoute, /release\s*===\s*process\.env\.VERCEL_GIT_COMMIT_SHA/);
  assert.match(smokeRoute, /runId\s*===\s*RISK_LAB_PRODUCTION_SMOKE_RUN_ID/);
  assert.match(smokeRoute, /source\s*===\s*"github-actions"/);
  assert.match(smokeRoute, /maxDuration\s*=\s*300/);
  assert.doesNotMatch(smokeRoute, /TOKEN|timingSafeEqual|createHash/);
});

test("GitHub workflow waits for Production and retains sanitized evidence", () => {
  assert.match(smokeWorkflow, /github\.sha/);
  assert.match(smokeWorkflow, /source=github-actions/);
  assert.match(smokeWorkflow, /release=\$\{RELEASE_COMMIT\}/);
  assert.match(smokeWorkflow, /http_code.*409/);
  assert.match(smokeWorkflow, /upload-artifact@v4/);
  assert.match(smokeWorkflow, /status.*passed/);
});

test("smoke remains isolated from Premium and notifications", () => {
  const source = executable(smokeService);
  assert.doesNotMatch(source, /getPremiumReport|AIInsights|sendEmail|sendNotification|createAlert/);
  assert.match(source, /premiumIntegrated:\s*false/);
  assert.match(source, /notificationsSent:\s*false/);
  assert.match(adminRoute, /RISK_LAB_AUTOMATIC_RATE_LIMIT/);
});
