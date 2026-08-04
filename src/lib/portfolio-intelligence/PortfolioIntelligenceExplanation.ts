import type { AIInsightsMetadata } from "@/types/ai-insights";
import type {
  PortfolioIntelligenceConfidence,
  PortfolioIntelligenceDataQualityReasonCode,
  PortfolioIntelligenceQualityState,
  PortfolioIntelligenceSeverity,
  PortfolioIntelligenceSignalCode,
  PortfolioIntelligenceWarningCode,
} from "./PortfolioIntelligence";

export const PORTFOLIO_EXPLANATION_VERSION = "1.0.0";
export const PORTFOLIO_EXPLANATION_PROMPT_VERSION = "portfolio-intelligence-explanation-v1";
export const PORTFOLIO_EXPLANATION_MAX_SIGNALS = 6;
export const PORTFOLIO_EXPLANATION_DISCLAIMER = "Explicação informativa dos sinais calculados. Não é recomendação de compra, venda ou manutenção de ativos.";

const SIGNAL_CODES: readonly PortfolioIntelligenceSignalCode[] = [
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
];

const QUALITY_REASON_CODES: readonly PortfolioIntelligenceDataQualityReasonCode[] = [
  "EMPTY_PORTFOLIO",
  "MISSING_QUOTES",
  "MISSING_SEGMENTS",
  "MISSING_ESTIMATED_INCOME",
  "ZERO_ESTIMATED_INCOME_TOTAL",
  "INSUFFICIENT_CLOSED_MONTHS",
  "NON_CONSECUTIVE_HISTORY",
  "INVALID_INPUT_REJECTED",
];

const WARNING_CODES: readonly PortfolioIntelligenceWarningCode[] = [
  "CURRENT_COMPETENCE_IGNORED",
  "FUTURE_COMPETENCE_IGNORED",
  "INVALID_INPUT_REJECTED",
  "ZERO_BASE_VARIATION_UNAVAILABLE",
  "PATRIMONY_COVERAGE_UNDETERMINED",
  "INCOME_COVERAGE_INSUFFICIENT",
  "SEGMENT_COVERAGE_INSUFFICIENT",
  "OUTLIER_ZERO_MAD_FALLBACK",
];

const SEVERITIES: readonly PortfolioIntelligenceSeverity[] = ["info", "attention", "warning"];
const CONFIDENCES: readonly PortfolioIntelligenceConfidence[] = ["low", "medium", "high"];
const QUALITY_STATES: readonly PortfolioIntelligenceQualityState[] = ["sufficient", "partial", "insufficient"];

export type PortfolioExplanationEvidenceValue = string | number | boolean | null;

export type PortfolioExplanationInput = Readonly<{
  policyVersion: string;
  asOf: string;
  deterministicFieldsAreImmutable: true;
  dataQuality: Readonly<{
    state: PortfolioIntelligenceQualityState;
    reasons: readonly Readonly<{
      code: PortfolioIntelligenceDataQualityReasonCode;
      impact: "suppressed" | "reduced_confidence";
      message: string;
    }>[];
  }>;
  signals: readonly Readonly<{
    code: PortfolioIntelligenceSignalCode;
    severity: PortfolioIntelligenceSeverity;
    title: string;
    summary: string;
    confidence: PortfolioIntelligenceConfidence;
    evidence: Readonly<Record<string, PortfolioExplanationEvidenceValue>>;
  }>[];
  warnings: readonly Readonly<{
    code: PortfolioIntelligenceWarningCode;
    message: string;
  }>[];
}>;

export type PortfolioExplanationSignal = Readonly<{
  code: PortfolioIntelligenceSignalCode;
  title: string;
  explanation: string;
  whyItMatters: string;
  confidence: PortfolioIntelligenceConfidence;
}>;

export type PortfolioIntelligenceExplanation = Readonly<{
  version: typeof PORTFOLIO_EXPLANATION_VERSION;
  source: "ai" | "deterministic-fallback";
  summary: string;
  signalExplanations: readonly PortfolioExplanationSignal[];
  overallConfidence: PortfolioIntelligenceConfidence;
  limitations: readonly string[];
  disclaimer: typeof PORTFOLIO_EXPLANATION_DISCLAIMER;
  metadata: AIInsightsMetadata | null;
}>;

