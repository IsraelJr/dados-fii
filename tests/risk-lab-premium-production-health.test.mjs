import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/health/risk-lab-premium/route.ts", "utf8");
const workflow = readFileSync(".github/workflows/risk-lab-production-smoke.yml", "utf8");

test("health check expõe somente estado operacional seguro e imutável", () => {
  assert.match(route, /featureEnabled\("ENABLE_RISK_LAB_PREMIUM_READONLY", false\)/);
  assert.match(route, /mode: "read_only"/);
  assert.match(route, /notificationsAllowed: false/);
  assert.match(route, /externalEffectsAllowed: false/);
  assert.match(route, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(route, /status: enabled \? 200 : 503/);
  assert.doesNotMatch(route, /datasetHash|evidenceHash|calibrationReportHash|privateKey|token/i);
});

test("smoke test exige o SHA implantado e a política read-only completa", () => {
  for (const required of [
    "payload.deploymentCommit === expectedCommit",
    "payload.enabled === true",
    "payload.mode === \"read_only\"",
    "payload.rulesetVersion === \"0.2.0\"",
    "payload.notificationsAllowed === false",
    "payload.externalEffectsAllowed === false",
  ]) {
    assert.ok(workflow.includes(required), required);
  }
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /timeout-minutes: 8/);
  assert.match(workflow, /curl --location --silent --show-error/);
  assert.match(workflow, /seq 1 36/);
});
