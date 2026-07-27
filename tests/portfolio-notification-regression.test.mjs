import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const engine = readFileSync(new URL("../src/lib/portfolioNotificationEngine.ts", import.meta.url), "utf8");
const preferencesRoute = readFileSync(new URL("../src/app/api/wallet/notification-preferences/route.ts", import.meta.url), "utf8");
const preferencesController = readFileSync(new URL("../src/server/controllers/WalletNotificationPreferencesController.ts", import.meta.url), "utf8");
const preferencesUi = readFileSync(new URL("../src/app/components/PortfolioNotificationPreferences.tsx", import.meta.url), "utf8");

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

test("unchanged dividends suppress scheduled summaries and patrimony uses a stable threshold reference", () => {
  assert.match(engine, /changedDividendTickers/);
  assert.match(engine, /portfolioValueChangeDecision/);
  assert.match(engine, /patrimonyReferenceValue/);
  assert.match(engine, /walletFingerprint/);
  assert.match(engine, /emailEligible: false/);
  assert.doesNotMatch(engine, /scheduleIsDue/);
  assert.doesNotMatch(engine, /digestDue/);
});

test("paid patrimony threshold is authenticated, resolved on the server and configurable in the wallet", () => {
  const implementation = `${preferencesRoute}\n${preferencesController}`;
  assert.match(implementation, /WalletSessions/);
  assert.match(implementation, /paidPlanFromRecord\(user\.data\)/);
  assert.match(implementation, /notificationPreferences\.patrimonyChangeThresholdPercent/);
  assert.doesNotMatch(implementation, /body\?\.(?:isPaid|isPremium|isVip)/);
  assert.match(preferencesUi, /Variação patrimonial para notificar/);
  assert.match(preferencesUi, /plano Grátis/i);
});
