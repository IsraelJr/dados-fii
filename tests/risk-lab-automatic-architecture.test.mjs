import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = new URL("../src/app/api/admin/system/risk-lab/automatic/route.ts", import.meta.url);
const pagePath = new URL("../src/app/admin/risk-lab/automatic/page.tsx", import.meta.url);
const orchestratorPath = new URL("../src/lib/risk-lab/RiskLabTickerOrchestrator.ts", import.meta.url);

async function source(path) {
  return readFile(path, "utf8");
}

test("automatic API is admin-only, rate-limited and ticker-only", async () => {
  const code = await source(routePath);
  assert.match(code, /authorizeAdminRequest/);
  assert.match(code, /limit:\s*3/);
  assert.match(code, /action !== "scan"/);
  assert.doesNotMatch(code, /body\?\.documentId|body\?\.candidateId/);
});

test("automatic page asks only for a ticker and has no manual-validation controls", async () => {
  const code = await source(pagePath);
  assert.match(code, /Informe somente o ticker/);
  assert.match(code, /Você não precisa validar documentos/);
  assert.match(code, /Pesquisar, validar e analisar/);
  assert.doesNotMatch(code, /id="documentId"|id="candidateId"|type="checkbox"/);
});

test("automatic page does not execute a scan on load", async () => {
  const code = await source(pagePath);
  assert.doesNotMatch(code, /useEffect/);
  assert.match(code, /onClick=\{execute\}/);
});

test("automatic workflow remains isolated from Premium and notifications", async () => {
  const files = [await source(routePath), await source(pagePath), await source(orchestratorPath)].join("\n");
  assert.doesNotMatch(files, /PremiumReportEngine|premiumReportEngine|NotificationService|notifier|sendNotification/);
  assert.match(files, /premiumIntegrated:\s*false/);
  assert.match(files, /notificationsSent:\s*false/);
  assert.match(files, /requiresHumanDocumentValidation:\s*false/);
});
