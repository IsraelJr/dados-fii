import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public FII APIs delegate persistence and merge to RegulatoryDataService", () => {
  for (const route of ["src/app/api/fii/route.ts", "src/app/api/fii/batch/route.ts", "src/app/api/dividend-calendar/route.ts"]) {
    const source = read(route);
    assert.match(source, /regulatoryDataService/);
    assert.doesNotMatch(source, /firebase-admin|adminDb|\.collection\(/);
  }
});

test("legacy reports no longer read regulatory Fiis directly", () => {
  for (const route of [
    "src/app/api/wallet-risk-report/route.ts",
    "src/app/api/wallet-risk-report/manual-prompt/route.ts",
    "src/app/api/admin/missing-cnpj/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /regulatoryDataService/);
    assert.doesNotMatch(source, /\.collection\(["']Fiis["']\)/);
  }
});

test("Health and Validation endpoints use canonical HTTP methods without direct Firestore", () => {
  for (const endpoint of ["health", "parser-health", "validation-history"]) {
    const source = read(`src/app/api/admin/system/${endpoint}/route.ts`);
    assert.match(source, /export async function GET/);
    assert.doesNotMatch(source, /export async function POST/);
    assert.match(source, /authorizeAdminRequest/);
    assert.match(source, /regulatoryDataService/);
    assert.doesNotMatch(source, /firebase-admin|adminDb|\.collection\(/);
  }
  const runner = read("src/app/api/admin/system/run-validation/route.ts");
  assert.match(runner, /export async function POST/);
  assert.match(runner, /ENABLE_SYSTEM_VALIDATION/);
  assert.match(runner, /ValidationExecutionError/);
  assert.doesNotMatch(runner, /firebase-admin|adminDb|\.collection\(/);
});

test("admin session uses verified Firebase identity and HttpOnly cookie", () => {
  const session = read("src/app/api/admin/session/route.ts");
  const security = read("src/lib/adminSecurity.ts");
  assert.match(session, /verifyIdToken/);
  assert.match(session, /createSessionCookie/);
  assert.match(session, /httpOnly:\s*true/);
  assert.match(session, /sameSite:\s*"strict"/);
  assert.match(security, /verifySessionCookie/);
  assert.match(security, /ADMIN_EMAILS/);
  assert.match(security, /role: "admin"/);
  assert.match(security, /consumeAdminRateLimit/);
});

test("Sprint 2.1 has separate service, repository, normalizer, validator, cache and types", () => {
  const service = read("src/lib/regulatoryDataService.ts");
  const repository = read("src/lib/regulatory/RegulatoryRepository.ts");
  const normalizer = read("src/lib/regulatory/RegulatoryNormalizer.ts");
  const validator = read("src/lib/regulatory/RegulatoryValidator.ts");
  const cache = read("src/lib/regulatory/RegulatoryCache.ts");
  const regulatoryTypes = read("src/lib/regulatory/RegulatoryTypes.ts");
  const types = read("src/types/regulatory.ts");
  assert.match(types, /"FII" \| "FIAGRO" \| "FI_INFRA"/);
  assert.match(service, /RegulatoryRepository/);
  assert.match(service, /RegulatoryCache/);
  assert.doesNotMatch(service, /firebase-admin|adminDb|\.collection\(/);
  assert.match(repository, /adminDb/);
  assert.match(repository, /async publish/);
  assert.match(repository, /async rollback/);
  assert.match(repository, /transaction\.create\(backupRef/);
  assert.match(repository, /approvalHash/);
  assert.match(repository, /publicationHash/);
  assert.match(normalizer, /PROTECTED_LEGACY_FIELDS/);
  assert.match(normalizer, /\^earnings\\d\{4\}\$/);
  assert.match(validator, /validateRegulatoryFund/);
  assert.match(cache, /class RegulatoryCache/);
  assert.match(regulatoryTypes, /RegulatoryFundBackups/);
  assert.match(service, /marketPromise/);
  assert.match(service, /async publish/);
  assert.match(service, /async rollback/);
  assert.match(service, /async runValidation/);
});

test("Sprint 2.2 exposes one ScoreEngine with every required calculated score", () => {
  const service = read("src/lib/regulatoryDataService.ts");
  const engine = read("src/lib/scores/ScoreEngine.ts");
  const types = read("src/types/scores.ts");
  assert.match(service, /ENABLE_SCORE_ENGINE/);
  assert.match(service, /this\.scores\.calculate\(publicData\)/);
  assert.match(engine, /class ScoreEngine/);
  for (const score of ["risk", "dividend", "governance", "growth", "liquidity", "quality", "premium"]) {
    assert.match(types, new RegExp(`${score}: ScoreResult`));
  }
  assert.doesNotMatch(engine, /firebase-admin|adminDb|\.collection\(/);
});

test("Sprint 2.3 health covers every canonical subsystem", () => {
  const route = read("src/app/api/admin/system/health/route.ts");
  const engine = read("src/lib/health/HealthEngine.ts");
  assert.match(route, /ENABLE_HEALTH_MONITOR/);
  for (const component of ["firestore", "parser", "qa", "publication", "rollback", "cache", "score"]) {
    assert.match(engine, new RegExp(`\\b${component}\\b`));
  }
  assert.match(engine, /WEIGHTS/);
  assert.match(engine, /latestValidation/);
});

test("Sprint 2.4 has a structured Validation Runner and persisted failure path", () => {
  const service = read("src/lib/regulatoryDataService.ts");
  const runner = read("src/lib/validation/ValidationRunner.ts");
  const repository = read("src/lib/regulatory/RegulatoryRepository.ts");
  assert.match(service, /new ValidationRunner/);
  assert.match(service, /validationRunner\.complete/);
  assert.match(service, /validationRunner\.failed/);
  assert.match(runner, /fund-kind-coverage/);
  assert.match(runner, /score-engine/);
  assert.match(runner, /coverage/);
  assert.match(repository, /saveValidationRun/);
  assert.match(repository, /status: run\.status/);
});

test("Sprint 2.5 dashboard renders every canonical administrative card", () => {
  const dashboard = read("src/app/admin/sistema/page.tsx");
  for (const card of ["Saúde", "Parser", "Firestore", "QA", "Publicação", "Rollback", "Histórico"]) {
    assert.match(dashboard, new RegExp(`title=["']${card}["']`));
  }
  assert.match(dashboard, /components\?\.score\.score/);
  assert.match(dashboard, /cache\.funds\.hitRate/);
  assert.match(dashboard, /run-validation/);
});

test("Sprint 2.6 timeline flows through RegulatoryDataService and covers five categories", () => {
  const route = read("src/app/api/fii/[ticker]/timeline/route.ts");
  const service = read("src/lib/regulatoryDataService.ts");
  const repository = read("src/lib/regulatory/RegulatoryRepository.ts");
  const timeline = read("src/lib/regulatory/RegulatoryTimeline.ts");
  const page = read("src/app/fii/[ticker]/page.tsx");
  assert.match(route, /export async function GET/);
  assert.match(route, /regulatoryDataService\.getTimeline/);
  assert.doesNotMatch(route, /firebase-admin|adminDb|\.collection\(/);
  assert.match(service, /async getTimeline/);
  assert.match(repository, /getTimelineRecords/);
  assert.match(repository, /getAuditEventsForTicker/);
  for (const type of ["document", "event", "material_fact", "assembly", "regulation"]) {
    assert.match(timeline, new RegExp(`"${type}"`));
  }
  assert.match(page, /RegulatoryTimeline/);
});

test("Sprint 2.7 generates the free report through the consolidated service", () => {
  const route = read("src/app/api/fii/[ticker]/report/free/route.ts");
  const service = read("src/lib/regulatoryDataService.ts");
  const engine = read("src/lib/reports/FreeReportEngine.ts");
  const page = read("src/app/fii/[ticker]/page.tsx");
  assert.match(route, /regulatoryDataService\.getFreeReport/);
  assert.doesNotMatch(route, /firebase-admin|adminDb|\.collection\(/);
  assert.match(service, /async getFreeReport/);
  assert.match(service, /this\.freeReports\.generate/);
  assert.match(engine, /class FreeReportEngine/);
  assert.match(engine, /ScoreEngine/);
  assert.match(engine, /Conteúdo informativo/);
  assert.match(page, /FreeFundReport/);
});

test("Sprint 2.8 centralizes all provider calls in AI Insights Engine", () => {
  const engine = read("src/lib/ai/AIInsightsEngine.ts");
  const route = read("src/app/api/fii/[ticker]/insights/route.ts");
  const compatibility = read("src/app/api/fii-summary/route.ts");
  const walletReport = read("src/app/api/wallet-risk-report/route.ts");
  const page = read("src/app/fii/[ticker]/page.tsx");
  for (const field of ["executiveSummary", "changes", "risks", "opportunities", "alerts", "plainLanguage"]) {
    assert.match(engine, new RegExp(field));
  }
  assert.match(engine, /ENABLE_AI_INSIGHTS/);
  assert.match(engine, /RegulatoryCache/);
  assert.match(engine, /json_schema/);
  assert.match(route, /regulatoryDataService\.getAIInsights/);
  assert.match(compatibility, /regulatoryDataService\.getAIInsights/);
  assert.match(walletReport, /aiInsightsEngine\.generateText/);
  for (const api of [route, compatibility, walletReport]) {
    assert.doesNotMatch(api, /api\.openai\.com|api\.perplexity\.ai|OPENAI_API_KEY|PERPLEXITY_API_KEY/);
  }
  assert.match(page, /AIInsightsPanel/);
});

test("legacy observability no longer accepts admin secrets", () => {
  const route = read("src/app/api/admin/observability/route.ts");
  assert.doesNotMatch(route, /ADMIN_UPDATE_SECRET|CRON_SECRET|x-admin-secret|searchParams\.get\("secret"\)/);
  assert.doesNotMatch(route, /export async function GET/);
  assert.match(route, /authorizeAdminRequest/);
});
