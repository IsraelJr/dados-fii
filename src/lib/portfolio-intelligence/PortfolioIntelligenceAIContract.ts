import type {
  PortfolioIntelligenceConfidence,
  PortfolioIntelligenceDataQualityReasonCode,
  PortfolioIntelligenceQualityState,
  PortfolioIntelligenceResult,
  PortfolioIntelligenceSeverity,
  PortfolioIntelligenceSignalCode,
  PortfolioIntelligenceWarningCode,
} from "./PortfolioIntelligence";

export const PORTFOLIO_INTELLIGENCE_AI_PROMPT_VERSION = "portfolio-intelligence-explanation-v1" as const;
export const PORTFOLIO_INTELLIGENCE_AI_ENGINE_VERSION = "1.0.0" as const;
export const PORTFOLIO_INTELLIGENCE_AI_DISCLAIMER = "Explicação informativa. Não constitui recomendação de compra, venda, manutenção ou alocação de investimentos." as const;

const MAX_SAFE_INPUT_BYTES = 32_000;
const MAX_SIGNALS = 12;
const MAX_REASONS = 12;
const MAX_WARNINGS = 12;
const MAX_EVIDENCE_KEYS = 20;
const PRIVATE_KEY_PATTERN = /email|e-mail|token|cookie|session|password|senha|secret|owner|user(?:id)?|uid|cpf|phone|telefone/i;
const RECOMMENDATION_PATTERN = /\b(?:compre|comprar|venda|vender|mantenha|manter\s+(?:a\s+)?posi[cç][aã]o|aumente|aumentar\s+(?:a\s+)?posi[cç][aã]o|reduza|reduzir\s+(?:a\s+)?posi[cç][aã]o|aporte|aportar|alocar|aloca[cç][aã]o|entre\s+no|saia\s+do)\b/i;
const PROMISE_PATTERN = /\b(?:retorno\s+garantido|rentabilidade\s+garantida|ganho\s+certo|sem\s+risco)\b/i;

const SIGNAL_CODES = new Set<PortfolioIntelligenceSignalCode>([
  "RENDA_EM_ALTA",
  "RENDA_EM_QUEDA",
  "RENDA_ESTAVEL",
  "RENDA_INSTAVEL",
  "CONCENTRACAO_ELEVADA",
  "CONCENTRACAO_POR_SEGMENTO",
  "DEPENDENCIA_DE_UM_FUNDO",
  "MES_ATIPICO_POSITIVO",
  "MES_ATIPICO_NEGATIVO",
  "DADOS_INSUFICIENTES",
]);
const SEVERITIES = new Set<PortfolioIntelligenceSeverity>(["info", "attention", "warning"]);
const CONFIDENCES = new Set<PortfolioIntelligenceConfidence>(["low", "medium", "high"]);
const QUALITY_STATES = new Set<PortfolioIntelligenceQualityState>(["sufficient", "partial", "insufficient"]);
const REASON_CODES = new Set<PortfolioIntelligenceDataQualityReasonCode>([
  "EMPTY_PORTFOLIO",
  "MISSING_QUOTES",
  "MISSING_SEGMENTS",
  "MISSING_ESTIMATED_INCOME",
  "ZERO_ESTIMATED_INCOME_TOTAL",
  "INSUFFICIENT_CLOSED_MONTHS",
  "NON_CONSECUTIVE_HISTORY",
  "INVALID_INPUT_REJECTED",
]);
const WARNING_CODES = new Set<PortfolioIntelligenceWarningCode>([
  "CURRENT_COMPETENCE_IGNORED",
  "FUTURE_COMPETENCE_IGNORED",
  "INVALID_INPUT_REJECTED",
  "ZERO_BASE_VARIATION_UNAVAILABLE",
  "PATRIMONY_COVERAGE_UNDETERMINED",
  "INCOME_COVERAGE_INSUFFICIENT",
  "SEGMENT_COVERAGE_INSUFFICIENT",
  "OUTLIER_ZERO_MAD_FALLBACK",
]);

export type PortfolioIntelligenceAISafeEvidence = Readonly<Record<string, string | number | boolean | null>>;

