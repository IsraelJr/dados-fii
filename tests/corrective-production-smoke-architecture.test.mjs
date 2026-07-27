import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/production-premium-smoke.yml", "utf8");
const route = readFileSync("src/app/api/internal/production-premium-smoke/route.ts", "utf8");
const oidc = readFileSync("src/lib/security/GithubActionsOidc.ts", "utf8");

test("gate de produção usa OIDC efêmero sem segredo estático", () => {
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(workflow, /audience=dados-fii-production-smoke/);
  assert.doesNotMatch(workflow, /secrets\.|CRON_SECRET|ADMIN_UPDATE_SECRET/);
  assert.match(oidc, /token\.actions\.githubusercontent\.com/);
  assert.match(oidc, /jwtVerify/);
  assert.match(oidc, /workflow_ref/);
  assert.match(oidc, /VERCEL_GIT_COMMIT_SHA/);
});

test("[REG-DEF-13] gate gera Premium real, relê auditoria e persiste evidência vinculada ao SHA", () => {
  assert.match(route, /rebuildPremiumPeerSnapshot/);
  assert.match(route, /getPremiumReport/);
  assert.match(route, /getAuditEventById/);
  assert.match(route, /savePremiumProductionSmoke/);
  assert.match(route, /premium\.audit-persisted/);
  assert.match(route, /premium\.risk-lab-isolation/);
});
