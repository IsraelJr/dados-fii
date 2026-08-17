import type {
  PortfolioIntelligenceConfidence,
  PortfolioIntelligenceDataQualityReasonCode,
  PortfolioIntelligenceQualityState,
  PortfolioIntelligenceResult,
  PortfolioIntelligenceSeverity,
  PortfolioIntelligenceSignalCode,
  PortfolioIntelligenceWarningCode,
} from "./PortfolioIntelligence";

export const PORTFOLIO_INCREMENTAL_SCHEMA_VERSION = 2 as const;
export const PORTFOLIO_INCREMENTAL_POLICY_VERSION = "2.0.0";

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

export type PortfolioIntelligenceReferenceWarning = Readonly<{
  code: PortfolioIntelligenceWarningCode;
  competence: string | null;
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

export type PortfolioIntelligenceReferenceConfidence = Readonly<{
  trend: PortfolioIntelligenceConfidence;
  concentration: PortfolioIntelligenceConfidence;
  segments: PortfolioIntelligenceConfidence;
  income: PortfolioIntelligenceConfidence;
}>;

export type PortfolioIntelligenceReference = Readonly<{
  schemaVersion: typeof PORTFOLIO_INCREMENTAL_SCHEMA_VERSION;
  fingerprint: string;
  dataFingerprint: string;
  policyFingerprint: string;
  domainVersion: string;
  policyVersion: string;
  generatedAt: string;
  asOf: string;
  signals: readonly PortfolioIntelligenceReferenceSignal[];
  metrics: PortfolioIntelligenceReferenceMetrics;
  quality: Readonly<{
    state: PortfolioIntelligenceQualityState;
    reasonCodes: readonly PortfolioIntelligenceDataQualityReasonCode[];
    warningCodes: readonly PortfolioIntelligenceWarningCode[];
    warnings: readonly PortfolioIntelligenceReferenceWarning[];
    confidence: PortfolioIntelligenceReferenceConfidence;
    pricedPositionCount: number;
    unpricedPositionCount: number;
    knownSegmentPositionCount: number;
    incomeKnownPositionCount: number;
    monthsRequired: number;
  }>;
}>;

export type PortfolioIntelligenceReferenceProvenance = Readonly<{
  dataFingerprint?: string;
  policyFingerprint?: string;
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
  comparisonId: string;
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
    | "INVALID_PORTFOLIO_ID"
    | "DUPLICATE_CHANGE";

  constructor(
    code:
      | "INVALID_ANALYSIS"
      | "INVALID_REFERENCE"
      | "INVALID_PORTFOLIO_ID"
      | "DUPLICATE_CHANGE",
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
const CONFIDENCE_DIMENSIONS = ["trend", "concentration", "segments", "income"] as const;
const CHANGE_CATEGORY_ORDER: readonly PortfolioIncrementalCategory[] = ["rule", "quality", "coverage", "data"];
const SHA_256_INITIAL_STATE = [
  0x6a09e667,
  0xbb67ae85,
  0x3c6ef372,
  0xa54ff53a,
  0x510e527f,
  0x9b05688c,
  0x1f83d9ab,
  0x5be0cd19,
] as const;
const SHA_256_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

type ConfidenceDimension = typeof CONFIDENCE_DIMENSIONS[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
  }
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

function competence(value: unknown, field: string) {
  const normalized = normalizedText(value, field, 7);
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(normalized)) {
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
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
  }
  return value;
}

function incrementalValue(value: unknown, field: string): PortfolioIncrementalValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
    }
    return value;
  }
  if (typeof value === "string") return normalizedText(value, field, 240);
  throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
}

function evidenceRecord(value: unknown) {
  if (!isRecord(value)) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", "Evidência de sinal inválida.");
  }
  const entries = Object.entries(value);
  if (entries.length > 24) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", "Evidência excede o limite permitido.");
  }
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

function rotateRight(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(stableJson(value));
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const bitLength = bytes.length * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const state: number[] = [...SHA_256_INITIAL_STATE];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + (index * 4), false);
    }
    for (let index = 16; index < 64; index += 1) {
      const beforeTwo = words[index - 2] ?? 0;
      const beforeFifteen = words[index - 15] ?? 0;
      const sigmaOne = rotateRight(beforeTwo, 17) ^ rotateRight(beforeTwo, 19) ^ (beforeTwo >>> 10);
      const sigmaZero = rotateRight(beforeFifteen, 7) ^ rotateRight(beforeFifteen, 18) ^ (beforeFifteen >>> 3);
      words[index] = ((words[index - 16] ?? 0) + sigmaZero + (words[index - 7] ?? 0) + sigmaOne) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const upperOne = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporaryOne = (h + upperOne + choose + (SHA_256_CONSTANTS[index] ?? 0) + (words[index] ?? 0)) >>> 0;
      const upperZero = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporaryTwo = (upperZero + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporaryOne) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporaryOne + temporaryTwo) >>> 0;
    }
    state[0] = ((state[0] ?? 0) + a) >>> 0;
    state[1] = ((state[1] ?? 0) + b) >>> 0;
    state[2] = ((state[2] ?? 0) + c) >>> 0;
    state[3] = ((state[3] ?? 0) + d) >>> 0;
    state[4] = ((state[4] ?? 0) + e) >>> 0;
    state[5] = ((state[5] ?? 0) + f) >>> 0;
    state[6] = ((state[6] ?? 0) + g) >>> 0;
    state[7] = ((state[7] ?? 0) + h) >>> 0;
  }
  return state.map((part) => part.toString(16).padStart(8, "0")).join("");
}