export type PortfolioIntelligenceAISafeInput = Readonly<{
  policyVersion: string;
  metrics: Readonly<{
    income: Readonly<{
      validMonthCount: number;
      latestClosedCompetence: string | null;
      latestIncome: number | null;
      previousIncome: number | null;
      monthlyVariationPercent: number | null;
      recentThreeMonthAverage: number | null;
      previousThreeMonthAverage: number | null;
      blockVariationPercent: number | null;
      sixMonthCoefficientOfVariationPercent: number | null;
      outlier: Readonly<{
        competence: string;
        value: number;
        baselineMedian: number;
        relativeDeviationPercent: number | null;
        direction: "positive" | "negative";
      }> | null;
    }>;
    portfolio: Readonly<{
      fundCount: number;
      validPatrimonyTotal: number;
      largestPosition: Readonly<{ ticker: string; value: number; sharePercent: number }> | null;
      topThreeSharePercent: number | null;
      patrimonyHhi: number | null;
      segmentCoveragePercent: number | null;
      estimatedIncomeTotal: number | null;
      largestIncomeContributor: Readonly<{ ticker: string; income: number; sharePercent: number }> | null;
      incomeConcentrationPercent: number | null;
    }>;
  }>;
  signals: readonly Readonly<{
    code: PortfolioIntelligenceSignalCode;
    severity: PortfolioIntelligenceSeverity;
    title: string;
    summary: string;
    confidence: PortfolioIntelligenceConfidence;
    evidence: PortfolioIntelligenceAISafeEvidence;
    policyVersion: string;
  }>[];
  dataQuality: Readonly<{
    state: PortfolioIntelligenceQualityState;
    monthsAvailable: number;
    monthsRequired: number;
    confidence: Readonly<Record<"trend" | "concentration" | "segments" | "income", PortfolioIntelligenceConfidence>>;
    reasons: readonly Readonly<{
      code: PortfolioIntelligenceDataQualityReasonCode;
      conclusion: "analysis" | "trend" | "concentration" | "segments" | "income";
      impact: "suppressed" | "reduced_confidence";
      message: string;
      evidence: PortfolioIntelligenceAISafeEvidence;
    }>[];
  }>;
  warnings: readonly Readonly<{
    code: PortfolioIntelligenceWarningCode;
    message: string;
    competence: string | null;
  }>[];
}>;

export type PortfolioIntelligenceAIExplanation = Readonly<{
  mode: "ai" | "deterministic_fallback";
  headline: string;
  summary: string;
  keyPoints: readonly string[];
  limitations: readonly string[];
  disclaimer: typeof PORTFOLIO_INTELLIGENCE_AI_DISCLAIMER;
  metadata: Readonly<{
    engineVersion: typeof PORTFOLIO_INTELLIGENCE_AI_ENGINE_VERSION;
    promptVersion: typeof PORTFOLIO_INTELLIGENCE_AI_PROMPT_VERSION;
    model: string | null;
    fingerprint: string;
    generatedAt: string;
    cached: boolean;
    fallbackReason: string | null;
  }>;
}>;

export class PortfolioIntelligenceAIValidationError extends Error {
  readonly code: "INVALID_INPUT" | "INPUT_TOO_LARGE" | "INVALID_OUTPUT" | "UNSAFE_OUTPUT";

  constructor(code: PortfolioIntelligenceAIValidationError["code"], message: string) {
    super(message);
    this.name = "PortfolioIntelligenceAIValidationError";
    this.code = code;
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", `${label} inválido.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", `${label} inválido.`);
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > maxLength) {
    throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", `${label} fora do limite.`);
  }
  return normalized;
}

function optionalText(value: unknown, label: string, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  return text(value, label, maxLength);
}

function finiteNumber(value: unknown, label: string, options?: { integer?: boolean; min?: number; max?: number }) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", `${label} inválido.`);
  }
  if (options?.integer && !Number.isInteger(value)) {
    throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", `${label} deve ser inteiro.`);
  }
  if (options?.min !== undefined && value < options.min) {
    throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", `${label} abaixo do limite.`);
  }
  if (options?.max !== undefined && value > options.max) {
    throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", `${label} acima do limite.`);
  }
  return value;
}

function nullableNumber(value: unknown, label: string, options?: { min?: number; max?: number }) {
  if (value === null || value === undefined) return null;
  return finiteNumber(value, label, options);
}

function enumValue<T extends string>(value: unknown, values: ReadonlySet<T>, label: string): T {
  if (typeof value !== "string" || !values.has(value as T)) {
    throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", `${label} inválido.`);
  }
  return value as T;
}