export const PORTFOLIO_EXPLANATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 1000 },
    signalExplanations: {
      type: "array",
      minItems: 1,
      maxItems: PORTFOLIO_EXPLANATION_MAX_SIGNALS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string", enum: SIGNAL_CODES },
          explanation: { type: "string", minLength: 1, maxLength: 700 },
          whyItMatters: { type: "string", minLength: 1, maxLength: 500 },
        },
        required: ["code", "explanation", "whyItMatters"],
      },
    },
    limitations: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 400 },
    },
  },
  required: ["summary", "signalExplanations", "limitations"],
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") throw new Error(`${field} inválido.`);
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`${field} inválido.`);
  return normalized;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${field} inválido.`);
  return value as T;
}

function evidenceValue(value: unknown, field: string): PortfolioExplanationEvidenceValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${field} inválido.`);
    return value;
  }
  if (typeof value === "string") return text(value, field, 240);
  throw new Error(`${field} inválido.`);
}

function evidenceRecord(value: unknown) {
  if (!isRecord(value)) throw new Error("Evidência inválida.");
  const entries = Object.entries(value);
  if (entries.length > 20) throw new Error("Evidência excede o limite permitido.");
  return Object.fromEntries(entries.map(([key, item]) => [
    text(key, "Chave de evidência", 80),
    evidenceValue(item, `Evidência ${key}`),
  ]));
}

function isoDate(value: unknown, field: string) {
  const normalized = text(value, field, 40);
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`${field} inválido.`);
  return normalized;
}

export function sanitizePortfolioExplanationInput(value: unknown): PortfolioExplanationInput {
  if (!isRecord(value)) throw new Error("Resultado da inteligência da carteira inválido.");
  if (!isRecord(value.dataQuality)) throw new Error("Qualidade dos dados inválida.");

  const rawSignals = Array.isArray(value.signals) ? value.signals : null;
  if (!rawSignals || rawSignals.length > 12) throw new Error("Sinais da carteira inválidos.");
  const signalCodes = new Set<PortfolioIntelligenceSignalCode>();
  const signals = rawSignals.map((rawSignal, index) => {
    if (!isRecord(rawSignal)) throw new Error(`Sinal ${index + 1} inválido.`);
    const code = enumValue(rawSignal.code, SIGNAL_CODES, `Código do sinal ${index + 1}`);
    if (signalCodes.has(code)) throw new Error(`Sinal duplicado: ${code}.`);
    signalCodes.add(code);
    return {
      code,
      severity: enumValue(rawSignal.severity, SEVERITIES, `Severidade do sinal ${code}`),
      title: text(rawSignal.title, `Título do sinal ${code}`, 200),
      summary: text(rawSignal.summary, `Resumo do sinal ${code}`, 800),
      confidence: enumValue(rawSignal.confidence, CONFIDENCES, `Confiança do sinal ${code}`),
      evidence: evidenceRecord(rawSignal.evidence),
    } as const;
  });

  const rawReasons = Array.isArray(value.dataQuality.reasons) ? value.dataQuality.reasons : [];
  if (rawReasons.length > 12) throw new Error("Ressalvas de qualidade inválidas.");
  const reasons = rawReasons.map((rawReason, index) => {
    if (!isRecord(rawReason)) throw new Error(`Ressalva ${index + 1} inválida.`);
    return {
      code: enumValue(rawReason.code, QUALITY_REASON_CODES, `Código da ressalva ${index + 1}`),
      impact: enumValue(rawReason.impact, ["suppressed", "reduced_confidence"] as const, `Impacto da ressalva ${index + 1}`),
      message: text(rawReason.message, `Mensagem da ressalva ${index + 1}`, 500),
    } as const;
  });

  const rawWarnings = Array.isArray(value.warnings) ? value.warnings : [];
  if (rawWarnings.length > 12) throw new Error("Avisos da carteira inválidos.");
  const warnings = rawWarnings.map((rawWarning, index) => {
    if (!isRecord(rawWarning)) throw new Error(`Aviso ${index + 1} inválido.`);
    return {
      code: enumValue(rawWarning.code, WARNING_CODES, `Código do aviso ${index + 1}`),
      message: text(rawWarning.message, `Mensagem do aviso ${index + 1}`, 500),
    } as const;
  });

  return {
    policyVersion: text(value.policyVersion, "Versão da política", 80),
    asOf: isoDate(value.asOf, "Data-base"),
    deterministicFieldsAreImmutable: true,
    dataQuality: {
      state: enumValue(value.dataQuality.state, QUALITY_STATES, "Estado da qualidade"),
      reasons,
    },
    signals,
    warnings,
  };
}

