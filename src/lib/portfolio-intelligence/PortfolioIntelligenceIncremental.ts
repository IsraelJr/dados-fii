import type {
  PortfolioIntelligenceConfidence,
  PortfolioIntelligenceDataQualityReasonCode,
  PortfolioIntelligenceQualityState,
  PortfolioIntelligenceResult,
  PortfolioIntelligenceSeverity,
  PortfolioIntelligenceSignalCode,
  PortfolioIntelligenceWarningCode,
} from "./PortfolioIntelligence";

export const PORTFOLIO_INCREMENTAL_SCHEMA_VERSION = 1 as const;
export const PORTFOLIO_INCREMENTAL_POLICY_VERSION = "1.0.0";

export type PortfolioIncrementalCategory = "data" | "rule" | "coverage" | "quality";
export type PortfolioIncrementalChangeState = "new" | "aggravated" | "reduced" | "resolved" | "unchanged";
export type PortfolioIncrementalStatus = "baseline" | "changed" | "unchanged";
export type PortfolioIncrementalValue = string | number | boolean | null;

export type PortfolioIntelligenceReferenceSignal = Readonly<{
  code: PortfolioIntelligenceSignalCode;
  severity: PortfolioIntelligenceSeverity;
  confidence: PortfolioIntelligenceConfidence;
  title: string;
  summary: string;
  evidence: Readonly<Record<string, PortfolioIncrementalValue>>;
}>;

export type PortfolioIntelligenceReferenceMetrics = Readonly<{
  latestClosedCompetence: string | null;
  latestIncome: number | null;
  blockVariationPercent: number | null;
  sixMonthCoefficientOfVariationPercent: number | null;
  largestPositionSharePercent: number | null;
  topThreeSharePercent: number | null;
  patrimonyHhi: number | null;
  largestIncomeContributorTicker: string | null;
  largestIncomeContributorSharePercent: number | null;
  estimatedIncomeTotal: number | null;
  patrimonyCoveragePercent: number | null;
  segmentCoveragePercent: number | null;
  incomeCoveragePercent: number | null;
  monthsAvailable: number;
}>;

export type PortfolioIntelligenceReference = Readonly<{
  schemaVersion: typeof PORTFOLIO_INCREMENTAL_SCHEMA_VERSION;
  fingerprint: string;
  policyVersion: string;
  generatedAt: string;
  asOf: string;
  signals: readonly PortfolioIntelligenceReferenceSignal[];
  metrics: PortfolioIntelligenceReferenceMetrics;
  quality: Readonly<{
    state: PortfolioIntelligenceQualityState;
    reasonCodes: readonly PortfolioIntelligenceDataQualityReasonCode[];
    warningCodes: readonly PortfolioIntelligenceWarningCode[];
  }>;
}>;

export type PortfolioIncrementalChange = Readonly<{
  id: string;
  category: PortfolioIncrementalCategory;
  state: PortfolioIncrementalChangeState;
  code: string;
  title: string;
  summary: string;
  material: boolean;
  before: PortfolioIncrementalValue;
  after: PortfolioIncrementalValue;
  evidence: Readonly<{
    previousAsOf: string;
    currentAsOf: string;
    previousFingerprint: string;
    currentFingerprint: string;
    threshold: string | null;
  }>;
}>;

export type PortfolioIncrementalComparison = Readonly<{
  schemaVersion: typeof PORTFOLIO_INCREMENTAL_SCHEMA_VERSION;
  policyVersion: typeof PORTFOLIO_INCREMENTAL_POLICY_VERSION;
  status: PortfolioIncrementalStatus;
  previous: PortfolioIntelligenceReference | null;
  current: PortfolioIntelligenceReference;
  changes: readonly PortfolioIncrementalChange[];
  materialChanges: readonly PortfolioIncrementalChange[];
  unchangedSignalCodes: readonly PortfolioIntelligenceSignalCode[];
  summary: Readonly<{
    materialChangeCount: number;
    totalChangeCount: number;
    unchangedSignalCount: number;
    message: string;
  }>;
}>;