function safeEvidence(value: unknown, label: string): PortfolioIntelligenceAISafeEvidence {
  const source = record(value, label);
  const entries = Object.entries(source);
  if (entries.length > MAX_EVIDENCE_KEYS) {
    throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", `${label} excedeu o limite de evidências.`);
  }
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) || PRIVATE_KEY_PATTERN.test(key)) {
      throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", `${label} contém chave não permitida.`);
    }
    if (item === null || typeof item === "boolean") result[key] = item;
    else if (typeof item === "number" && Number.isFinite(item) && Math.abs(item) <= 1e15) result[key] = item;
    else if (typeof item === "string") result[key] = text(item, `${label}.${key}`, 240);
    else throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", `${label}.${key} inválido.`);
  }
  return Object.freeze(result);
}

function safePosition(value: unknown, label: string) {
  if (value === null || value === undefined) return null;
  const source = record(value, label);
  return Object.freeze({
    ticker: text(source.ticker, `${label}.ticker`, 20).toUpperCase(),
    value: finiteNumber(source.value, `${label}.value`, { min: 0, max: 1e15 }),
    sharePercent: finiteNumber(source.sharePercent, `${label}.sharePercent`, { min: 0, max: 100.000001 }),
  });
}

function safeIncomeContributor(value: unknown, label: string) {
  if (value === null || value === undefined) return null;
  const source = record(value, label);
  return Object.freeze({
    ticker: text(source.ticker, `${label}.ticker`, 20).toUpperCase(),
    income: finiteNumber(source.income, `${label}.income`, { min: 0, max: 1e15 }),
    sharePercent: finiteNumber(source.sharePercent, `${label}.sharePercent`, { min: 0, max: 100.000001 }),
  });
}

