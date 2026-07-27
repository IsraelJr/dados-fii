import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("fluxo legado encaminha para automação e preserva fallback manual", () => {
  for (const path of [
    "src/app/api/wallet-risk-report/manual-prompt/route.ts",
    "src/app/api/wallet-risk-report/manual-prompt-v2/route.ts",
  ]) {
    const route = read(path);
    assert.match(route, /WalletRiskReportController/);
    assert.match(route, /WalletRiskReportManualPrompt/);
    assert.match(route, /walletRiskReportManualFallbackEnabled/);
    assert.match(route, /return handleAutomaticPost\(request\)/);
  }
});

test("gerador automático usa prompt canônico, snapshot rico e OpenAI", () => {
  const controller = read("src/server/controllers/WalletRiskReportController.ts");
  const input = read("src/lib/reports/WalletRiskReportInput.ts");

  assert.match(controller, /buildFiiRiskReportMessages/);
  assert.match(controller, /aiInsightsEngine\.generateText/);
  assert.match(controller, /buildWalletRiskReportInput/);
  assert.match(controller, /validateAutomaticRiskReportMarkdown/);
  assert.match(controller, /buildRiskReportRepairInstruction/);
  assert.match(controller, /repairAttempted/);
  assert.match(controller, /riskReportCredits: Math\.max\(credits - 1, 0\)/);
  assert.match(controller, /regulatoryDataService\.getByTicker/);
  assert.match(input, /fundLoader/);
  assert.match(input, /deriveFiiRiskData/);
  assert.match(input, /getMarketBenchmarks/);
  assert.match(input, /buildPortfolioDataQuality/);
  assert.doesNotMatch(input, /adminDb|\.collection\(["']Fiis["']\)/);
});

test("placeholder manual é migrado, mas não reutilizado nem convertido em PDF", () => {
  const policy = read("src/lib/reports/WalletRiskReportAutomationPolicy.ts");
  const controller = read("src/server/controllers/WalletRiskReportController.ts");
  const status = read("src/server/controllers/WalletRiskReportStatusController.ts");
  const pdfRoute = read("src/app/api/wallet-risk-report/pdf/route.ts");

  assert.match(policy, /source === WALLET_RISK_REPORT_MANUAL_SOURCE/);
  assert.match(policy, /prompt completo para copiar/);
  assert.match(controller, /migratedFromManual/);
  assert.match(controller, /legacyManualReport/);
  assert.match(status, /canReuseAutomaticReport/);
  assert.match(status, /legacyManualReportAvailable/);
  assert.match(pdfRoute, /generationMode !== "automatic_openai"/);
  assert.match(pdfRoute, /WALLET_RISK_REPORT_AUTOMATIC_REQUIRED/);
});

test("produção ativa automático e mantém manual desligado", () => {
  const vercel = JSON.parse(read("vercel.json"));
  assert.equal(vercel.env.ENABLE_WALLET_RISK_REPORT_AUTOMATIC, "true");
  assert.equal(vercel.env.ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK, "false");

  const env = read(".env.example");
  assert.match(env, /ENABLE_WALLET_RISK_REPORT_AUTOMATIC=false/);
  assert.match(env, /ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK=false/);
  assert.match(env, /Para voltar ao modo manual por falta de créditos/);
});

test("route handlers permanecem sem Firestore direto", () => {
  for (const path of [
    "src/app/api/wallet-risk-report/route.ts",
    "src/app/api/wallet-risk-report/manual-prompt/route.ts",
    "src/app/api/wallet-risk-report/manual-prompt-v2/route.ts",
    "src/app/api/wallet-risk-report/pdf/route.ts",
  ]) {
    const route = read(path);
    assert.doesNotMatch(route, /firebaseAdmin|adminDb|\.collection\(/);
  }
});
