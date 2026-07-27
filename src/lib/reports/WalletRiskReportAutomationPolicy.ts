import { featureEnabled } from "@/lib/featureFlags";

export const WALLET_RISK_REPORT_AUTOMATIC_FLAG = "ENABLE_WALLET_RISK_REPORT_AUTOMATIC" as const;
export const WALLET_RISK_REPORT_MANUAL_FLAG = "ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK" as const;
export const WALLET_RISK_REPORT_AUTOMATIC_SOURCE = "openai_api";
export const WALLET_RISK_REPORT_MANUAL_SOURCE = "manual_prompt";

const REQUIRED_HEADINGS = [
  "# Relatório de Risco da Carteira de FIIs",
  "## Memorando executivo",
  "## Qualidade dos dados analisados",
  "## Concentração e correlação econômica",
  "## Sustentabilidade da renda",
  "## Liquidez e risco de saída",
  "## Valuation e margem de segurança",
  "## Stress test e tail risks",
  "## Plano de ação e gatilhos de monitoramento",
  "## Heat map final",
] as const;

export type StoredRiskReport = {
  status?: unknown;
  source?: unknown;
  model?: unknown;
  promptVersion?: unknown;
  reportMarkdown?: unknown;
};

export type RiskReportValidation = {
  ok: boolean;
  missingHeadings: string[];
  manualPlaceholderDetected: boolean;
  tooShort: boolean;
};

export function walletRiskReportAutomaticEnabled() {
  return featureEnabled(WALLET_RISK_REPORT_AUTOMATIC_FLAG, false);
}

export function walletRiskReportManualFallbackEnabled() {
  return featureEnabled(WALLET_RISK_REPORT_MANUAL_FLAG, false);
}

export function isManualPlaceholderReport(report: StoredRiskReport | null | undefined) {
  const source = String(report?.source || "").trim().toLowerCase();
  const model = String(report?.model || "").trim().toLowerCase();
  const markdown = String(report?.reportMarkdown || "").trim().toLowerCase();

  return source === WALLET_RISK_REPORT_MANUAL_SOURCE
    || model === "manual-prompt"
    || markdown.includes("relatório de risco da carteira — modo manual")
    || markdown.includes("prompt completo para copiar")
    || markdown.includes("cole no chatgpt");
}

export function canReuseAutomaticReport(report: StoredRiskReport | null | undefined, promptVersion: string) {
  return report?.status === "done"
    && !isManualPlaceholderReport(report)
    && String(report?.promptVersion || "") === promptVersion
    && String(report?.reportMarkdown || "").trim().length > 0;
}

export function validateAutomaticRiskReportMarkdown(markdown: string): RiskReportValidation {
  const text = String(markdown || "").trim();
  const manualPlaceholderDetected = isManualPlaceholderReport({ reportMarkdown: text });
  const missingHeadings = REQUIRED_HEADINGS.filter((heading) => !text.includes(heading));
  const tooShort = text.length < 2_500;

  return {
    ok: !manualPlaceholderDetected && !tooShort && missingHeadings.length === 0,
    missingHeadings: [...missingHeadings],
    manualPlaceholderDetected,
    tooShort,
  };
}

export function buildRiskReportRepairInstruction(validation: RiskReportValidation) {
  const problems: string[] = [];
  if (validation.manualPlaceholderDetected) problems.push("a resposta contém instruções ou marcadores do fluxo manual");
  if (validation.tooShort) problems.push("a resposta ficou curta demais para o relatório completo");
  if (validation.missingHeadings.length) problems.push(`faltaram estas seções: ${validation.missingHeadings.join(", ")}`);

  return [
    "A resposta anterior não cumpriu integralmente o contrato do relatório.",
    `Problemas detectados: ${problems.join("; ")}.`,
    "Reescreva o relatório completo em Markdown, usando exatamente os títulos obrigatórios, sem mencionar prompt, API, JSON, sistema, modo manual ou instruções de geração.",
    "Preserve somente conclusões sustentadas pelos dados fornecidos e entregue o documento final completo, não um resumo nem uma lista de correções.",
  ].join(" ");
}
