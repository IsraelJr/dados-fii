import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("route handlers delegam ao controller sem acessar Firestore", () => {
  const route = read("src/app/api/fund-radar/route.ts");
  const refresh = read("src/app/api/fund-radar/refresh/route.ts");
  assert.match(route, /FundRadarController/);
  assert.match(refresh, /FundRadarController/);
  assert.doesNotMatch(`${route}\n${refresh}`, /firebaseAdmin|adminDb|\.collection\(/);
});

test("feature flag é server-side, fail-closed e documentada", () => {
  const flags = read("src/lib/featureFlags.ts");
  const controller = read("src/server/controllers/FundRadarController.ts");
  const core = read("src/server/controllers/FundRadarControllerCore.ts");
  const env = read(".env.example");
  assert.match(flags, /ENABLE_FUND_RADAR/);
  assert.match(controller, /featureEnabled\("ENABLE_FUND_RADAR", false\)/);
  assert.match(core, /FUND_RADAR_DISABLED/);
  assert.match(env, /ENABLE_FUND_RADAR=false/);
  assert.doesNotMatch(`${controller}\n${core}\n${flags}`, /NEXT_PUBLIC_ENABLE_FUND_RADAR/);
});

test("entitlement, limite e identidade são resolvidos no servidor", () => {
  const identity = read("src/server/auth/FundRadarIdentityResolver.ts");
  const domain = read("src/lib/fund-radar/FundRadar.ts");
  const controller = read("src/server/controllers/FundRadarControllerCore.ts");
  const policy = read("src/lib/security/FundRadarRequestPolicy.ts");
  assert.match(identity, /resolvePremiumEntitlement/);
  assert.match(identity, /resolveVerifiedWalletIdentity/);
  assert.match(domain, /monitoredFundLimit/);
  assert.match(controller, /consumeRateLimit/);
  assert.match(controller, /sameOrigin/);
  assert.doesNotMatch(`${controller}\n${policy}`, /body\??\.(?:plan|isVip|isPremium)|value\.(?:plan|isVip|isPremium)/);
  assert.doesNotMatch(identity, /NEXT_PUBLIC/);
});

test("persistência é transacional, isolada e separada da posição de carteira", () => {
  const repository = read("src/server/repositories/FirestoreFundRadarRepositoryCore.ts");
  const service = read("src/lib/fund-radar/FundRadarService.ts");
  assert.match(repository, /runTransaction/);
  assert.match(repository, /collection\(RADAR_SUBCOLLECTION\)\.doc\(RADAR_DOCUMENT\)/);
  assert.match(repository, /extractUserWallet/);
  assert.match(repository, /FUND_RADAR_FUND_IN_PORTFOLIO|in_portfolio/);
  assert.match(service, /FundRadarDataSource/);
  assert.match(read("src/server/services/FundRadarRuntime.ts"), /regulatoryDataService/);
  assert.doesNotMatch(read("src/app/components/FundRadarPanel.tsx"), /firebase\/firestore|setDoc|addDoc|collection\(/);
});

test("monitor reutiliza cron, deduplica entrega e não chama IA", () => {
  const cron = read("src/app/api/admin/process-portfolio-notifications/route.ts");
  const batch = read("src/lib/fund-radar/FundRadarBatchProcessor.ts");
  const runtime = read("src/server/services/FundRadarBatchRuntime.ts");
  const radarFiles = readdirSync(new URL("../src/lib/fund-radar", import.meta.url))
    .map((file) => read(`src/lib/fund-radar/${file}`))
    .join("\n");
  assert.match(cron, /processFundRadarUpdates/);
  assert.match(cron, /requireAdminOrCron/);
  assert.match(batch, /claimPendingEmailUpdates/);
  assert.match(runtime, /Idempotency-Key/);
  assert.match(runtime, /RESEND_API_KEY/);
  assert.doesNotMatch(`${radarFiles}\n${runtime}`, /openai|AIInsightsEngine|generateText|chat\.completions/i);
});

test("telemetria é agregada e não inclui identidade, ticker ou finanças", () => {
  const controller = read("src/server/controllers/FundRadarController.ts");
  const telemetryBlock = controller.slice(controller.indexOf("async telemetry"));
  assert.match(telemetryBlock, /metadata:\s*\{\s*plan:\s*subject\.plan\s*\}/);
  assert.doesNotMatch(telemetryBlock, /email|ownerId|uid|ticker|wallet|patrim|dividend|token/i);
});

test("UI mantém Radar e carteira separados e não envia privilégio", () => {
  const button = read("src/app/components/FundRadarButton.tsx");
  const panel = read("src/app/components/FundRadarPanel.tsx");
  const page = read("src/app/radar/page.tsx");
  const fundPage = read("src/app/fii/[ticker]/page.tsx");
  assert.match(button, /body:\s*\{ ticker \}/);
  assert.match(fundPage, /<FundRadarButton ticker=\{ticker\}/);
  assert.match(panel, /Acompanhado pela Inteligência da Carteira/);
  assert.match(page, /não recomenda comprar ou vender/i);
  assert.doesNotMatch(`${button}\n${panel}`, /body:\s*\{[^}]*\b(?:plan|isVip|isPremium|ownerId)\b/);
  assert.doesNotMatch(`${button}\n${panel}`, /NEXT_PUBLIC.*(?:RADAR|VIP|PREMIUM)/);
});

test("conteúdo novo não contém recomendação direta ou preço-alvo", () => {
  const published = [
    read("src/app/radar/page.tsx"),
    read("src/app/components/FundRadarPanel.tsx"),
    read("src/lib/fund-radar/FundRadarObservation.ts"),
  ].join("\n");
  assert.doesNotMatch(published, /["'`](?:compre|venda|recomendamos|é hora de comprar|preço-alvo)\b/i);
});