export class PortfolioIncrementalValidationError extends Error {
  readonly code:
    | "INVALID_ANALYSIS"
    | "INVALID_REFERENCE"
    | "INVALID_PORTFOLIO_ID";

  constructor(
    code: "INVALID_ANALYSIS" | "INVALID_REFERENCE" | "INVALID_PORTFOLIO_ID",
    message: string,
  ) {
    super(message);
    this.name = "PortfolioIncrementalValidationError";
    this.code = code;
  }
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > maxLength) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
  }
  return normalized;
}

function isoDate(value: unknown, field: string) {
  const normalized = normalizedText(value, field, 48);
  if (!Number.isFinite(Date.parse(normalized))) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
  }
  return normalized;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
  }
  return value as T;
}

function finiteOrNull(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, field: string) {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
  }
  return Number(value);
}

function incrementalValue(value: unknown, field: string): PortfolioIncrementalValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
    return value;
  }
  if (typeof value === "string") return normalizedText(value, field, 240);
  throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
}

function evidenceRecord(value: unknown) {
  if (!isRecord(value)) throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", "Evidência de sinal inválida.");
  const entries = Object.entries(value);
  if (entries.length > 24) throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", "Evidência excede o limite permitido.");
  return Object.freeze(Object.fromEntries(entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [
      normalizedText(key, "Chave de evidência", 80),
      incrementalValue(item, `Evidência ${key}`),
    ])));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, stableValue(item)]));
}

function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function fingerprint(value: unknown) {
  const input = stableJson(value);
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ (code + index), 0x85ebca6b);
  }
  return `${(left >>> 0).toString(16).padStart(8, "0")}${(right >>> 0).toString(16).padStart(8, "0")}`;
}

function canonicalReferenceContent(reference: Omit<PortfolioIntelligenceReference, "fingerprint" | "generatedAt" | "asOf">) {
  return {
    schemaVersion: reference.schemaVersion,
    policyVersion: reference.policyVersion,
    signals: reference.signals,
    metrics: reference.metrics,
    quality: reference.quality,
  };
}

function parseSignal(value: unknown, index: number): PortfolioIntelligenceReferenceSignal {
  if (!isRecord(value)) throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `Sinal ${index + 1} inválido.`);
  return Object.freeze({
    code: enumValue(value.code, SIGNAL_CODES, `Código do sinal ${index + 1}`),
    severity: enumValue(value.severity, SEVERITIES, `Severidade do sinal ${index + 1}`),
    confidence: enumValue(value.confidence, CONFIDENCES, `Confiança do sinal ${index + 1}`),
    title: normalizedText(value.title, `Título do sinal ${index + 1}`, 200),
    summary: normalizedText(value.summary, `Resumo do sinal ${index + 1}`, 900),
    evidence: evidenceRecord(value.evidence),
  });
}

export function normalizePortfolioId(value: unknown) {
  const portfolioId = String(value ?? "default").trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(portfolioId)) {
    throw new PortfolioIncrementalValidationError("INVALID_PORTFOLIO_ID", "Identificador da carteira inválido.");
  }
  return portfolioId;
}