export function buildPortfolioIntelligenceAISafeInput(resultValue: unknown): PortfolioIntelligenceAISafeInput {
  const result = record(resultValue, "result");
  const metrics = record(result.metrics, "result.metrics");
  const income = record(metrics.income, "result.metrics.income");
  const portfolio = record(metrics.portfolio, "result.metrics.portfolio");
  const dataQuality = record(result.dataQuality, "result.dataQuality");
  const confidence = record(dataQuality.confidence, "result.dataQuality.confidence");
  const outlierSource = income.outlier === null || income.outlier === undefined
    ? null
    : record(income.outlier, "result.metrics.income.outlier");

  const signalsSource = Array.isArray(result.signals) ? result.signals : [];
  if (signalsSource.length > MAX_SIGNALS) {
    throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", "Quantidade de sinais acima do limite.");
  }
  const signals = signalsSource.map((item, index) => {
    const signal = record(item, `result.signals[${index}]`);
    return Object.freeze({
      code: enumValue(signal.code, SIGNAL_CODES, `result.signals[${index}].code`),
      severity: enumValue(signal.severity, SEVERITIES, `result.signals[${index}].severity`),
      title: text(signal.title, `result.signals[${index}].title`, 180),
      summary: text(signal.summary, `result.signals[${index}].summary`, 700),
      confidence: enumValue(signal.confidence, CONFIDENCES, `result.signals[${index}].confidence`),
      evidence: safeEvidence(signal.evidence, `result.signals[${index}].evidence`),
      policyVersion: text(signal.policyVersion, `result.signals[${index}].policyVersion`, 40),
    });
  });

  const reasonsSource = Array.isArray(dataQuality.reasons) ? dataQuality.reasons : [];
  if (reasonsSource.length > MAX_REASONS) {
    throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", "Quantidade de ressalvas acima do limite.");
  }
  const reasons = reasonsSource.map((item, index) => {
    const reason = record(item, `result.dataQuality.reasons[${index}]`);
    const conclusion = enumValue(reason.conclusion, new Set(["analysis", "trend", "concentration", "segments", "income"] as const), `result.dataQuality.reasons[${index}].conclusion`);
    const impact = enumValue(reason.impact, new Set(["suppressed", "reduced_confidence"] as const), `result.dataQuality.reasons[${index}].impact`);
    return Object.freeze({
      code: enumValue(reason.code, REASON_CODES, `result.dataQuality.reasons[${index}].code`),
      conclusion,
      impact,
      message: text(reason.message, `result.dataQuality.reasons[${index}].message`, 700),
      evidence: safeEvidence(reason.evidence, `result.dataQuality.reasons[${index}].evidence`),
    });
  });

  const warningsSource = Array.isArray(result.warnings) ? result.warnings : [];
  if (warningsSource.length > MAX_WARNINGS) {
    throw new PortfolioIntelligenceAIValidationError("INVALID_INPUT", "Quantidade de avisos acima do limite.");
  }
  const warnings = warningsSource.map((item, index) => {
    const warning = record(item, `result.warnings[${index}]`);
    return Object.freeze({
      code: enumValue(warning.code, WARNING_CODES, `result.warnings[${index}].code`),
      message: text(warning.message, `result.warnings[${index}].message`, 700),
      competence: optionalText(warning.competence, `result.warnings[${index}].competence`, 7),
    });
  });

  const safeInput: PortfolioIntelligenceAISafeInput = Object.freeze({
    policyVersion: text(result.policyVersion, "result.policyVersion", 40),
    metrics: Object.freeze({
      income: Object.freeze({
        validMonthCount: finiteNumber(income.validMonthCount, "result.metrics.income.validMonthCount", { integer: true, min: 0, max: 600 }),
        latestClosedCompetence: optionalText(income.latestClosedCompetence, "result.metrics.income.latestClosedCompetence", 7),
        latestIncome: nullableNumber(income.latestIncome, "result.metrics.income.latestIncome", { min: 0, max: 1e15 }),
        previousIncome: nullableNumber(income.previousIncome, "result.metrics.income.previousIncome", { min: 0, max: 1e15 }),
        monthlyVariationPercent: nullableNumber(income.monthlyVariationPercent, "result.metrics.income.monthlyVariationPercent", { min: -100_000, max: 100_000 }),
        recentThreeMonthAverage: nullableNumber(income.recentThreeMonthAverage, "result.metrics.income.recentThreeMonthAverage", { min: 0, max: 1e15 }),
        previousThreeMonthAverage: nullableNumber(income.previousThreeMonthAverage, "result.metrics.income.previousThreeMonthAverage", { min: 0, max: 1e15 }),
        blockVariationPercent: nullableNumber(income.blockVariationPercent, "result.metrics.income.blockVariationPercent", { min: -100_000, max: 100_000 }),
        sixMonthCoefficientOfVariationPercent: nullableNumber(income.sixMonthCoefficientOfVariationPercent, "result.metrics.income.sixMonthCoefficientOfVariationPercent", { min: 0, max: 100_000 }),
        outlier: outlierSource ? Object.freeze({
          competence: text(outlierSource.competence, "result.metrics.income.outlier.competence", 7),
          value: finiteNumber(outlierSource.value, "result.metrics.income.outlier.value", { min: 0, max: 1e15 }),
          baselineMedian: finiteNumber(outlierSource.baselineMedian, "result.metrics.income.outlier.baselineMedian", { min: 0, max: 1e15 }),
          relativeDeviationPercent: nullableNumber(outlierSource.relativeDeviationPercent, "result.metrics.income.outlier.relativeDeviationPercent", { min: 0, max: 100_000 }),
          direction: enumValue(outlierSource.direction, new Set(["positive", "negative"] as const), "result.metrics.income.outlier.direction"),
        }) : null,
      }),
      portfolio: Object.freeze({
        fundCount: finiteNumber(portfolio.fundCount, "result.metrics.portfolio.fundCount", { integer: true, min: 0, max: 2_000 }),
        validPatrimonyTotal: finiteNumber(portfolio.validPatrimonyTotal, "result.metrics.portfolio.validPatrimonyTotal", { min: 0, max: 1e15 }),
        largestPosition: safePosition(portfolio.largestPosition, "result.metrics.portfolio.largestPosition"),
        topThreeSharePercent: nullableNumber(portfolio.topThreeSharePercent, "result.metrics.portfolio.topThreeSharePercent", { min: 0, max: 100.000001 }),
        patrimonyHhi: nullableNumber(portfolio.patrimonyHhi, "result.metrics.portfolio.patrimonyHhi", { min: 0, max: 10_000.000001 }),
        segmentCoveragePercent: nullableNumber(portfolio.segmentCoveragePercent, "result.metrics.portfolio.segmentCoveragePercent", { min: 0, max: 100.000001 }),
        estimatedIncomeTotal: nullableNumber(portfolio.estimatedIncomeTotal, "result.metrics.portfolio.estimatedIncomeTotal", { min: 0, max: 1e15 }),
        largestIncomeContributor: safeIncomeContributor(portfolio.largestIncomeContributor, "result.metrics.portfolio.largestIncomeContributor"),
        incomeConcentrationPercent: nullableNumber(portfolio.incomeConcentrationPercent, "result.metrics.portfolio.incomeConcentrationPercent", { min: 0, max: 100.000001 }),
      }),
    }),
    signals: Object.freeze(signals),
    dataQuality: Object.freeze({
      state: enumValue(dataQuality.state, QUALITY_STATES, "result.dataQuality.state"),
      monthsAvailable: finiteNumber(dataQuality.monthsAvailable, "result.dataQuality.monthsAvailable", { integer: true, min: 0, max: 600 }),
      monthsRequired: finiteNumber(dataQuality.monthsRequired, "result.dataQuality.monthsRequired", { integer: true, min: 0, max: 600 }),
      confidence: Object.freeze({
        trend: enumValue(confidence.trend, CONFIDENCES, "result.dataQuality.confidence.trend"),
        concentration: enumValue(confidence.concentration, CONFIDENCES, "result.dataQuality.confidence.concentration"),
        segments: enumValue(confidence.segments, CONFIDENCES, "result.dataQuality.confidence.segments"),
        income: enumValue(confidence.income, CONFIDENCES, "result.dataQuality.confidence.income"),
      }),
      reasons: Object.freeze(reasons),
    }),
    warnings: Object.freeze(warnings),
  });

  if (JSON.stringify(safeInput).length > MAX_SAFE_INPUT_BYTES) {
    throw new PortfolioIntelligenceAIValidationError("INPUT_TOO_LARGE", "Entrada da explicação excedeu o limite seguro.");
  }
  return safeInput;
}