function sha256Value(value: unknown, field: string) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `${field} inválido.`);
  }
  return value;
}

function parseSignal(value: unknown, index: number): PortfolioIntelligenceReferenceSignal {
  if (!isRecord(value)) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `Sinal ${index + 1} inválido.`);
  }
  return Object.freeze({
    code: enumValue(value.code, SIGNAL_CODES, `Código do sinal ${index + 1}`),
    severity: enumValue(value.severity, SEVERITIES, `Severidade do sinal ${index + 1}`),
    confidence: enumValue(value.confidence, CONFIDENCES, `Confiança do sinal ${index + 1}`),
    title: normalizedText(value.title, `Título do sinal ${index + 1}`, 200),
    summary: normalizedText(value.summary, `Resumo do sinal ${index + 1}`, 900),
    evidence: evidenceRecord(value.evidence),
  });
}

function parseWarning(value: unknown, index: number): PortfolioIntelligenceReferenceWarning {
  if (!isRecord(value)) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `Aviso ${index + 1} inválido.`);
  }
  return Object.freeze({
    code: enumValue(value.code, WARNING_CODES, `Código do aviso ${index + 1}`),
    competence: value.competence === null || value.competence === undefined
      ? null
      : competence(value.competence, `Competência do aviso ${index + 1}`),
  });
}

function parseConfidence(value: unknown): PortfolioIntelligenceReferenceConfidence {
  if (!isRecord(value)) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", "Confiança da referência inválida.");
  }
  return Object.freeze({
    trend: enumValue(value.trend, CONFIDENCES, "Confiança de tendência"),
    concentration: enumValue(value.concentration, CONFIDENCES, "Confiança de concentração"),
    segments: enumValue(value.segments, CONFIDENCES, "Confiança de segmentos"),
    income: enumValue(value.income, CONFIDENCES, "Confiança de renda"),
  });
}

function uniqueSignals(signals: readonly PortfolioIntelligenceReferenceSignal[]) {
  const seen = new Set<PortfolioIntelligenceSignalCode>();
  for (const signal of signals) {
    if (seen.has(signal.code)) {
      throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `Sinal duplicado: ${signal.code}.`);
    }
    seen.add(signal.code);
  }
}

function uniqueWarnings(warnings: readonly PortfolioIntelligenceReferenceWarning[]) {
  const seen = new Set<string>();
  for (const warning of warnings) {
    const key = `${warning.code}:${warning.competence ?? "-"}`;
    if (seen.has(key)) {
      throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `Aviso duplicado: ${key}.`);
    }
    seen.add(key);
  }
}

function referenceDataContent(
  metrics: PortfolioIntelligenceReferenceMetrics,
  quality: PortfolioIntelligenceReference["quality"],
) {
  return {
    metrics,
    quality: {
      warnings: quality.warnings,
      pricedPositionCount: quality.pricedPositionCount,
      unpricedPositionCount: quality.unpricedPositionCount,
      knownSegmentPositionCount: quality.knownSegmentPositionCount,
      incomeKnownPositionCount: quality.incomeKnownPositionCount,
    },
  };
}

function canonicalReferenceContent(
  reference: Omit<PortfolioIntelligenceReference, "fingerprint" | "generatedAt" | "asOf">,
) {
  return {
    schemaVersion: reference.schemaVersion,
    dataFingerprint: reference.dataFingerprint,
    policyFingerprint: reference.policyFingerprint,
    domainVersion: reference.domainVersion,
    policyVersion: reference.policyVersion,
    signals: reference.signals,
    metrics: reference.metrics,
    quality: reference.quality,
  };
}