export function createPortfolioIntelligenceReference(value: unknown): PortfolioIntelligenceReference {
  if (!isRecord(value) || !isRecord(value.metrics) || !isRecord(value.dataQuality)) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", "Análise da carteira inválida.");
  }
  const income = isRecord(value.metrics.income) ? value.metrics.income : null;
  const portfolio = isRecord(value.metrics.portfolio) ? value.metrics.portfolio : null;
  if (!income || !portfolio) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", "Métricas da carteira inválidas.");
  }

  const rawSignals = Array.isArray(value.signals) ? value.signals : null;
  if (!rawSignals || rawSignals.length > 20) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", "Sinais da carteira inválidos.");
  }
  const signalCodes = new Set<PortfolioIntelligenceSignalCode>();
  const signals = rawSignals.map((rawSignal, index) => {
    const signal = parseSignal(rawSignal, index);
    if (signalCodes.has(signal.code)) {
      throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `Sinal duplicado: ${signal.code}.`);
    }
    signalCodes.add(signal.code);
    return signal;
  }).sort((left, right) => left.code.localeCompare(right.code));

  const rawReasons = Array.isArray(value.dataQuality.reasons) ? value.dataQuality.reasons : [];
  const reasonCodes = rawReasons.map((reason, index) => {
    if (!isRecord(reason)) throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `Ressalva ${index + 1} inválida.`);
    return enumValue(reason.code, QUALITY_REASON_CODES, `Código da ressalva ${index + 1}`);
  });
  const rawWarnings = Array.isArray(value.warnings) ? value.warnings : [];
  const warningCodes = rawWarnings.map((warning, index) => {
    if (!isRecord(warning)) throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `Aviso ${index + 1} inválido.`);
    return enumValue(warning.code, WARNING_CODES, `Código do aviso ${index + 1}`);
  });

  const largestPosition = isRecord(portfolio.largestPosition) ? portfolio.largestPosition : null;
  const largestIncomeContributor = isRecord(portfolio.largestIncomeContributor) ? portfolio.largestIncomeContributor : null;
  const metrics: PortfolioIntelligenceReferenceMetrics = Object.freeze({
    latestClosedCompetence: income.latestClosedCompetence === null || income.latestClosedCompetence === undefined
      ? null
      : normalizedText(income.latestClosedCompetence, "Última competência encerrada", 7),
    latestIncome: finiteOrNull(income.latestIncome, "Última renda"),
    blockVariationPercent: finiteOrNull(income.blockVariationPercent, "Variação da renda"),
    sixMonthCoefficientOfVariationPercent: finiteOrNull(
      income.sixMonthCoefficientOfVariationPercent,
      "Coeficiente de variação da renda",
    ),
    largestPositionSharePercent: finiteOrNull(largestPosition?.sharePercent, "Participação da maior posição"),
    topThreeSharePercent: finiteOrNull(portfolio.topThreeSharePercent, "Participação das três maiores posições"),
    patrimonyHhi: finiteOrNull(portfolio.patrimonyHhi, "HHI patrimonial"),
    largestIncomeContributorTicker: largestIncomeContributor?.ticker === null || largestIncomeContributor?.ticker === undefined
      ? null
      : normalizedText(largestIncomeContributor.ticker, "Ticker da maior fonte de renda", 12),
    largestIncomeContributorSharePercent: finiteOrNull(
      largestIncomeContributor?.sharePercent,
      "Participação da maior fonte de renda",
    ),
    estimatedIncomeTotal: finiteOrNull(portfolio.estimatedIncomeTotal, "Renda estimada total"),
    patrimonyCoveragePercent: finiteOrNull(value.dataQuality.patrimonyCoveragePercent, "Cobertura patrimonial"),
    segmentCoveragePercent: finiteOrNull(value.dataQuality.segmentCoveragePercent, "Cobertura de segmentos"),
    incomeCoveragePercent: finiteOrNull(value.dataQuality.incomeCoveragePercent, "Cobertura de renda"),
    monthsAvailable: nonNegativeInteger(value.dataQuality.monthsAvailable, "Meses disponíveis"),
  });

  const partial = Object.freeze({
    schemaVersion: PORTFOLIO_INCREMENTAL_SCHEMA_VERSION,
    policyVersion: normalizedText(value.policyVersion, "Versão da política", 80),
    generatedAt: isoDate(value.generatedAt, "Data de geração"),
    asOf: isoDate(value.asOf, "Data-base"),
    signals: Object.freeze(signals),
    metrics,
    quality: Object.freeze({
      state: enumValue(value.dataQuality.state, QUALITY_STATES, "Estado da qualidade"),
      reasonCodes: Object.freeze([...new Set(reasonCodes)].sort()),
      warningCodes: Object.freeze([...new Set(warningCodes)].sort()),
    }),
  });
  const referenceWithoutFingerprint = {
    schemaVersion: partial.schemaVersion,
    policyVersion: partial.policyVersion,
    signals: partial.signals,
    metrics: partial.metrics,
    quality: partial.quality,
  };
  return Object.freeze({
    ...partial,
    fingerprint: fingerprint(referenceWithoutFingerprint),
  });
}