function confidenceRank(value: PortfolioIntelligenceConfidence) {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

export function derivePortfolioExplanationConfidence(input: PortfolioExplanationInput): PortfolioIntelligenceConfidence {
  if (input.dataQuality.state === "insufficient" || input.signals.length === 0) return "low";
  const signalConfidence = input.signals.reduce<PortfolioIntelligenceConfidence>((lowest, signal) => (
    confidenceRank(signal.confidence) < confidenceRank(lowest) ? signal.confidence : lowest
  ), "high");
  if (input.dataQuality.state === "partial" && signalConfidence === "high") return "medium";
  return signalConfidence;
}

function deterministicWhyItMatters(code: PortfolioIntelligenceSignalCode) {
  const messages: Record<PortfolioIntelligenceSignalCode, string> = {
    RENDA_EM_ALTA: "Ajuda a entender se a renda recente avançou de forma consistente dentro do histórico disponível.",
    RENDA_EM_QUEDA: "Mostra uma deterioração recente da renda que merece acompanhamento nas próximas competências.",
    RENDA_ESTAVEL: "Indica previsibilidade recente, sem eliminar o risco de mudanças futuras nos rendimentos.",
    RENDA_INSTAVEL: "Sinaliza que a renda oscilou de forma relevante e pode exigir maior margem de segurança no planejamento.",
    CONCENTRACAO_ELEVADA: "Evidencia dependência patrimonial de poucas posições e menor diversificação da carteira.",
    CONCENTRACAO_POR_SEGMENTO: "Mostra que eventos de um mesmo segmento podem afetar parcela relevante da carteira ao mesmo tempo.",
    DEPENDENCIA_DE_UM_FUNDO: "Indica que uma parte relevante da renda estimada depende do comportamento de um único fundo.",
    MES_ATIPICO_POSITIVO: "Separa um pico pontual de renda da tendência recorrente, evitando tratar exceção como novo padrão.",
    MES_ATIPICO_NEGATIVO: "Destaca uma queda fora do padrão recente que pode ser pontual ou exigir confirmação posterior.",
    DADOS_INSUFICIENTES: "Explicita que parte das conclusões foi limitada para evitar transformar ausência de dados em certeza.",
  };
  return messages[code];
}

function deterministicLimitations(input: PortfolioExplanationInput) {
  const reasons = input.dataQuality.reasons.map((reason) => reason.message);
  const base = reasons.length > 0
    ? reasons
    : ["A leitura depende do histórico e das posições disponíveis na data-base informada."];
  return Array.from(new Set([
    ...base,
    "A explicação não altera, completa ou recalcula as métricas determinísticas.",
  ])).slice(0, 6);
}

export function buildDeterministicPortfolioExplanation(input: PortfolioExplanationInput): PortfolioIntelligenceExplanation {
  const signals = input.signals.slice(0, PORTFOLIO_EXPLANATION_MAX_SIGNALS);
  return {
    version: PORTFOLIO_EXPLANATION_VERSION,
    source: "deterministic-fallback",
    summary: signals.length > 0
      ? "A leitura abaixo traduz os sinais calculados pela carteira sem acrescentar novas conclusões financeiras."
      : "Nenhum sinal material foi emitido com os dados atuais. A análise permanece limitada à qualidade e ao histórico disponíveis.",
    signalExplanations: signals.map((signal) => ({
      code: signal.code,
      title: signal.title,
      explanation: signal.summary,
      whyItMatters: deterministicWhyItMatters(signal.code),
      confidence: signal.confidence,
    })),
    overallConfidence: derivePortfolioExplanationConfidence(input),
    limitations: deterministicLimitations(input),
    disclaimer: PORTFOLIO_EXPLANATION_DISCLAIMER,
    metadata: null,
  };
}

function outputText(value: unknown, field: string, maxLength: number) {
  return text(value, field, maxLength);
}

function hasDigits(value: string) {
  return /\d/.test(value);
}

function hasInvestmentRecommendation(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(?:recomendo|recomendamos|deve|deveria|considere|hora de)\s+(?:comprar|vender|manter|aportar)\b/.test(normalized)
    || /\b(?:compre|venda|mantenha|aporte)\b/.test(normalized);
}

function assertSafeAiNarrative(values: readonly string[]) {
  const combined = values.join(" ");
  if (hasDigits(combined)) throw new Error("A explicação da IA introduziu números e foi rejeitada.");
  if (hasInvestmentRecommendation(combined)) throw new Error("A explicação da IA introduziu recomendação e foi rejeitada.");
}

export function normalizePortfolioExplanationOutput(
  value: unknown,
  input: PortfolioExplanationInput,
  metadata: AIInsightsMetadata,
): PortfolioIntelligenceExplanation {
  if (!isRecord(value)) throw new Error("Saída da explicação inválida.");
  const summary = outputText(value.summary, "Resumo da explicação", 1000);
  const rawItems = Array.isArray(value.signalExplanations) ? value.signalExplanations : null;
  if (!rawItems || rawItems.length === 0 || rawItems.length > PORTFOLIO_EXPLANATION_MAX_SIGNALS) {
    throw new Error("Sinais explicados inválidos.");
  }
  const inputSignals = new Map(input.signals.map((signal) => [signal.code, signal]));
  const seen = new Set<PortfolioIntelligenceSignalCode>();
  const signalExplanations = rawItems.map((rawItem, index) => {
    if (!isRecord(rawItem)) throw new Error(`Explicação ${index + 1} inválida.`);
    const code = enumValue(rawItem.code, SIGNAL_CODES, `Código da explicação ${index + 1}`);
    const sourceSignal = inputSignals.get(code);
    if (!sourceSignal) throw new Error(`A IA explicou um sinal inexistente: ${code}.`);
    if (seen.has(code)) throw new Error(`A IA repetiu o sinal ${code}.`);
    seen.add(code);
    return {
      code,
      title: sourceSignal.title,
      explanation: outputText(rawItem.explanation, `Explicação do sinal ${code}`, 700),
      whyItMatters: outputText(rawItem.whyItMatters, `Impacto do sinal ${code}`, 500),
      confidence: sourceSignal.confidence,
    } as const;
  });
  const rawLimitations = Array.isArray(value.limitations) ? value.limitations : null;
  if (!rawLimitations || rawLimitations.length === 0 || rawLimitations.length > 6) {
    throw new Error("Limitações da explicação inválidas.");
  }
  const aiLimitations = rawLimitations.map((item, index) => outputText(item, `Limitação ${index + 1}`, 400));
  assertSafeAiNarrative([
    summary,
    ...signalExplanations.flatMap((item) => [item.explanation, item.whyItMatters]),
    ...aiLimitations,
  ]);

  return {
    version: PORTFOLIO_EXPLANATION_VERSION,
    source: "ai",
    summary,
    signalExplanations,
    overallConfidence: derivePortfolioExplanationConfidence(input),
    limitations: Array.from(new Set([...aiLimitations, ...deterministicLimitations(input)])).slice(0, 6),
    disclaimer: PORTFOLIO_EXPLANATION_DISCLAIMER,
    metadata,
  };
}
