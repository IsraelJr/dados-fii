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

test("[REG-DEF-21] smoke Premium inicia automaticamente uma vez após deploy Vercel do main", () => {
  assert.match(workflow, /^\s{2}status:/m);
  assert.match(workflow, /^\s{2}workflow_dispatch:/m);
  assert.match(workflow, /github\.event\.context == 'Vercel'/);
  assert.match(workflow, /github\.event\.state == 'success'/);
  assert.match(workflow, /contains\(github\.event\.branches\.\*\.name, 'main'\)/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch' && inputs\.release_sha \|\| github\.event\.sha/);
  assert.match(workflow, /group: production-premium-smoke-\$\{\{/);
  assert.doesNotMatch(workflow, /\bsleep\b|while\s+(true|:)|for\s+\w+\s+in\s+\$\(seq\b/i);
});

test("[REG-DEF-21] resultado funcional publica status auditável no mesmo release", () => {
  assert.match(workflow, /statuses:\s*write/);
  assert.match(workflow, /id:\s*smoke/);
  assert.match(workflow, /steps\.smoke\.outcome == 'success'/);
  assert.match(workflow, /context "Production Premium Smoke"/);
  assert.match(workflow, /statuses\/\$\{TARGET_SHA\}/);
});

test("[REG-DEF-22] POST OIDC usa origem canônica sem redirecionar a autorização", () => {
  assert.match(workflow, /PRODUCTION_ORIGIN: https:\/\/www\.dadosfii\.com\.br/);
  assert.doesNotMatch(workflow, /curl[^\n]*--location/);
  assert.match(workflow, /\{ok, error, evidence:/);
  assert.match(
    workflow,
    /name: premium-production-smoke-\$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.release_sha \|\| github\.event\.sha \}\}/,
  );
});