function parseReferenceMetrics(value: unknown): PortfolioIntelligenceReferenceMetrics {
  if (!isRecord(value)) throw new PortfolioIncrementalValidationError("INVALID_REFERENCE", "Métricas da referência inválidas.");
  return Object.freeze({
    latestClosedCompetence: value.latestClosedCompetence === null ? null : normalizedText(value.latestClosedCompetence, "Competência", 7),
    latestIncome: finiteOrNull(value.latestIncome, "Última renda"),
    blockVariationPercent: finiteOrNull(value.blockVariationPercent, "Variação da renda"),
    sixMonthCoefficientOfVariationPercent: finiteOrNull(value.sixMonthCoefficientOfVariationPercent, "Volatilidade da renda"),
    largestPositionSharePercent: finiteOrNull(value.largestPositionSharePercent, "Maior posição"),
    topThreeSharePercent: finiteOrNull(value.topThreeSharePercent, "Três maiores posições"),
    patrimonyHhi: finiteOrNull(value.patrimonyHhi, "HHI"),
    largestIncomeContributorTicker: value.largestIncomeContributorTicker === null
      ? null
      : normalizedText(value.largestIncomeContributorTicker, "Ticker da renda", 12),
    largestIncomeContributorSharePercent: finiteOrNull(value.largestIncomeContributorSharePercent, "Concentração de renda"),
    estimatedIncomeTotal: finiteOrNull(value.estimatedIncomeTotal, "Renda estimada"),
    patrimonyCoveragePercent: finiteOrNull(value.patrimonyCoveragePercent, "Cobertura patrimonial"),
    segmentCoveragePercent: finiteOrNull(value.segmentCoveragePercent, "Cobertura de segmentos"),
    incomeCoveragePercent: finiteOrNull(value.incomeCoveragePercent, "Cobertura de renda"),
    monthsAvailable: nonNegativeInteger(value.monthsAvailable, "Meses disponíveis"),
  });
}

export function sanitizePortfolioIntelligenceReference(value: unknown): PortfolioIntelligenceReference {
  try {
    if (!isRecord(value) || value.schemaVersion !== PORTFOLIO_INCREMENTAL_SCHEMA_VERSION) {
      throw new PortfolioIncrementalValidationError("INVALID_REFERENCE", "Referência incompatível.");
    }
    const rawSignals = Array.isArray(value.signals) ? value.signals : null;
    if (!rawSignals || rawSignals.length > 20) throw new PortfolioIncrementalValidationError("INVALID_REFERENCE", "Sinais inválidos.");
    const signals = rawSignals.map(parseSignal).sort((left, right) => left.code.localeCompare(right.code));
    if (!isRecord(value.quality)) throw new PortfolioIncrementalValidationError("INVALID_REFERENCE", "Qualidade inválida.");
    const reasonCodes = Array.isArray(value.quality.reasonCodes)
      ? value.quality.reasonCodes.map((code) => enumValue(code, QUALITY_REASON_CODES, "Ressalva"))
      : [];
    const warningCodes = Array.isArray(value.quality.warningCodes)
      ? value.quality.warningCodes.map((code) => enumValue(code, WARNING_CODES, "Aviso"))
      : [];
    const referenceWithoutFingerprint = {
      schemaVersion: PORTFOLIO_INCREMENTAL_SCHEMA_VERSION,
      policyVersion: normalizedText(value.policyVersion, "Versão da política", 80),
      signals: Object.freeze(signals),
      metrics: parseReferenceMetrics(value.metrics),
      quality: Object.freeze({
        state: enumValue(value.quality.state, QUALITY_STATES, "Estado da qualidade"),
        reasonCodes: Object.freeze([...new Set(reasonCodes)].sort()),
        warningCodes: Object.freeze([...new Set(warningCodes)].sort()),
      }),
    };
    const expectedFingerprint = fingerprint(canonicalReferenceContent({
      ...referenceWithoutFingerprint,
      generatedAt: "",
      asOf: "",
    }));
    if (value.fingerprint !== expectedFingerprint) {
      throw new PortfolioIncrementalValidationError("INVALID_REFERENCE", "Fingerprint da referência incompatível.");
    }
    return Object.freeze({
      ...referenceWithoutFingerprint,
      fingerprint: expectedFingerprint,
      generatedAt: isoDate(value.generatedAt, "Data de geração"),
      asOf: isoDate(value.asOf, "Data-base"),
    });
  } catch (error) {
    if (error instanceof PortfolioIncrementalValidationError) {
      throw new PortfolioIncrementalValidationError("INVALID_REFERENCE", error.message);
    }
    throw error;
  }
}

