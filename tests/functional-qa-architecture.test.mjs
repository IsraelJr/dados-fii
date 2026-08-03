import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(file, "utf8");
const workflow = read(".github/workflows/functional-qa.yml");
const workflowJobs = workflow.slice(workflow.indexOf("\njobs:\n"));
const trustedWorkflow = read(".github/workflows/functional-qa-runner.yml");
const workflowCall = trustedWorkflow.slice(0, trustedWorkflow.indexOf("permissions:"));
const workflowCallSecrets = workflowCall.slice(workflowCall.indexOf("    secrets:"));
const previewJobStart = trustedWorkflow.indexOf("  browser-qa-preview:");
const productionJobStart = trustedWorkflow.indexOf("  browser-qa-production:");
assert.ok(previewJobStart >= 0, "job literal de Preview precisa existir");
assert.ok(productionJobStart > previewJobStart, "job literal de Production precisa existir");
const previewJob = trustedWorkflow.slice(previewJobStart, productionJobStart);
const productionJob = trustedWorkflow.slice(productionJobStart);
const config = read("playwright.config.ts");
const globalSetup = read("tests/e2e/global-setup.ts");
const targetPolicy = read("tests/e2e/support/qaTarget.ts");
const functionalSpec = read("tests/e2e/functional-qa.spec.ts");
const criticalSpec = read("tests/e2e/critical-journeys.spec.ts");
const fixtureRegression = read("tests/e2e/functional-qa-fixtures.spec.ts");
const competenceHelper = read("tests/e2e/support/closedCompetences.ts");
const fixture = read("tests/e2e/fixtures.ts");
const redactor = read("scripts/redact-playwright-artifacts.mjs");
const sentinel = read("tests/playwright-artifact-redaction.test.mjs");
const deploymentResolver = read("scripts/resolve-functional-qa-preview-deployment.mjs");
const login = read("src/app/components/Login.tsx");
const sessionClient = read("src/lib/users/WalletSessionClient.ts");
const walletPage = read("src/app/carteira/page.tsx");
const firebaseSession = read("src/server/controllers/WalletFirebaseSessionController.ts");
const sessionPolicy = read("src/server/auth/WalletSessionPolicy.ts");
const identityResolver = read("src/server/auth/WalletIdentityResolver.ts");
const reportController = read("src/server/controllers/WalletRiskReportController.ts");
const reportStatusController = read("src/server/controllers/WalletRiskReportStatusController.ts");

test("dispatcher transmite somente os três Repository secrets nomeados e não executa código", () => {
  assert.match(workflow, /uses:\s*IsraelJr\/dados-fii\/\.github\/workflows\/functional-qa-runner\.yml@[0-9a-f]{40}/);
  assert.doesNotMatch(workflow, /@0{40}/);
  assert.doesNotMatch(workflow, /secrets:\s*inherit|^\s{4}environment:/m);
  assert.deepEqual(
    [...workflow.matchAll(/^\s{6}(E2E_USER_EMAIL|E2E_USER_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET):\s*\$\{\{\s*secrets\.([A-Z_]+)\s*\}\}$/gm)]
      .map(([, target, source]) => [target, source]),
    [
      ["E2E_USER_EMAIL", "QA_PREVIEW_USER_EMAIL"],
      ["E2E_USER_PASSWORD", "QA_PREVIEW_USER_PASSWORD"],
      ["VERCEL_AUTOMATION_BYPASS_SECRET", "QA_PREVIEW_VERCEL_BYPASS_SECRET"],
    ],
  );
  assert.deepEqual(
    [...workflow.matchAll(/secrets\.([A-Z_]+)/g)].map((match) => match[1]),
    ["QA_PREVIEW_USER_EMAIL", "QA_PREVIEW_USER_PASSWORD", "QA_PREVIEW_VERCEL_BYPASS_SECRET"],
  );
  assert.doesNotMatch(workflow, /actions\/checkout|npm\s+(?:ci|run)|github\.event\.deployment\.sha[^]*ref:/);
  assert.match(workflow, /deployment\.creator\.login == 'vercel\[bot\]'/);
  assert.match(workflow, /deployment_status\.creator\.login == 'vercel\[bot\]'/);
  assert.doesNotMatch(workflow, /target_url/);
});

