import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/functional-qa.yml", "utf8");
const config = readFileSync("playwright.config.ts", "utf8");
const functionalSpec = readFileSync("tests/e2e/functional-qa.spec.ts", "utf8");
const fixture = readFileSync("tests/e2e/fixtures.ts", "utf8");
const login = readFileSync("src/app/components/Login.tsx", "utf8");
const firebaseSession = readFileSync("src/server/controllers/WalletFirebaseSessionController.ts", "utf8");

test("QA remoto usa somente o usuário isolado e o bypass por header", () => {
  assert.match(workflow, /secrets\.E2E_USER_EMAIL/);
  assert.match(workflow, /secrets\.E2E_USER_PASSWORD/);
  assert.match(workflow, /secrets\.VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.doesNotMatch(workflow, /E2E_ADMIN_UPDATE_SECRET|ADMIN_EMAIL|ADMIN_PASSWORD/);
  assert.match(config, /x-vercel-protection-bypass/);
  assert.doesNotMatch(config, /protection-bypass[^]*searchParams|VERCEL_AUTOMATION_BYPASS_SECRET[^]*console\./);
});

test("matriz, estabilidade e evidências cumprem o contrato funcional", () => {
  assert.match(config, /workers:\s*process\.env\.CI\s*\?\s*1/);
  assert.match(config, /retries:\s*process\.env\.CI\s*\?\s*1\s*:\s*0/);
  assert.match(config, /Desktop Chrome/);
  assert.match(config, /Pixel 7/);
  assert.match(config, /iPhone 13/);
  assert.match(config, /video:\s*"retain-on-failure"/);
  assert.match(config, /trace:\s*"retain-on-failure"/);
  assert.match(fixture, /failure-screenshot/);
  assert.match(fixture, /runtime-evidence/);
  assert.match(fixture, /GITHUB_SHA/);
  assert.match(workflow, /playwright-report/);
  assert.match(workflow, /test-results/);
  assert.match(workflow, /npm run test:e2e:redact/);
});

test("jornadas críticas e cleanup idempotente permanecem explícitos", () => {
  for (const expected of [
    "47,00",
    "450,03",
    "87,06",
    "40,00",
    "50,00",
    "60,00",
    "R$ 734,09",
    "R$ 122,35",
    "Excluir Fevereiro",
    "internetdisconnected",
    "cleanArtificialHistory",
    "Baixar PDF",
    "AxeBuilder",
  ]) {
    assert.match(functionalSpec, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("login Firebase emite sessão própria da carteira e logout a revoga", () => {
  assert.match(login, /api\/wallet\/session\/firebase/);
  assert.match(login, /method:\s*"DELETE"/);
  assert.match(login, /signOut\(auth\)/);
  assert.match(firebaseSession, /randomBytes\(32\)/);
  assert.match(firebaseSession, /verify|walletIdentityService\.require/);
  assert.match(firebaseSession, /SESSION_DURATION_MS/);
  assert.doesNotMatch(firebaseSession, /E2E_USER_PASSWORD|ADMIN/);
});