function severityRank(value: PortfolioIntelligenceSeverity) {
  return value === "warning" ? 3 : value === "attention" ? 2 : 1;
}

function qualityRank(value: PortfolioIntelligenceQualityState) {
  return value === "insufficient" ? 3 : value === "partial" ? 2 : 1;
}

function stateFromDirection(before: number, after: number, higherIsWorse: boolean): PortfolioIncrementalChangeState {
  const worsened = higherIsWorse ? after > before : after < before;
  return worsened ? "aggravated" : "reduced";
}

function change(
  previous: PortfolioIntelligenceReference,
  current: PortfolioIntelligenceReference,
  input: Omit<PortfolioIncrementalChange, "id" | "evidence"> & { threshold?: string | null },
): PortfolioIncrementalChange {
  return Object.freeze({
    id: `${input.category}:${input.code}:${input.state}`,
    category: input.category,
    state: input.state,
    code: input.code,
    title: input.title,
    summary: input.summary,
    material: input.material,
    before: input.before,
    after: input.after,
    evidence: Object.freeze({
      previousAsOf: previous.asOf,
      currentAsOf: current.asOf,
      previousFingerprint: previous.fingerprint,
      currentFingerprint: current.fingerprint,
      threshold: input.threshold ?? null,
    }),
  });
}

function percentageDelta(before: number, after: number) {
  if (before === 0) return after === 0 ? 0 : null;
  return ((after - before) / Math.abs(before)) * 100;
}

function numericMetricChange(
  previous: PortfolioIntelligenceReference,
  current: PortfolioIntelligenceReference,
  config: Readonly<{
    code: string;
    title: string;
    summary: string;
    before: number | null;
    after: number | null;
    threshold: number;
    thresholdMode: "relative" | "absolute";
    higherIsWorse: boolean;
  }>,
) {
  if (config.before === null || config.after === null || config.before === config.after) return null;
  const delta = config.thresholdMode === "relative"
    ? percentageDelta(config.before, config.after)
    : config.after - config.before;
  if (delta === null || Math.abs(delta) < config.threshold) return null;
  return change(previous, current, {
    category: "data",
    state: stateFromDirection(config.before, config.after, config.higherIsWorse),
    code: config.code,
    title: config.title,
    summary: config.summary,
    material: true,
    before: config.before,
    after: config.after,
    threshold: config.thresholdMode === "relative"
      ? `${config.threshold}% relativos`
      : `${config.threshold} pontos`,
  });
}

function coverageMetricChange(
  previous: PortfolioIntelligenceReference,
  current: PortfolioIntelligenceReference,
  code: string,
  title: string,
  before: number | null,
  after: number | null,
  threshold = 5,
) {
  if (before === after) return null;
  if (before === null || after === null) {
    return change(previous, current, {
      category: "coverage",
      state: after === null ? "aggravated" : "reduced",
      code,
      title,
      summary: after === null
        ? "A informação deixou de estar disponível na análise atual."
        : "A informação passou a estar disponível na análise atual.",
      material: true,
      before,
      after,
      threshold: "mudança entre disponível e ausente",
    });
  }
  if (Math.abs(after - before) < threshold) return null;
  return change(previous, current, {
    category: "coverage",
    state: after < before ? "aggravated" : "reduced",
    code,
    title,
    summary: after < before
      ? "A cobertura dos dados caiu de forma material."
      : "A cobertura dos dados melhorou de forma material.",
    material: true,
    before,
    after,
    threshold: `${threshold} pontos percentuais`,
  });
}

