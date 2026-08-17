import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
const serviceSource = readFileSync("src/lib/regulatoryDataService.ts", "utf8");
const readModelSource = readFileSync("src/lib/risk-lab/RiskLabPremiumReadModel.ts", "utf8");
const discoveryControllerSource = readFileSync("src/server/controllers/PremiumDiscoveryController.ts", "utf8");

const ALLOWED_PRODUCT_FLAGS = [
  "ENABLE_INCREMENTAL_PORTFOLIO_REPORT",
  "ENABLE_PREMIUM_DISCOVERY",
  "ENABLE_RISK_LAB_PREMIUM_READONLY",
  "ENABLE_WALLET_RISK_REPORT_AUTOMATIC",
  "ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK",
].sort();

test("rollout Vercel contém somente flags de produto explicitamente auditadas", () => {
  assert.equal(vercelConfig.env?.ENABLE_INCREMENTAL_PORTFOLIO_REPORT, "true");
  assert.equal(vercelConfig.env?.ENABLE_PREMIUM_DISCOVERY, "true");
  assert.equal(vercelConfig.env?.ENABLE_RISK_LAB_PREMIUM_READONLY, "true");
  assert.equal(vercelConfig.env?.ENABLE_WALLET_RISK_REPORT_AUTOMATIC, "true");
  assert.equal(vercelConfig.env?.ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK, "false");
  assert.deepEqual(Object.keys(vercelConfig.env || {}).sort(), ALLOWED_PRODUCT_FLAGS);
});

test("código permanece fail-closed fora do deployment configurado", () => {
  assert.match(
    serviceSource,
    /featureEnabled\("ENABLE_RISK_LAB_PREMIUM_READONLY", false\)/,
  );
  assert.match(
    discoveryControllerSource,
    /featureEnabled\("ENABLE_PREMIUM_DISCOVERY", false\)/,
  );
  assert.match(readModelSource, /if \(options\?\.enabled !== true\)/);
  assert.match(readModelSource, /availability: "disabled"/);
});

test("rollout preserva read-only e proibição de efeitos externos", () => {
  assert.match(readModelSource, /readOnly: true/);
  assert.match(readModelSource, /notificationsAllowed: false/);
  assert.match(readModelSource, /externalEffectsAllowed: false/);
  assert.match(readModelSource, /não dispara notificações, não altera carteira/);
});
