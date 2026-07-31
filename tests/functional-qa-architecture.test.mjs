import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(file, "utf8");
const workflow = read(".github/workflows/functional-qa.yml");
const config = read("playwright.config.ts");
const functionalSpec = read("tests/e2e/functional-qa.spec.ts");
const competenceHelper = read("tests/e2e/support/closedCompetences.ts");
const fixture = read("tests/e2e/fixtures.ts");
const redactor = read("scripts/redact-playwright-artifacts.mjs");
const sentinel = read("tests/playwright-artifact-redaction.test.mjs");
const login = read("src/app/components/Login.tsx");
const walletPage = read("src/app/carteira/page.tsx");
const firebaseSession = read("src/server/controllers/WalletFirebaseSessionController.ts");
const sessionPolicy = read("src/server/auth/WalletSessionPolicy.ts");
const identityResolver = read("src/server/auth/WalletIdentityResolver.ts");
const reportController = read("src/server/controllers/WalletRiskReportController.ts");
const reportStatusController = read("src/server/controllers/WalletRiskReportStatusController.ts");

test("QA remoto usa somente usuário isolado e bypass por header", () => {
  assert.match(workflow, /secrets\.E2E_USER_EMAIL/);
  assert.match(workflow, /secrets\.E2E_USER_PASSWORD/);
  assert.match(workflow, /secrets\.VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.doesNotMatch(workflow, /E2E_ADMIN_UPDATE_SECRET|ADMIN_EMAIL|ADMIN_PASSWORD/);
  assert.match(config, /x-vercel-protection-bypass/);
  assert.doesNotMatch(config, /protection-bypass[^]*searchParams|VERCEL_AUTOMATION_BYPASS_SECRET[^]*console\./);
});

test("matriz, estabilidade, gate e evidências cumprem o contrato funcional", () => {
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
  assert.match(workflow, /Functional QA Preview/);
  assert.match(workflow, /npm run test:artifact-redaction/);
  assert.ok(
    workflow.indexOf("npm run test:artifact-redaction") < workflow.indexOf("Install supported browsers"),
    "sentinela precisa rodar antes de qualquer navegação autenticada",
  );
  assert.match(workflow, /steps\.redact\.outcome == 'success'/);
});

test("redator cobre conteúdo dinâmico e o sentinela expande arquivos recursivamente", () => {
  for (const expected of [
    "authorization",
    "cookie",
    "x-wallet-session",
    "localstorage",
    "eyJ",
    "unzipSync",
  ]) assert.match(redactor.toLowerCase(), new RegExp(expected.toLowerCase()));
  for (const expected of [
    "trace.trace",
    "trace.network",
    "artifact.har",
    "storage-state.json",
    "nested.zip",
    "collectExpandedContent",
  ]) assert.match(sentinel, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(fixture, /-webkit-text-security:disc/);
  assert.match(fixture, /color:transparent/);
});

test("jornada de histórico usa só competências encerradas e cleanup idempotente", () => {
  for (const expected of ["47,00", "450,03", "87,06", "40,00", "50,00", "60,00"]) {
    assert.match(competenceHelper, new RegExp(expected.replace(",", "\\,")));
  }
  assert.match(competenceHelper, /period\.month - 1/);
  assert.match(functionalSpec, /closedQaDividendMonths/);
  assert.match(functionalSpec, /if \(!qaMonths\.length\)/);
  assert.match(functionalSpec, /monthNumber === 2/);
  assert.match(functionalSpec, /internetdisconnected/);
  assert.match(functionalSpec, /cleanArtificialHistory/);
  assert.match(functionalSpec, /page\.reload\(\)/);
  assert.match(functionalSpec, /Baixar PDF/);
  assert.match(functionalSpec, /AxeBuilder/);
});

test("login inválido não pertence ao smoke e Preview o executa", () => {
  assert.match(functionalSpec, /test\("@preview @full login inválido/);
  assert.doesNotMatch(functionalSpec, /test\("@smoke[^"]*login inválido/);
  assert.match(workflow, /--grep=@critical\|@preview/);
  assert.match(workflow, /--grep @smoke --project=desktop-chromium/);
  assert.match(workflow, /REQUESTED_SUITE[^]*MANUAL_ENVIRONMENT[^]*== "Preview"[^]*--grep=@critical\|@preview/);
  assert.match(workflow, /REQUESTED_SUITE[^]*--grep @critical/);
});

test("Home oculta Login e autenticação funcional começa na carteira", () => {
  assert.match(login, /usePathname/);
  assert.match(login, /if \(pathname === "\/"\) return null/);
  assert.match(walletPage, /import Login from "\.\.\/components\/Login"/);
  assert.match(walletPage, /<Login \/>/);
  assert.match(functionalSpec, /await page\.goto\("\/carteira"\)/);
  assert.match(functionalSpec, /page\.goto\("\/"\)[^]*name: "Login"[^]*toHaveCount\(0\)/);
});

test("sessão curta é revogável, isolada e rejeita expiração", () => {
  assert.match(login, /api\/wallet\/session\/firebase/);
  assert.match(login, /method:\s*"DELETE"/);
  assert.match(login, /signOut\(auth\)/);
  assert.match(firebaseSession, /randomBytes\(32\)/);
  assert.match(firebaseSession, /walletIdentityService\.require/);
  assert.match(firebaseSession, /walletSessionExpiration/);
  assert.doesNotMatch(firebaseSession, /E2E_USER_PASSWORD|ADMIN|plan|premium|isVip/);
  assert.match(sessionPolicy, /12 \* 60 \* 60 \* 1000/);
  assert.match(sessionPolicy, /date\.getTime\(\) <= nowMs/);
  assert.match(sessionPolicy, /walletSessionDocumentId/);
  assert.match(identityResolver, /walletSessionMatches/);
  assert.match(functionalSpec, /revokedStatus/);
  assert.match(functionalSpec, /isolatedStatus: 401/);
});

test("identidade enviada pelo cliente não concede entitlement nem administração", () => {
  assert.match(functionalSpec, /adminStatus: 403/);
  assert.match(functionalSpec, /clientEscalationStatus: 401/);
  assert.doesNotMatch(reportController, /isPremiumPreviewEmail/);
  assert.doesNotMatch(reportStatusController, /isPremiumPreviewEmail/);
  assert.match(reportController, /user\.data\.isVip === true/);
  assert.match(reportStatusController, /user\.data\.isVip === true/);
});
