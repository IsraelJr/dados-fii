import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const route = source("src/app/api/admin/system/risk-lab/route.ts");
const page = source("src/app/admin/risk-lab/page.tsx");
const service = source("src/lib/risk-lab/RiskLabService.ts");
const repository = source("src/lib/risk-lab/RiskLabRepository.ts");
const builder = source("src/lib/risk-lab/RiskLabReportBuilder.ts");

test("Risk Lab API uses the existing protected Admin security contract", () => {
  assert.match(route, /authorizeAdminRequest/);
  assert.match(route, /risk-lab-status/);
  assert.match(route, /risk-lab-generate/);
  assert.match(route, /limit:\s*5/);
  assert.match(route, /riskLabService\.generate/);
});

test("Admin page exposes one-click HCTR11 execution and explicit isolation warnings", () => {
  assert.match(page, /Gerar relatório de risco/);
  assert.match(page, /ticker:\s*"HCTR11"/);
  assert.match(page, /Não está integrado ao Relatório Premium/);
  assert.match(page, /Não envia notificações/);
  assert.match(page, /\/api\/admin\/system\/risk-lab/);
});

test("service hard-whitelists HCTR11 and has an emergency feature flag", () => {
  assert.match(service, /HARD_ALLOWED_TICKERS = new Set\(\["HCTR11"\]\)/);
  assert.match(service, /ENABLE_RISK_LAB_ADMIN/);
  assert.match(service, /acquireLock/);
  assert.match(service, /releaseLock/);
  assert.match(service, /saveReport/);
});

test("repository persists immutable reports, status, audit and concurrency locks", () => {
  assert.match(repository, /RiskLabReports/);
  assert.match(repository, /RiskLabStatus/);
  assert.match(repository, /RiskLabAudit/);
  assert.match(repository, /RiskLabLocks/);
  assert.match(repository, /immutable:\s*true/);
  assert.match(repository, /runTransaction/);
  assert.match(repository, /risk-lab-report-generated/);
  assert.match(repository, /risk-lab-report-failed/);
});

test("unitary path cannot silently invoke Premium, AI text generation or notifications", () => {
  const combined = `${route}\n${service}\n${repository}\n${builder}`;
  for (const forbidden of ["PremiumReport", "AIInsightsEngine", "AlertDispatcher", "sendEmail", "sendNotification"]) {
    assert.equal(combined.includes(forbidden), false, `${forbidden} must remain outside the unitary Risk Lab path`);
  }
  assert.match(builder, /premiumIntegrated:\s*false/);
  assert.match(builder, /notificationsSent:\s*false/);
});
