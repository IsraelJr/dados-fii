import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const engine = readFileSync(new URL("../src/lib/portfolioNotificationEngine.ts", import.meta.url), "utf8");

test("portfolio notifications consolidate every event from one run into one email", () => {
  assert.match(engine, /const queuedEmails: QueuedEmailNotification\[\]/);
  assert.match(engine, /deliverEmailBatch\(email, queuedEmails\)/);
  assert.match(engine, /emailsSent = delivery\.sent \? 1 : 0/);
  assert.doesNotMatch(engine, /emitNotification\(/);
});

test("concentration transitions compare stable identities and previous percentages", () => {
  assert.match(engine, /const RISK_ENGINE_VERSION = 2/);
  assert.match(engine, /riskStableKey\(flag\.type, flag\.key\)/);
  assert.match(engine, /previousWeightPercent/);
  assert.match(engine, /riskConfigurationFingerprint/);
  assert.match(engine, /completeRiskData/);
  assert.match(engine, /RISK_ACTIVATION_BUFFER_PERCENT/);
  assert.match(engine, /RISK_RESOLUTION_BUFFER_PERCENT/);
  assert.doesNotMatch(engine, /previousRiskFlags\.includes\(item\.id\)/);
});
