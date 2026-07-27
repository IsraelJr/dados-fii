import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRiskReportRepairInstruction,
  canReuseAutomaticReport,
  isManualPlaceholderReport,
  validateAutomaticRiskReportMarkdown,
  walletRiskReportAutomaticEnabled,
  walletRiskReportManualFallbackEnabled,
} from "../src/lib/reports/WalletRiskReportAutomationPolicy";
import { FII_RISK_REPORT_PROMPT_VERSION } from "../src/lib/prompts/fiiRiskReport";

const REQUIRED_REPORT = `
# Relatório de Risco da Carteira de FIIs
## Memorando executivo
## Qualidade dos dados analisados
## Concentração e correlação econômica
## Sustentabilidade da renda
## Liquidez e risco de saída
## Valuation e margem de segurança
## Stress test e tail risks
## Plano de ação e gatilhos de monitoramento
## Heat map final
${"Análise baseada exclusivamente nos dados fornecidos. ".repeat(80)}
`;

test("flags do relatório automático são fail-closed", () => {
  const automatic = process.env.ENABLE_WALLET_RISK_REPORT_AUTOMATIC;
  const manual = process.env.ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK;

  delete process.env.ENABLE_WALLET_RISK_REPORT_AUTOMATIC;
  delete process.env.ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK;
  assert.equal(walletRiskReportAutomaticEnabled(), false);
  assert.equal(walletRiskReportManualFallbackEnabled(), false);

  process.env.ENABLE_WALLET_RISK_REPORT_AUTOMATIC = "true";
  process.env.ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK = "false";
  assert.equal(walletRiskReportAutomaticEnabled(), true);
  assert.equal(walletRiskReportManualFallbackEnabled(), false);

  if (automatic === undefined) delete process.env.ENABLE_WALLET_RISK_REPORT_AUTOMATIC;
  else process.env.ENABLE_WALLET_RISK_REPORT_AUTOMATIC = automatic;
  if (manual === undefined) delete process.env.ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK;
  else process.env.ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK = manual;
});

test("placeholder manual nunca é reutilizado como relatório automático", () => {
  const manual = {
    status: "done",
    source: "manual_prompt",
    model: "manual-prompt",
    promptVersion: FII_RISK_REPORT_PROMPT_VERSION,
    reportMarkdown: "# Relatório de risco da carteira — modo manual\nPrompt completo para copiar",
  };

  assert.equal(isManualPlaceholderReport(manual), true);
  assert.equal(canReuseAutomaticReport(manual, FII_RISK_REPORT_PROMPT_VERSION), false);
});

test("relatório automático válido pode ser reutilizado no mesmo prompt", () => {
  const report = {
    status: "done",
    source: "openai_api",
    model: "configured-model",
    promptVersion: FII_RISK_REPORT_PROMPT_VERSION,
    reportMarkdown: REQUIRED_REPORT,
  };

  assert.equal(isManualPlaceholderReport(report), false);
  assert.equal(canReuseAutomaticReport(report, FII_RISK_REPORT_PROMPT_VERSION), true);
  assert.equal(canReuseAutomaticReport(report, "future-version"), false);
});

test("validação exige relatório completo e gera instrução de reparo", () => {
  const valid = validateAutomaticRiskReportMarkdown(REQUIRED_REPORT);
  assert.equal(valid.ok, true);

  const invalid = validateAutomaticRiskReportMarkdown("# Relatório curto\nPrompt completo para copiar");
  assert.equal(invalid.ok, false);
  assert.equal(invalid.manualPlaceholderDetected, true);
  assert.equal(invalid.tooShort, true);
  assert.ok(invalid.missingHeadings.length > 0);

  const repair = buildRiskReportRepairInstruction(invalid);
  assert.match(repair, /Reescreva o relatório completo/);
  assert.match(repair, /modo manual/);
});