export function comparePortfolioIntelligenceReferences(
  previous: PortfolioIntelligenceReference | null,
  current: PortfolioIntelligenceReference,
): PortfolioIncrementalComparison {
  if (!previous) {
    return Object.freeze({
      schemaVersion: PORTFOLIO_INCREMENTAL_SCHEMA_VERSION,
      policyVersion: PORTFOLIO_INCREMENTAL_POLICY_VERSION,
      status: "baseline",
      previous: null,
      current,
      changes: Object.freeze([]),
      materialChanges: Object.freeze([]),
      unchangedSignalCodes: Object.freeze([]),
      summary: Object.freeze({
        materialChangeCount: 0,
        totalChangeCount: 0,
        unchangedSignalCount: 0,
        message: "Esta é a primeira análise válida. Ela foi salva como referência para a próxima comparação.",
      }),
    });
  }

  const changes: PortfolioIncrementalChange[] = [];
  const unchangedSignalCodes: PortfolioIntelligenceSignalCode[] = [];

  if (previous.policyVersion !== current.policyVersion) {
    changes.push(change(previous, current, {
      category: "rule",
      state: "new",
      code: "POLICY_VERSION_CHANGED",
      title: "A regra de análise mudou",
      summary: "A diferença de versão foi separada das mudanças da carteira para evitar uma interpretação financeira incorreta.",
      material: true,
      before: previous.policyVersion,
      after: current.policyVersion,
      threshold: "qualquer mudança de versão",
    }));
  }

  const previousSignals = new Map(previous.signals.map((signal) => [signal.code, signal]));
  const currentSignals = new Map(current.signals.map((signal) => [signal.code, signal]));
  for (const code of [...new Set([...previousSignals.keys(), ...currentSignals.keys()])].sort()) {
    const before = previousSignals.get(code);
    const after = currentSignals.get(code);
    const category: PortfolioIncrementalCategory = code === "DADOS_INSUFICIENTES" ? "quality" : "data";
    if (!before && after) {
      changes.push(change(previous, current, {
        category,
        state: "new",
        code: `SIGNAL_${code}`,
        title: after.title,
        summary: `Novo sinal material: ${after.summary}`,
        material: true,
        before: null,
        after: after.severity,
        threshold: "entrada de sinal",
      }));
      continue;
    }
    if (before && !after) {
      changes.push(change(previous, current, {
        category,
        state: "resolved",
        code: `SIGNAL_${code}`,
        title: before.title,
        summary: "O sinal deixou de ser emitido com os dados e a política atuais.",
        material: true,
        before: before.severity,
        after: null,
        threshold: "saída de sinal",
      }));
      continue;
    }
    if (!before || !after) continue;
    if (severityRank(before.severity) !== severityRank(after.severity)) {
      const state = severityRank(after.severity) > severityRank(before.severity) ? "aggravated" : "reduced";
      changes.push(change(previous, current, {
        category,
        state,
        code: `SIGNAL_${code}`,
        title: after.title,
        summary: state === "aggravated"
          ? "A severidade determinística deste sinal aumentou."
          : "A severidade determinística deste sinal diminuiu.",
        material: true,
        before: before.severity,
        after: after.severity,
        threshold: "mudança de severidade",
      }));
      continue;
    }
    if (stableJson(before) === stableJson(after)) {
      unchangedSignalCodes.push(code);
    } else {
      changes.push(change(previous, current, {
        category,
        state: "new",
        code: `SIGNAL_EVIDENCE_${code}`,
        title: `Evidências atualizadas: ${after.title}`,
        summary: "O sinal permaneceu na mesma severidade, mas suas evidências ou confiança foram atualizadas.",
        material: false,
        before: before.confidence,
        after: after.confidence,
        threshold: "mudança de evidência sem mudança de severidade",
      }));
    }
  }

  if (previous.quality.state !== current.quality.state) {
    const state = qualityRank(current.quality.state) > qualityRank(previous.quality.state) ? "aggravated" : "reduced";
    changes.push(change(previous, current, {
      category: "quality",
      state,
      code: "QUALITY_STATE_CHANGED",
      title: "A qualidade da análise mudou",
      summary: state === "aggravated"
        ? "A análise atual tem mais limitações de qualidade do que a anterior."
        : "A análise atual tem menos limitações de qualidade do que a anterior.",
      material: true,
      before: previous.quality.state,
      after: current.quality.state,
      threshold: "mudança de estado de qualidade",
    }));
  }

  const previousReasons = new Set(previous.quality.reasonCodes);
  const currentReasons = new Set(current.quality.reasonCodes);
  for (const code of [...new Set([...previousReasons, ...currentReasons])].sort()) {
    if (!previousReasons.has(code)) {
      changes.push(change(previous, current, {
        category: "quality",
        state: "new",
        code: `QUALITY_REASON_${code}`,
        title: "Nova limitação de qualidade",
        summary: `A ressalva ${code} passou a limitar a análise atual.`,
        material: true,
        before: null,
        after: code,
        threshold: "entrada de ressalva",
      }));
    } else if (!currentReasons.has(code)) {
      changes.push(change(previous, current, {
        category: "quality",
        state: "resolved",
        code: `QUALITY_REASON_${code}`,
        title: "Limitação de qualidade resolvida",
        summary: `A ressalva ${code} deixou de limitar a análise atual.`,
        material: true,
        before: code,
        after: null,
        threshold: "saída de ressalva",
      }));
    }
  }

  const coverageChanges = [
    coverageMetricChange(previous, current, "PATRIMONY_COVERAGE", "Cobertura patrimonial mudou", previous.metrics.patrimonyCoveragePercent, current.metrics.patrimonyCoveragePercent),
    coverageMetricChange(previous, current, "SEGMENT_COVERAGE", "Cobertura de segmentos mudou", previous.metrics.segmentCoveragePercent, current.metrics.segmentCoveragePercent),
    coverageMetricChange(previous, current, "INCOME_COVERAGE", "Cobertura de renda mudou", previous.metrics.incomeCoveragePercent, current.metrics.incomeCoveragePercent),
  ].filter((item): item is PortfolioIncrementalChange => Boolean(item));
  changes.push(...coverageChanges);

  if (previous.metrics.monthsAvailable !== current.metrics.monthsAvailable) {
    changes.push(change(previous, current, {
      category: "coverage",
      state: current.metrics.monthsAvailable > previous.metrics.monthsAvailable ? "reduced" : "aggravated",
      code: "HISTORY_MONTHS_CHANGED",
      title: "A cobertura do histórico mudou",
      summary: current.metrics.monthsAvailable > previous.metrics.monthsAvailable
        ? "A análise passou a usar mais competências encerradas."
        : "A análise passou a usar menos competências encerradas.",
      material: true,
      before: previous.metrics.monthsAvailable,
      after: current.metrics.monthsAvailable,
      threshold: "uma competência",
    }));
  }

  const metricChanges = [
    numericMetricChange(previous, current, {
      code: "LATEST_INCOME_CHANGED",
      title: "A renda do último mês fechado mudou",
      summary: "A renda do último mês encerrado variou além da política de materialidade.",
      before: previous.metrics.latestIncome,
      after: current.metrics.latestIncome,
      threshold: 3,
      thresholdMode: "relative",
      higherIsWorse: false,
    }),
    numericMetricChange(previous, current, {
      code: "ESTIMATED_INCOME_TOTAL_CHANGED",
      title: "A renda estimada da carteira mudou",
      summary: "A renda estimada total variou além da política de materialidade.",
      before: previous.metrics.estimatedIncomeTotal,
      after: current.metrics.estimatedIncomeTotal,
      threshold: 3,
      thresholdMode: "relative",
      higherIsWorse: false,
    }),
    numericMetricChange(previous, current, {
      code: "INCOME_TREND_CHANGED",
      title: "A tendência recente de renda mudou",
      summary: "A variação entre os blocos de meses mudou de forma material.",
      before: previous.metrics.blockVariationPercent,
      after: current.metrics.blockVariationPercent,
      threshold: 5,
      thresholdMode: "absolute",
      higherIsWorse: false,
    }),
    numericMetricChange(previous, current, {
      code: "INCOME_VOLATILITY_CHANGED",
      title: "A instabilidade da renda mudou",
      summary: "O coeficiente de variação da renda mudou de forma material.",
      before: previous.metrics.sixMonthCoefficientOfVariationPercent,
      after: current.metrics.sixMonthCoefficientOfVariationPercent,
      threshold: 5,
      thresholdMode: "absolute",
      higherIsWorse: true,
    }),
    numericMetricChange(previous, current, {
      code: "LARGEST_POSITION_CHANGED",
      title: "O peso da maior posição mudou",
      summary: "A concentração na maior posição mudou de forma material.",
      before: previous.metrics.largestPositionSharePercent,
      after: current.metrics.largestPositionSharePercent,
      threshold: 3,
      thresholdMode: "absolute",
      higherIsWorse: true,
    }),
    numericMetricChange(previous, current, {
      code: "TOP_THREE_CONCENTRATION_CHANGED",
      title: "A concentração nas três maiores posições mudou",
      summary: "O peso combinado das três maiores posições mudou de forma material.",
      before: previous.metrics.topThreeSharePercent,
      after: current.metrics.topThreeSharePercent,
      threshold: 3,
      thresholdMode: "absolute",
      higherIsWorse: true,
    }),
    numericMetricChange(previous, current, {
      code: "PATRIMONY_HHI_CHANGED",
      title: "O índice de concentração patrimonial mudou",
      summary: "O HHI patrimonial mudou além da política de materialidade.",
      before: previous.metrics.patrimonyHhi,
      after: current.metrics.patrimonyHhi,
      threshold: 250,
      thresholdMode: "absolute",
      higherIsWorse: true,
    }),
    numericMetricChange(previous, current, {
      code: "INCOME_CONCENTRATION_CHANGED",
      title: "A dependência da principal fonte de renda mudou",
      summary: "A participação do maior contribuinte de renda mudou de forma material.",
      before: previous.metrics.largestIncomeContributorSharePercent,
      after: current.metrics.largestIncomeContributorSharePercent,
      threshold: 3,
      thresholdMode: "absolute",
      higherIsWorse: true,
    }),
  ].filter((item): item is PortfolioIncrementalChange => Boolean(item));
  changes.push(...metricChanges);

  if (previous.metrics.largestIncomeContributorTicker !== current.metrics.largestIncomeContributorTicker
    && previous.metrics.largestIncomeContributorTicker
    && current.metrics.largestIncomeContributorTicker) {
    changes.push(change(previous, current, {
      category: "data",
      state: "new",
      code: "LARGEST_INCOME_CONTRIBUTOR_CHANGED",
      title: "A principal fonte de renda estimada mudou",
      summary: "Outro fundo passou a representar a maior parcela da renda estimada da carteira.",
      material: true,
      before: previous.metrics.largestIncomeContributorTicker,
      after: current.metrics.largestIncomeContributorTicker,
      threshold: "mudança de liderança",
    }));
  }

  const ordered = Object.freeze(changes.sort((left, right) => (
    Number(right.material) - Number(left.material)
    || ["rule", "quality", "coverage", "data"].indexOf(left.category)
      - ["rule", "quality", "coverage", "data"].indexOf(right.category)
    || left.code.localeCompare(right.code)
  )));
  const materialChanges = Object.freeze(ordered.filter((item) => item.material));
  const status: PortfolioIncrementalStatus = materialChanges.length > 0 ? "changed" : "unchanged";
  const message = status === "changed"
    ? `${materialChanges.length} mudança${materialChanges.length === 1 ? " material" : "s materiais"} desde a análise anterior.`
    : "Nenhuma mudança material foi identificada desde a análise anterior.";

  return Object.freeze({
    schemaVersion: PORTFOLIO_INCREMENTAL_SCHEMA_VERSION,
    policyVersion: PORTFOLIO_INCREMENTAL_POLICY_VERSION,
    status,
    previous,
    current,
    changes: ordered,
    materialChanges,
    unchangedSignalCodes: Object.freeze(unchangedSignalCodes.sort()),
    summary: Object.freeze({
      materialChangeCount: materialChanges.length,
      totalChangeCount: ordered.length,
      unchangedSignalCount: unchangedSignalCodes.length,
      message,
    }),
  });
}

export function referenceFromResult(result: PortfolioIntelligenceResult) {
  return createPortfolioIntelligenceReference(result);
}