function parseReferenceMetrics(value: unknown): PortfolioIntelligenceReferenceMetrics {
  if (!isRecord(value)) {
    throw new PortfolioIncrementalValidationError("INVALID_REFERENCE", "Métricas da referência inválidas.");
  }
  return Object.freeze({
    latestClosedCompetence: value.latestClosedCompetence === null
      ? null
      : competence(value.latestClosedCompetence, "Competência"),
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

function parseReferenceQuality(value: unknown): PortfolioIntelligenceReference["quality"] {
  if (!isRecord(value)) {
    throw new PortfolioIncrementalValidationError("INVALID_REFERENCE", "Qualidade inválida.");
  }
  if (!Array.isArray(value.reasonCodes)
    || !Array.isArray(value.warningCodes)
    || !Array.isArray(value.warnings)) {
    throw new PortfolioIncrementalValidationError("INVALID_REFERENCE", "Qualidade incompleta.");
  }
  const reasonCodes = value.reasonCodes.map((code) => enumValue(code, QUALITY_REASON_CODES, "Ressalva"));
  const warnings = value.warnings.map(parseWarning);
  uniqueWarnings(warnings);
  const warningCodes = value.warningCodes.map((code) => enumValue(code, WARNING_CODES, "Aviso"));
  if (new Set(reasonCodes).size !== reasonCodes.length || new Set(warningCodes).size !== warningCodes.length) {
    throw new PortfolioIncrementalValidationError("INVALID_REFERENCE", "Qualidade contém códigos duplicados.");
  }
  const derivedWarningCodes = [...new Set(warnings.map((warning) => warning.code))].sort();
  const suppliedWarningCodes = [...new Set(warningCodes)].sort();
  if (stableJson(derivedWarningCodes) !== stableJson(suppliedWarningCodes)) {
    throw new PortfolioIncrementalValidationError("INVALID_REFERENCE", "Códigos de aviso incompatíveis.");
  }
  return Object.freeze({
    state: enumValue(value.state, QUALITY_STATES, "Estado da qualidade"),
    reasonCodes: Object.freeze([...new Set(reasonCodes)].sort()),
    warningCodes: Object.freeze(suppliedWarningCodes),
    warnings: Object.freeze(warnings.sort((left, right) => (
      left.code.localeCompare(right.code)
      || String(left.competence ?? "").localeCompare(String(right.competence ?? ""))
    ))),
    confidence: parseConfidence(value.confidence),
    pricedPositionCount: nonNegativeInteger(value.pricedPositionCount, "Posições precificadas"),
    unpricedPositionCount: nonNegativeInteger(value.unpricedPositionCount, "Posições sem preço"),
    knownSegmentPositionCount: nonNegativeInteger(value.knownSegmentPositionCount, "Posições com segmento"),
    incomeKnownPositionCount: nonNegativeInteger(value.incomeKnownPositionCount, "Posições com renda"),
    monthsRequired: nonNegativeInteger(value.monthsRequired, "Meses exigidos"),
  });
}

export function normalizePortfolioId(value: unknown) {
  const portfolioId = String(value ?? "default").trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(portfolioId)) {
    throw new PortfolioIncrementalValidationError("INVALID_PORTFOLIO_ID", "Identificador da carteira inválido.");
  }
  return portfolioId;
}

export function createPortfolioIntelligenceReference(
  value: unknown,
  provenance: PortfolioIntelligenceReferenceProvenance = {},
): PortfolioIntelligenceReference {
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
  const signals = rawSignals.map(parseSignal).sort((left, right) => left.code.localeCompare(right.code));
  uniqueSignals(signals);

  if (!Array.isArray(value.dataQuality.reasons) || !Array.isArray(value.warnings)) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", "Qualidade ou avisos da análise inválidos.");
  }
  const rawReasons = value.dataQuality.reasons;
  const reasonCodes = rawReasons.map((reason, index) => {
    if (!isRecord(reason)) {
      throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", `Ressalva ${index + 1} inválida.`);
    }
    return enumValue(reason.code, QUALITY_REASON_CODES, `Código da ressalva ${index + 1}`);
  });
  if (new Set(reasonCodes).size !== reasonCodes.length) {
    throw new PortfolioIncrementalValidationError("INVALID_ANALYSIS", "Ressalvas de qualidade duplicadas.");
  }
  const rawWarnings = value.warnings;
  const warnings = rawWarnings.map(parseWarning).sort((left, right) => (
    left.code.localeCompare(right.code)
    || String(left.competence ?? "").localeCompare(String(right.competence ?? ""))
  ));
  uniqueWarnings(warnings);

  const largestPosition = isRecord(portfolio.largestPosition) ? portfolio.largestPosition : null;
  const largestIncomeContributor = isRecord(portfolio.largestIncomeContributor)
    ? portfolio.largestIncomeContributor
    : null;
  const metrics: PortfolioIntelligenceReferenceMetrics = Object.freeze({
    latestClosedCompetence: income.latestClosedCompetence === null
      ? null
      : competence(income.latestClosedCompetence, "Última competência encerrada"),
    latestIncome: finiteOrNull(income.latestIncome, "Última renda"),
    blockVariationPercent: finiteOrNull(income.blockVariationPercent, "Variação da renda"),
    sixMonthCoefficientOfVariationPercent: finiteOrNull(
      income.sixMonthCoefficientOfVariationPercent,
      "Coeficiente de variação da renda",
    ),
    largestPositionSharePercent: finiteOrNull(largestPosition?.sharePercent ?? null, "Participação da maior posição"),
    topThreeSharePercent: finiteOrNull(portfolio.topThreeSharePercent, "Participação das três maiores posições"),
    patrimonyHhi: finiteOrNull(portfolio.patrimonyHhi, "HHI patrimonial"),
    largestIncomeContributorTicker: largestIncomeContributor === null
      ? null
      : normalizedText(largestIncomeContributor.ticker, "Ticker da maior fonte de renda", 12),
    largestIncomeContributorSharePercent: finiteOrNull(
      largestIncomeContributor?.sharePercent ?? null,
      "Participação da maior fonte de renda",
    ),
    estimatedIncomeTotal: finiteOrNull(portfolio.estimatedIncomeTotal, "Renda estimada total"),
    patrimonyCoveragePercent: finiteOrNull(value.dataQuality.patrimonyCoveragePercent, "Cobertura patrimonial"),
    segmentCoveragePercent: finiteOrNull(value.dataQuality.segmentCoveragePercent, "Cobertura de segmentos"),
    incomeCoveragePercent: finiteOrNull(value.dataQuality.incomeCoveragePercent, "Cobertura de renda"),
    monthsAvailable: nonNegativeInteger(value.dataQuality.monthsAvailable, "Meses disponíveis"),
  });
  const confidence = parseConfidence(value.dataQuality.confidence);
  const quality = Object.freeze({
    state: enumValue(value.dataQuality.state, QUALITY_STATES, "Estado da qualidade"),
    reasonCodes: Object.freeze([...new Set(reasonCodes)].sort()),
    warningCodes: Object.freeze([...new Set(warnings.map((warning) => warning.code))].sort()),
    warnings: Object.freeze(warnings),
    confidence,
    pricedPositionCount: nonNegativeInteger(value.dataQuality.pricedPositionCount, "Posições precificadas"),
    unpricedPositionCount: nonNegativeInteger(value.dataQuality.unpricedPositionCount, "Posições sem preço"),
    knownSegmentPositionCount: nonNegativeInteger(value.dataQuality.knownSegmentPositionCount, "Posições com segmento"),
    incomeKnownPositionCount: nonNegativeInteger(value.dataQuality.incomeKnownPositionCount, "Posições com renda"),
    monthsRequired: nonNegativeInteger(value.dataQuality.monthsRequired, "Meses exigidos"),
  });
  const policyVersion = normalizedText(value.policyVersion, "Versão da política", 80);
  const dataFingerprint = provenance.dataFingerprint === undefined
    ? sha256(referenceDataContent(metrics, quality))
    : sha256Value(provenance.dataFingerprint, "Fingerprint dos dados");
  const policyFingerprint = provenance.policyFingerprint === undefined
    ? sha256({ policyVersion, monthsRequired: quality.monthsRequired })
    : sha256Value(provenance.policyFingerprint, "Fingerprint da política");
  const referenceWithoutFingerprint = Object.freeze({
    schemaVersion: PORTFOLIO_INCREMENTAL_SCHEMA_VERSION,
    dataFingerprint,
    policyFingerprint,
    domainVersion: PORTFOLIO_INCREMENTAL_POLICY_VERSION,
    policyVersion,
    signals: Object.freeze(signals),
    metrics,
    quality,
  });
  return Object.freeze({
    ...referenceWithoutFingerprint,
    fingerprint: sha256(canonicalReferenceContent(referenceWithoutFingerprint)),
    generatedAt: isoDate(value.generatedAt, "Data de geração"),
    asOf: isoDate(value.asOf, "Data-base"),
  });
}

export function sanitizePortfolioIntelligenceReference(value: unknown): PortfolioIntelligenceReference {
  try {
    if (!isRecord(value) || value.schemaVersion !== PORTFOLIO_INCREMENTAL_SCHEMA_VERSION) {
      throw new PortfolioIncrementalValidationError("INVALID_REFERENCE", "Referência incompatível.");
    }
    const rawSignals = Array.isArray(value.signals) ? value.signals : null;
    if (!rawSignals || rawSignals.length > 20) {
      throw new PortfolioIncrementalValidationError("INVALID_REFERENCE", "Sinais inválidos.");
    }
    const signals = rawSignals.map(parseSignal).sort((left, right) => left.code.localeCompare(right.code));
    uniqueSignals(signals);
    const metrics = parseReferenceMetrics(value.metrics);
    const quality = parseReferenceQuality(value.quality);
    const referenceWithoutFingerprint = Object.freeze({
      schemaVersion: PORTFOLIO_INCREMENTAL_SCHEMA_VERSION,
      dataFingerprint: sha256Value(value.dataFingerprint, "Fingerprint dos dados"),
      policyFingerprint: sha256Value(value.policyFingerprint, "Fingerprint da política"),
      domainVersion: normalizedText(value.domainVersion, "Versão do domínio incremental", 80),
      policyVersion: normalizedText(value.policyVersion, "Versão da política", 80),
      signals: Object.freeze(signals),
      metrics,
      quality,
    });
    const expectedFingerprint = sha256(canonicalReferenceContent(referenceWithoutFingerprint));
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

function confidenceRank(value: PortfolioIntelligenceConfidence) {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
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
  if (config.before === config.after) return null;
  if (config.before === null || config.after === null) {
    const becameAvailable = config.after !== null;
    return change(previous, current, {
      category: "quality",
      state: becameAvailable ? "reduced" : "aggravated",
      code: `${config.code}_AVAILABILITY`,
      title: `${config.title}: disponibilidade mudou`,
      summary: becameAvailable
        ? "O dado passou a estar disponível; isso representa recuperação de qualidade, não melhora financeira automática."
        : "O dado deixou de estar disponível; isso representa perda de qualidade, não melhora financeira.",
      material: true,
      before: config.before,
      after: config.after,
      threshold: "mudança entre ausente e número conhecido",
    });
  }
  const involvesZero = config.before === 0 || config.after === 0;
  const delta = config.thresholdMode === "relative" && !involvesZero
    ? ((config.after - config.before) / Math.abs(config.before)) * 100
    : config.after - config.before;
  if (!involvesZero && Math.abs(delta) < config.threshold) return null;
  return change(previous, current, {
    category: "data",
    state: stateFromDirection(config.before, config.after, config.higherIsWorse),
    code: config.code,
    title: config.title,
    summary: config.summary,
    material: true,
    before: config.before,
    after: config.after,
    threshold: involvesZero && config.thresholdMode === "relative"
      ? "transição envolvendo base zero"
      : config.thresholdMode === "relative"
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

function coverageCountChange(
  previous: PortfolioIntelligenceReference,
  current: PortfolioIntelligenceReference,
  input: Readonly<{
    code: string;
    title: string;
    before: number;
    after: number;
    higherIsWorse: boolean;
  }>,
) {
  if (input.before === input.after) return null;
  return change(previous, current, {
    category: "coverage",
    state: stateFromDirection(input.before, input.after, input.higherIsWorse),
    code: input.code,
    title: input.title,
    summary: stateFromDirection(input.before, input.after, input.higherIsWorse) === "aggravated"
      ? "A quantidade de dados utilizáveis diminuiu ou a lacuna de cobertura aumentou."
      : "A quantidade de dados utilizáveis aumentou ou a lacuna de cobertura diminuiu.",
    material: true,
    before: input.before,
    after: input.after,
    threshold: "uma posição",
  });
}

function confidenceDimensionForSignal(code: PortfolioIntelligenceSignalCode): ConfidenceDimension | null {
  if ([
    "RENDA_EM_ALTA",
    "RENDA_EM_QUEDA",
    "RENDA_ESTAVEL",
    "RENDA_INSTAVEL",
    "MES_ATIPICO_POSITIVO",
    "MES_ATIPICO_NEGATIVO",
  ].includes(code)) return "trend";
  if (code === "CONCENTRACAO_ELEVADA") return "concentration";
  if (code === "CONCENTRACAO_POR_SEGMENTO") return "segments";
  if (code === "DEPENDENCIA_DE_UM_FUNDO") return "income";
  return null;
}

function currentQualityCanResolveSignal(
  current: PortfolioIntelligenceReference,
  code: PortfolioIntelligenceSignalCode,
) {
  if (code === "DADOS_INSUFICIENTES") return current.quality.state === "sufficient";
  const dimension = confidenceDimensionForSignal(code);
  return current.quality.state !== "insufficient"
    && (!dimension || current.quality.confidence[dimension] !== "low");
}

function warningKey(warning: PortfolioIntelligenceReferenceWarning) {
  return `${warning.code}:${warning.competence ?? "-"}`;
}

function warningChangeCode(warning: PortfolioIntelligenceReferenceWarning) {
  return `WARNING_${warning.code}_${(warning.competence ?? "NO_COMPETENCE").replace("-", "_")}`;
}

function warningCategory(code: PortfolioIntelligenceWarningCode): PortfolioIncrementalCategory {
  return [
    "CURRENT_COMPETENCE_IGNORED",
    "FUTURE_COMPETENCE_IGNORED",
    "PATRIMONY_COVERAGE_UNDETERMINED",
    "INCOME_COVERAGE_INSUFFICIENT",
    "SEGMENT_COVERAGE_INSUFFICIENT",
  ].includes(code) ? "coverage" : "quality";
}

export function assertUniquePortfolioIncrementalChanges(
  changes: readonly Readonly<{ id: string; code: string }>[],
) {
  const ids = new Set<string>();
  const codes = new Set<string>();
  for (const item of changes) {
    if (ids.has(item.id) || codes.has(item.code)) {
      throw new PortfolioIncrementalValidationError(
        "DUPLICATE_CHANGE",
        "A comparação incremental produziu mudanças duplicadas.",
      );
    }
    ids.add(item.id);
    codes.add(item.code);
  }
}

function comparisonResult(
  previous: PortfolioIntelligenceReference | null,
  current: PortfolioIntelligenceReference,
  changes: readonly PortfolioIncrementalChange[],
  unchangedSignalCodes: readonly PortfolioIntelligenceSignalCode[],
): PortfolioIncrementalComparison {
  assertUniquePortfolioIncrementalChanges(changes);
  const ordered = Object.freeze([...changes].sort((left, right) => (
    Number(right.material) - Number(left.material)
    || CHANGE_CATEGORY_ORDER.indexOf(left.category) - CHANGE_CATEGORY_ORDER.indexOf(right.category)
    || left.code.localeCompare(right.code)
  )));
  const materialChanges = Object.freeze(ordered.filter((item) => item.material));
  const status: PortfolioIncrementalStatus = previous === null
    ? "baseline"
    : materialChanges.length > 0
      ? "changed"
      : "unchanged";
  const message = previous === null
    ? "Esta é a primeira análise válida. Ela foi salva como referência para a próxima comparação."
    : status === "changed"
      ? `${materialChanges.length} mudança${materialChanges.length === 1 ? " material" : "s materiais"} desde a análise anterior.`
      : "Nenhuma mudança material foi identificada desde a análise anterior.";
  const uniqueUnchangedSignals = Object.freeze([...new Set(unchangedSignalCodes)].sort());
  return Object.freeze({
    schemaVersion: PORTFOLIO_INCREMENTAL_SCHEMA_VERSION,
    policyVersion: PORTFOLIO_INCREMENTAL_POLICY_VERSION,
    comparisonId: sha256({
      schemaVersion: PORTFOLIO_INCREMENTAL_SCHEMA_VERSION,
      previous: previous === null
        ? null
        : { fingerprint: previous.fingerprint, asOf: previous.asOf },
      current: { fingerprint: current.fingerprint, asOf: current.asOf },
    }),
    status,
    previous,
    current,
    changes: ordered,
    materialChanges,
    unchangedSignalCodes: uniqueUnchangedSignals,
    summary: Object.freeze({
      materialChangeCount: materialChanges.length,
      totalChangeCount: ordered.length,
      unchangedSignalCount: uniqueUnchangedSignals.length,
      message,
    }),
  });
}

export function comparePortfolioIntelligenceReferences(
  previousValue: PortfolioIntelligenceReference | null,
  currentValue: PortfolioIntelligenceReference,
): PortfolioIncrementalComparison {
  const current = sanitizePortfolioIntelligenceReference(currentValue);
  if (!previousValue) return comparisonResult(null, current, [], []);
  const previous = sanitizePortfolioIntelligenceReference(previousValue);
  const changes: PortfolioIncrementalChange[] = [];
  const unchangedSignalCodes: PortfolioIntelligenceSignalCode[] = [];
  const domainChanged = previous.domainVersion !== current.domainVersion;
  const policyChanged = domainChanged
    || previous.policyVersion !== current.policyVersion
    || previous.policyFingerprint !== current.policyFingerprint;
  const dataChanged = previous.dataFingerprint !== current.dataFingerprint;

  if (policyChanged) {
    const versionChanged = previous.policyVersion !== current.policyVersion;
    const code = domainChanged
      ? "DOMAIN_VERSION_CHANGED"
      : versionChanged
        ? "POLICY_VERSION_CHANGED"
        : "POLICY_FINGERPRINT_CHANGED";
    changes.push(change(previous, current, {
      category: "rule",
      state: "new",
      code,
      title: "A regra de análise mudou",
      summary: "A mudança de metodologia foi separada das mudanças da carteira para evitar uma interpretação financeira incorreta.",
      material: true,
      before: domainChanged
        ? previous.domainVersion
        : versionChanged
          ? previous.policyVersion
          : previous.policyFingerprint,
      after: domainChanged
        ? current.domainVersion
        : versionChanged
          ? current.policyVersion
          : current.policyFingerprint,
      threshold: domainChanged
        ? "qualquer mudança da versão do domínio incremental"
        : versionChanged
          ? "qualquer mudança de versão da política financeira"
          : "qualquer mudança da política canônica",
    }));
  }

  if (policyChanged && !dataChanged) {
    const currentSignals = new Map(current.signals.map((signal) => [signal.code, signal]));
    for (const signal of previous.signals) {
      const currentSignal = currentSignals.get(signal.code);
      if (currentSignal && stableJson(signal) === stableJson(currentSignal)) {
        unchangedSignalCodes.push(signal.code);
      }
    }
    return comparisonResult(previous, current, changes, unchangedSignalCodes);
  }

  const previousSignals = new Map(previous.signals.map((signal) => [signal.code, signal]));
  const currentSignals = new Map(current.signals.map((signal) => [signal.code, signal]));
  for (const code of [...new Set([...previousSignals.keys(), ...currentSignals.keys()])].sort()) {
    const before = previousSignals.get(code);
    const after = currentSignals.get(code);
    const normalCategory: PortfolioIncrementalCategory = code === "DADOS_INSUFICIENTES" ? "quality" : "data";
    const category = policyChanged ? "rule" : normalCategory;
    if (!before && after) {
      changes.push(change(previous, current, {
        category,
        state: "new",
        code: `SIGNAL_${code}`,
        title: after.title,
        summary: policyChanged
          ? "O sinal passou a ser emitido em uma comparação que também mudou de metodologia."
          : `Novo sinal material: ${after.summary}`,
        material: true,
        before: null,
        after: after.severity,
        threshold: "entrada de sinal",
      }));
      continue;
    }
    if (before && !after) {
      if (policyChanged) {
        changes.push(change(previous, current, {
          category: "rule",
          state: "new",
          code: `SIGNAL_${code}`,
          title: before.title,
          summary: "O sinal deixou de ser emitido em uma comparação que também mudou de metodologia; não foi classificado como risco resolvido.",
          material: true,
          before: before.severity,
          after: null,
          threshold: "saída de sinal com mudança de regra",
        }));
      } else if (!currentQualityCanResolveSignal(current, code)) {
        changes.push(change(previous, current, {
          category: "quality",
          state: "aggravated",
          code: `SIGNAL_${code}`,
          title: `Não foi possível confirmar a resolução: ${before.title}`,
          summary: "O sinal desapareceu quando a qualidade atual ficou insuficiente; isso não comprova que a condição financeira foi resolvida.",
          material: true,
          before: before.severity,
          after: null,
          threshold: "saída de sinal sem qualidade suficiente para resolução",
        }));
      } else {
        changes.push(change(previous, current, {
          category,
          state: "resolved",
          code: `SIGNAL_${code}`,
          title: before.title,
          summary: "O sinal deixou de ser emitido e a análise atual possui qualidade suficiente para confirmar a resolução.",
          material: true,
          before: before.severity,
          after: null,
          threshold: "saída de sinal com qualidade suficiente",
        }));
      }
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
        summary: policyChanged
          ? "A severidade mudou em uma comparação que também mudou de metodologia."
          : state === "aggravated"
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
        summary: policyChanged
          ? "As evidências mudaram em uma comparação que também mudou de metodologia."
          : "O sinal permaneceu na mesma severidade, mas suas evidências ou confiança foram atualizadas.",
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

  for (const dimension of CONFIDENCE_DIMENSIONS) {
    const before = previous.quality.confidence[dimension];
    const after = current.quality.confidence[dimension];
    if (before === after) continue;
    changes.push(change(previous, current, {
      category: "quality",
      state: confidenceRank(after) < confidenceRank(before) ? "aggravated" : "reduced",
      code: `QUALITY_CONFIDENCE_${dimension.toUpperCase()}`,
      title: `A confiança de ${dimension} mudou`,
      summary: confidenceRank(after) < confidenceRank(before)
        ? "A confiança dos dados desta dimensão diminuiu."
        : "A confiança dos dados desta dimensão aumentou.",
      material: true,
      before,
      after,
      threshold: "mudança de nível de confiança",
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

  const previousWarnings = new Map(previous.quality.warnings.map((warning) => [warningKey(warning), warning]));
  const currentWarnings = new Map(current.quality.warnings.map((warning) => [warningKey(warning), warning]));
  for (const key of [...new Set([...previousWarnings.keys(), ...currentWarnings.keys()])].sort()) {
    const before = previousWarnings.get(key);
    const after = currentWarnings.get(key);
    const warning = after ?? before;
    if (!warning) continue;
    if (!before && after) {
      changes.push(change(previous, current, {
        category: warningCategory(after.code),
        state: "aggravated",
        code: warningChangeCode(after),
        title: "Novo aviso de qualidade dos dados",
        summary: `O aviso ${after.code} passou a ser emitido${after.competence ? ` para ${after.competence}` : ""}.`,
        material: true,
        before: null,
        after: after.competence ?? after.code,
        threshold: "entrada de aviso",
      }));
    } else if (before && !after) {
      const canConfirmRemoval = current.quality.state !== "insufficient";
      changes.push(change(previous, current, {
        category: warningCategory(before.code),
        state: canConfirmRemoval ? "resolved" : "aggravated",
        code: warningChangeCode(before),
        title: canConfirmRemoval ? "Aviso de qualidade removido" : "A remoção do aviso não pôde ser confirmada",
        summary: canConfirmRemoval
          ? `O aviso ${before.code} deixou de ser emitido${before.competence ? ` para ${before.competence}` : ""}.`
          : `O aviso ${before.code} desapareceu enquanto a qualidade atual é insuficiente; isso não comprova resolução.`,
        material: true,
        before: before.competence ?? before.code,
        after: null,
        threshold: canConfirmRemoval ? "saída de aviso" : "saída de aviso sem qualidade suficiente",
      }));
    }
  }

  const coverageChanges = [
    coverageMetricChange(previous, current, "PATRIMONY_COVERAGE", "Cobertura patrimonial mudou", previous.metrics.patrimonyCoveragePercent, current.metrics.patrimonyCoveragePercent),
    coverageMetricChange(previous, current, "SEGMENT_COVERAGE", "Cobertura de segmentos mudou", previous.metrics.segmentCoveragePercent, current.metrics.segmentCoveragePercent),
    coverageMetricChange(previous, current, "INCOME_COVERAGE", "Cobertura de renda mudou", previous.metrics.incomeCoveragePercent, current.metrics.incomeCoveragePercent),
  ].filter((item): item is PortfolioIncrementalChange => Boolean(item));
  changes.push(...coverageChanges);

  const coverageCountChanges = [
    coverageCountChange(previous, current, {
      code: "PRICED_POSITION_COUNT",
      title: "A quantidade de posições precificadas mudou",
      before: previous.quality.pricedPositionCount,
      after: current.quality.pricedPositionCount,
      higherIsWorse: false,
    }),
    coverageCountChange(previous, current, {
      code: "UNPRICED_POSITION_COUNT",
      title: "A quantidade de posições sem preço mudou",
      before: previous.quality.unpricedPositionCount,
      after: current.quality.unpricedPositionCount,
      higherIsWorse: true,
    }),
    coverageCountChange(previous, current, {
      code: "KNOWN_SEGMENT_POSITION_COUNT",
      title: "A quantidade de posições com segmento conhecido mudou",
      before: previous.quality.knownSegmentPositionCount,
      after: current.quality.knownSegmentPositionCount,
      higherIsWorse: false,
    }),
    coverageCountChange(previous, current, {
      code: "INCOME_KNOWN_POSITION_COUNT",
      title: "A quantidade de posições com renda conhecida mudou",
      before: previous.quality.incomeKnownPositionCount,
      after: current.quality.incomeKnownPositionCount,
      higherIsWorse: false,
    }),
  ].filter((item): item is PortfolioIncrementalChange => Boolean(item));
  changes.push(...coverageCountChanges);

  if (previous.metrics.latestClosedCompetence !== current.metrics.latestClosedCompetence) {
    const before = previous.metrics.latestClosedCompetence;
    const after = current.metrics.latestClosedCompetence;
    const state: PortfolioIncrementalChangeState = after === null
      ? "aggravated"
      : before === null
        ? "reduced"
        : after > before
          ? "new"
          : "aggravated";
    changes.push(change(previous, current, {
      category: "coverage",
      state,
      code: "LATEST_CLOSED_COMPETENCE_CHANGED",
      title: "A última competência encerrada mudou",
      summary: after === null
        ? "A análise atual perdeu a competência encerrada de referência."
        : before === null
          ? "A análise atual passou a ter uma competência encerrada de referência."
          : after > before
            ? "A análise avançou para uma competência encerrada mais recente."
            : "A análise recuou para uma competência anterior; isso indica perda de cobertura.",
      material: true,
      before,
      after,
      threshold: "mudança de competência encerrada",
    }));
  }

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

  const previousTicker = previous.metrics.largestIncomeContributorTicker;
  const currentTicker = current.metrics.largestIncomeContributorTicker;
  if (previousTicker !== currentTicker) {
    if (previousTicker === null || currentTicker === null) {
      changes.push(change(previous, current, {
        category: "quality",
        state: currentTicker === null ? "aggravated" : "reduced",
        code: "LARGEST_INCOME_CONTRIBUTOR_AVAILABILITY",
        title: "A disponibilidade da principal fonte de renda mudou",
        summary: currentTicker === null
          ? "A principal fonte de renda deixou de ser determinável; isso representa perda de qualidade."
          : "A principal fonte de renda passou a ser determinável; isso representa recuperação de qualidade.",
        material: true,
        before: previousTicker,
        after: currentTicker,
        threshold: "mudança entre ausente e identificado",
      }));
    } else {
      changes.push(change(previous, current, {
        category: "data",
        state: "new",
        code: "LARGEST_INCOME_CONTRIBUTOR_CHANGED",
        title: "A principal fonte de renda estimada mudou",
        summary: "Outro fundo passou a representar a maior parcela da renda estimada da carteira.",
        material: true,
        before: previousTicker,
        after: currentTicker,
        threshold: "mudança de liderança",
      }));
    }
  }

  if (dataChanged && !changes.some((item) => item.category !== "rule")) {
    changes.push(change(previous, current, {
      category: "data",
      state: "new",
      code: "DATA_FINGERPRINT_CHANGED",
      title: "Os dados canônicos da análise mudaram",
      summary: "A proveniência registra uma mudança de dados que não alterou as métricas mínimas desta referência.",
      material: false,
      before: previous.dataFingerprint,
      after: current.dataFingerprint,
      threshold: "auditável; materialidade depende das métricas e regras explícitas",
    }));
  }

  return comparisonResult(previous, current, changes, unchangedSignalCodes);
}

export function referenceFromResult(
  result: PortfolioIntelligenceResult,
  provenance?: PortfolioIntelligenceReferenceProvenance,
) {
  return createPortfolioIntelligenceReference(result, provenance);
}