test("contrato reutilizável exige os três secrets e falha fechado quando ausentes", () => {
  for (const name of ["E2E_USER_EMAIL", "E2E_USER_PASSWORD", "VERCEL_AUTOMATION_BYPASS_SECRET"]) {
    assert.match(workflowCall, new RegExp(`${name}:\\n\\s+required: true`));
  }
  assert.equal((workflowCallSecrets.match(/required:\s*true/g) || []).length, 3);
  assert.doesNotMatch(`${workflow}\n${trustedWorkflow}`, /secrets:\s*inherit/);
});

test("secrets não chegam a jobs não privilegiados nem aparecem em comandos ou logs", () => {
  assert.deepEqual(
    [...workflowJobs.matchAll(/^\s{2}([a-z][a-z0-9-]+):$/gm)].map((match) => match[1]),
    ["browser-qa"],
  );
  assert.doesNotMatch(workflow, /^\s{4}(?:runs-on|steps|environment):/m);

  const allowedDispatcherLines = workflow
    .split("\n")
    .filter((line) => line.includes("secrets."));
  assert.equal(allowedDispatcherLines.length, 3);
  for (const line of allowedDispatcherLines) {
    assert.match(line, /^\s{6}(?:E2E_USER_EMAIL|E2E_USER_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET): \$\{\{ secrets\.QA_PREVIEW_[A-Z_]+ \}\}$/);
  }

  const allowedRunnerLines = trustedWorkflow
    .split("\n")
    .filter((line) => line.includes("secrets."));
  assert.equal(allowedRunnerLines.length, 5);
  for (const line of allowedRunnerLines) {
    assert.match(line, /^\s{6}(?:E2E_USER_EMAIL|E2E_USER_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET): \$\{\{ secrets\.(?:E2E_USER_EMAIL|E2E_USER_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET) \}\}$/);
  }
  assert.doesNotMatch(`${workflow}\n${trustedWorkflow}`, /(?:run:|echo|printf)[^\n]*\$\{\{\s*secrets\./);
});

test("runner privilegiado é imutável e trata o deployment somente como alvo", () => {
  assert.match(trustedWorkflow, /QA_RUNNER_REF:\s*"[0-9a-f]{40}"/);
  assert.doesNotMatch(trustedWorkflow, /QA_RUNNER_REF:\s*"0{40}"/);
  assert.match(trustedWorkflow, /ref:\s*\$\{\{ env\.QA_RUNNER_REF \}\}/);
  assert.match(trustedWorkflow, /persist-credentials:\s*false/);
  assert.doesNotMatch(trustedWorkflow, /ref:\s*\$\{\{\s*inputs\.deployment_sha/);
  assert.doesNotMatch(trustedWorkflow, /run:\s*npm[^\n]*DEPLOYMENT_SHA/);
  assert.match(previewJob, /scripts\/resolve-functional-qa-preview-deployment\.mjs/);
  assert.match(deploymentResolver, /URLSearchParams/);
  assert.match(deploymentResolver, /sha,/);
  assert.match(deploymentResolver, /environment:\s*PREVIEW_ENVIRONMENT/);
  assert.match(deploymentResolver, /deployment\?\.creator\?\.login === TRUSTED_CREATOR/);
  assert.match(deploymentResolver, /status\?\.creator\?\.login !== TRUSTED_CREATOR/);
  assert.match(deploymentResolver, /status\?\.state !== "success"/);
  assert.match(deploymentResolver, /newestFirst\(deployments\)/);
  assert.match(deploymentResolver, /newestFirst\(statuses\)\[0\]/);
  assert.match(trustedWorkflow, /scripts\/validate-functional-qa-target\.mjs/);
  assert.match(trustedWorkflow, /VERCEL_PREVIEW_HOST_SUFFIX:\s*"-israel-alves-projects-aee7aa56\.vercel\.app"/);
  assert.doesNotMatch(trustedWorkflow, /vars\.VERCEL_PREVIEW_HOST_SUFFIX/);
  assert.match(trustedWorkflow, /secrets\.E2E_USER_EMAIL/);
  assert.match(trustedWorkflow, /secrets\.E2E_USER_PASSWORD/);
  assert.match(trustedWorkflow, /secrets\.VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.doesNotMatch(trustedWorkflow, /E2E_ADMIN_UPDATE_SECRET|ADMIN_EMAIL|ADMIN_PASSWORD/);
});

test("runner separa Preview e Production com environments literais e secrets mínimos", () => {
  assert.doesNotMatch(workflow, /secrets:\s*inherit/);
  assert.match(previewJob, /^\s{4}environment:\s*Preview$/m);
  assert.match(productionJob, /^\s{4}environment:\s*Production$/m);
  assert.doesNotMatch(trustedWorkflow, /^\s{4}environment:\s*\$\{\{/m);

  assert.match(previewJob, /E2E_USER_EMAIL:\s*\$\{\{ secrets\.E2E_USER_EMAIL \}\}/);
  assert.match(previewJob, /E2E_USER_PASSWORD:\s*\$\{\{ secrets\.E2E_USER_PASSWORD \}\}/);
  assert.match(previewJob, /VERCEL_AUTOMATION_BYPASS_SECRET:\s*\$\{\{ secrets\.VERCEL_AUTOMATION_BYPASS_SECRET \}\}/);
  assert.match(productionJob, /E2E_USER_EMAIL:\s*\$\{\{ secrets\.E2E_USER_EMAIL \}\}/);
  assert.match(productionJob, /E2E_USER_PASSWORD:\s*\$\{\{ secrets\.E2E_USER_PASSWORD \}\}/);
  assert.doesNotMatch(productionJob, /VERCEL_AUTOMATION_BYPASS_SECRET|VERCEL_PREVIEW_HOST_SUFFIX/);

  for (const job of [previewJob, productionJob]) {
    assert.match(job, /missing=\(\)/);
    assert.match(job, /printf 'Missing required QA configuration: %s\\n' "\$\{missing\[@\]\}" >&2/);
    assert.match(job, /if \(\( \$\{#missing\[@\]\} > 0 \)\); then[^]*exit 1/);
    assert.doesNotMatch(job, /printf[^\n]*\$\{E2E_USER_(?:EMAIL|PASSWORD)/);
  }
  assert.match(previewJob, /missing\+?=\("E2E_USER_EMAIL"\)/);
  assert.match(previewJob, /missing\+?=\("E2E_USER_PASSWORD"\)/);
  assert.match(previewJob, /missing\+?=\("VERCEL_AUTOMATION_BYPASS_SECRET"\)/);
  assert.match(productionJob, /missing\+?=\("E2E_USER_EMAIL"\)/);
  assert.match(productionJob, /missing\+?=\("E2E_USER_PASSWORD"\)/);
});

test("bypass nunca vira header global e só inicializa cookie na origem exata", () => {
  assert.doesNotMatch(config, /extraHTTPHeaders/);
  assert.match(config, /storageState:\s*bypassStorageState/);
  assert.match(globalSetup, /request\.newContext\(\{\s*baseURL:\s*targetOrigin,\s*extraHTTPHeaders:\s*headers\s*\}\)/);
  assert.match(globalSetup, /maxRedirects:\s*0/);
  assert.match(globalSetup, /cookie\.name === "_vercel_jwt"/);
  assert.match(targetPolicy, /request\.origin !== target\.origin/);
  assert.match(targetPolicy, /previewHostnameSuffix/);
  assert.doesNotMatch(`${config}\n${globalSetup}`, /console\.(?:log|error)[^]*VERCEL_AUTOMATION_BYPASS_SECRET/);
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
  assert.match(trustedWorkflow, /Functional QA Preview/);
  assert.match(trustedWorkflow, /npm run test:artifact-redaction/);
  assert.ok(
    trustedWorkflow.indexOf("npm run test:artifact-redaction") < trustedWorkflow.indexOf("Install supported browsers"),
    "sentinela precisa rodar antes de qualquer navegação autenticada",
  );
  assert.match(trustedWorkflow, /steps\.redact\.outcome == 'success'/);
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
    "playwright-report",
    "data:application\\/zip;base64",
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
  assert.match(trustedWorkflow, /--grep=@critical\|@preview/);
  assert.match(trustedWorkflow, /--grep @smoke --project=desktop-chromium/);
  assert.match(previewJob, /REQUESTED_SUITE[^]*== "critical"[^]*--grep=@critical\|@preview/);
  assert.match(productionJob, /REQUESTED_SUITE[^]*== "critical"[^]*--grep @critical/);
  assert.match(functionalSpec, /test\("@critical @full relatórios/);
});

test("Home oculta Login e autenticação funcional começa na carteira", () => {
  assert.match(login, /usePathname/);
  assert.match(login, /if \(pathname === "\/"\) return null/);
  assert.match(walletPage, /import Login from "\.\.\/components\/Login"/);
  assert.match(walletPage, /<Login \/>/);
  assert.match(functionalSpec, /await page\.goto\("\/carteira"\)/);
  assert.match(functionalSpec, /page\.goto\("\/"\)[^]*name: "Login"[^]*toHaveCount\(0\)/);
});

test("consentimento, clique mobile e login funcional possuem regressões sem atalhos", () => {
  assert.match(fixture, /stabilizeCookieConsent/);
  assert.match(fixture, /clickStableSemanticTarget/);
  assert.match(fixture, /elementFromPoint/);
  assert.match(fixture, /scrollIntoView\(\{ block: "center", inline: "center" \}\)/);
  assert.match(fixture, /observeWalletAuthentication/);
  assert.match(fixture, /expectAuthenticatedWallet/);
  assert.match(fixture, /logoutWallet/);
  assert.match(fixture, /request\(\)\.method\(\) === "DELETE"/);
  assert.match(fixture, /waitForStableWalletUiState/);
  assert.match(fixture, /waitForResponse/);
  assert.doesNotMatch(functionalSpec, /waitForRequest/);
  assert.doesNotMatch(`${fixture}\n${functionalSpec}`, /force:\s*true/);
  assert.doesNotMatch(criticalSpec, /test\.skip\(Boolean\(process\.env\.E2E_BASE_URL\)/);
  assert.match(config, /testIgnore:\s*isRemoteRun[^]*functional-qa-fixtures\.spec\.ts/);
  for (const title of [
    "consentimento ainda não informado",
    "consentimento já salvo",
    "viewport mobile com header fixo",
    "resposta rápida registrada antes da ação",
    "resposta ocorrida antes de uma espera tardia",
    "rede sem UI e sessão não determina autenticação",
    "logout aguarda navegação seguida de reidratação antes de clicar",
  ]) assert.match(fixtureRegression, new RegExp(title));
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
  assert.match(sessionClient, /getIdToken\(true\)/);
  assert.match(sessionClient, /WALLET_SESSION_EXPIRES_AT_KEY/);
  assert.match(sessionClient, /walletSessionIsUsable/);
  assert.match(sessionClient, /RENEWAL_LOCK_NAME/);
  assert.match(sessionClient, /WALLET_SESSION_LOGOUT_KEY/);
  assert.match(sessionClient, /response\.status === 401/);
  assert.match(login, /installWalletUnauthorizedObserver/);
  assert.match(login, /addEventListener\("storage"/);
  assert.match(login, /markWalletLogout/);
  assert.doesNotMatch(login, /if \(nextUser\)[^]*else\s*\{[^}]*clearWalletSession/);
  assert.match(login, /Sua sessão expirou\. Entre novamente/);
});

test("identidade enviada pelo cliente não concede entitlement nem administração", () => {
  assert.match(functionalSpec, /adminStatus: 403/);
  assert.match(functionalSpec, /clientEscalationStatus: 401/);
  assert.doesNotMatch(reportController, /isPremiumPreviewEmail/);
  assert.doesNotMatch(reportStatusController, /isPremiumPreviewEmail/);
  assert.match(reportController, /user\.data\.isVip === true/);
  assert.match(reportStatusController, /user\.data\.isVip === true/);
});