function outputText(value: unknown, label: string, maxLength: number) {
  const normalized = text(value, label, maxLength);
  if (RECOMMENDATION_PATTERN.test(normalized) || PROMISE_PATTERN.test(normalized)) {
    throw new PortfolioIntelligenceAIValidationError("UNSAFE_OUTPUT", `${label} contém orientação não permitida.`);
  }
  return normalized;
}

export function normalizePortfolioIntelligenceAIOutput(value: unknown) {
  const source = record(value, "output");
  const keyPointsSource = Array.isArray(source.keyPoints) ? source.keyPoints : [];
  const limitationsSource = Array.isArray(source.limitations) ? source.limitations : [];
  if (!keyPointsSource.length || keyPointsSource.length > 4 || !limitationsSource.length || limitationsSource.length > 4) {
    throw new PortfolioIntelligenceAIValidationError("INVALID_OUTPUT", "Listas da explicação fora do contrato.");
  }
  return Object.freeze({
    headline: outputText(source.headline, "output.headline", 180),
    summary: outputText(source.summary, "output.summary", 900),
    keyPoints: Object.freeze(keyPointsSource.map((item, index) => outputText(item, `output.keyPoints[${index}]`, 500))),
    limitations: Object.freeze(limitationsSource.map((item, index) => outputText(item, `output.limitations[${index}]`, 500))),
  });
}

export function buildPortfolioIntelligenceAIFallback(
  result: PortfolioIntelligenceResult,
  options: {
    fingerprint?: string;
    generatedAt?: string;
    cached?: boolean;
    fallbackReason?: string | null;
  } = {},
): PortfolioIntelligenceAIExplanation {
  const input = buildPortfolioIntelligenceAISafeInput(result);
  const prioritySignals = input.signals.filter((signal) => signal.severity !== "info");
  const selected = (prioritySignals.length ? prioritySignals : input.signals).slice(0, 3);
  const headline = selected[0]?.title || (input.dataQuality.state === "insufficient"
    ? "Ainda não há dados suficientes para uma explicação completa"
    : "Nenhuma mudança material foi identificada");
  const summary = input.signals.length
    ? `A análise determinística emitiu ${input.signals.length} sinal(is) com base na política ${input.policyVersion}.`
    : `A política ${input.policyVersion} não emitiu sinal material com os dados atuais.`;
  const keyPoints = selected.length
    ? selected.map((signal) => `${signal.title}: ${signal.summary}`)
    : ["O painel determinístico permanece como a fonte de verdade desta leitura."];
  const limitations = input.dataQuality.reasons.length
    ? input.dataQuality.reasons.slice(0, 3).map((reason) => reason.message)
    : ["A explicação usa somente métricas e sinais determinísticos já calculados; não consulta notícias nem informações externas."];

  return Object.freeze({
    mode: "deterministic_fallback",
    headline,
    summary,
    keyPoints: Object.freeze(keyPoints),
    limitations: Object.freeze(limitations),
    disclaimer: PORTFOLIO_INTELLIGENCE_AI_DISCLAIMER,
    metadata: Object.freeze({
      engineVersion: PORTFOLIO_INTELLIGENCE_AI_ENGINE_VERSION,
      promptVersion: PORTFOLIO_INTELLIGENCE_AI_PROMPT_VERSION,
      model: null,
      fingerprint: options.fingerprint || "deterministic",
      generatedAt: options.generatedAt || new Date().toISOString(),
      cached: Boolean(options.cached),
      fallbackReason: options.fallbackReason || "ai_unavailable",
    }),
  });
}
