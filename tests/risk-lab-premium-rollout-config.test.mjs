import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
const serviceSource = readFileSync("src/lib/regulatoryDataService.ts", "utf8");
const readModelSource = readFileSync("src/lib/risk-lab/RiskLabPremiumReadModel.ts", "utf8");

test("rollout Vercel ativa explicitamente somente a leitura Premium do Risk Lab", () => {
  assert.equal(vercelConfig.env?.ENABLE_RISK_LAB_PREMIUM_READONLY, "true");
  assert.equal(Object.keys(vercelConfig.env || {}).length, 1);
});

test("código permanece fail-closed fora do deployment configurado", () => {
  assert.match(
    serviceSource,
    /featureEnabled\("ENABLE_RISK_LAB_PREMIUM_READONLY", false\)/,
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
