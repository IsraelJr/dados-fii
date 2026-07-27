export const WALLET_RISK_REPORT_AUTOMATIC_FLAG = "ENABLE_WALLET_RISK_REPORT_AUTOMATIC" as const;
export const WALLET_RISK_REPORT_MANUAL_FLAG = "ENABLE_WALLET_RISK_REPORT_MANUAL_FALLBACK" as const;
export const WALLET_RISK_REPORT_AUTOMATIC_SOURCE = "openai_api";
export const WALLET_RISK_REPORT_MANUAL_SOURCE = "manual_prompt";

const REQUIRED_HEADINGS = [
  "# Relatório de Risco da Carteira de FIIs",
  "## Memorando executivo",
  "## Qualidade dos dados analisados",
  "## Modo Gestor — decisões e prioridades",
  "## Concentração e correlação econômica",
  "## Sustentabilidade da renda",
  "## Liquidez e risco de saída",
  "## Valuation e leitura patrimonial",
  "## Ranking relativo de resiliência",
  "## Stress test e tail risks",
  "## Plano de ação e gatilhos de monitoramento",
  "## Heat map final",
] as const;

const REQUIRED_FOOTER = "Conteúdo informativo, sem recomendação de investimento.";

const FORBIDDEN_PATTERNS = [
  { code: "technical_ifix_provider", pattern: /brapi\.dev|yahoo finance/i, message: "provedor técnico do IFIX exposto ao usuário" },
  { code: "arbitrary_numeric_risk_score", pattern: /nota de risco\s*(?:\(\s*0\s*[–-]\s*10\s*\))?\s*:\s*\d+(?:[,.]\d+)?/i, message: "nota numérica de risco sem metodologia determinística" },
  { code: "pvp_as_buy_signal", pattern: /margem positiva|preço atrativo/i, message: "desconto patrimonial convertido em sinal de compra" },
  { code: "governance_overclaim", pattern: /governança\s+(?:forte|alta)/i, message: "qualidade de governança afirmada sem evidência suficiente" },
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
  missingFooter: boolean;
  forbiddenFindings: Array<{ code: string; message: string }>;
  manualPlaceholderDetected: boolean;
  tooShort: boolean;
};

function rolloutFlagEnabled(name: string, defaultValue = false) {
  const value = process.env[name];
  if (value == null || value === "") return defaultValue;
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}

export function walletRiskReportAutomaticEnabled() {
  return rolloutFlagEnabled(WALLET_RISK_REPORT_AUTOMATIC_FLAG, false);
}

export function walletRiskReportManualFallbackEnabled() {
  return rolloutFlagEnabled(WALLET_RISK_REPORT_MANUAL_FLAG, false);
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
  const missingFooter = !text.endsWith(REQUIRED_FOOTER);
  const forbiddenFindings = FORBIDDEN_PATTERNS
    .filter((item) => item.pattern.test(text))
    .map(({ code, message }) => ({ code, message }));
  const tooShort = text.length < 2_500;

  return {
    ok: !manualPlaceholderDetected
      && !tooShort
      && !missingFooter
      && missingHeadings.length === 0
      && forbiddenFindings.length === 0,
    missingHeadings: [...missingHeadings],
    missingFooter,
    forbiddenFindings,
    manualPlaceholderDetected,
    tooShort,
  };
}

export function buildRiskReportRepairInstruction(validation: RiskReportValidation) {
  const problems: string[] = [];
  if (validation.manualPlaceholderDetected) problems.push("a resposta contém instruções ou marcadores do fluxo manual");
  if (validation.tooShort) problems.push("a resposta ficou curta demais para o relatório completo");
  if (validation.missingHeadings.length) problems.push(`faltaram estas seções: ${validation.missingHeadings.join(", ")}`);
  if (validation.missingFooter) problems.push(`faltou o rodapé obrigatório: ${REQUIRED_FOOTER}`);
  if (validation.forbiddenFindings.length) {
    problems.push(`foram encontradas afirmações proibidas: ${validation.forbiddenFindings.map((item) => item.message).join(", ")}`);
  }

  return [
    "A resposta anterior não cumpriu integralmente o contrato comercial e de confiabilidade do relatório.",
    `Problemas detectados: ${problems.join("; ")}.`,
    "Reescreva o relatório completo em Markdown, usando exatamente os títulos obrigatórios, sem mencionar prompt, API, JSON, sistema, modo manual ou instruções de geração.",
    "Use Dados FII como fonte pública do IFIX, preserve os cálculos determinísticos, não atribua governança forte apenas pela identificação institucional e não transforme P/VP baixo em preço atrativo.",
    `Finalize exatamente com: ${REQUIRED_FOOTER}`,
    "Preserve somente conclusões sustentadas pelos dados fornecidos e entregue o documento final completo, não um resumo nem uma lista de correções.",
  ].join(" ");
}
