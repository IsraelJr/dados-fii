import type { PortfolioExplanationMetadata } from "./PortfolioIntelligenceExplanation";
import type {
  PortfolioIncrementalCategory,
  PortfolioIncrementalChangeState,
  PortfolioIncrementalComparison,
  PortfolioIncrementalValue,
} from "./PortfolioIntelligenceIncremental";

export const PORTFOLIO_INCREMENTAL_EXPLANATION_VERSION = "1.0.0";
export const PORTFOLIO_INCREMENTAL_EXPLANATION_PROMPT_VERSION = "portfolio-incremental-explanation-v1";
export const PORTFOLIO_INCREMENTAL_EXPLANATION_MAX_CHANGES = 6;
export const PORTFOLIO_INCREMENTAL_EXPLANATION_DISCLAIMER = "Explicação informativa de mudanças já calculadas. Não é recomendação de compra, venda, manutenção ou aporte.";

const CATEGORIES: readonly PortfolioIncrementalCategory[] = ["data", "rule", "coverage", "quality"];
const STATES: readonly PortfolioIncrementalChangeState[] = ["new", "aggravated", "reduced", "resolved", "unchanged"];

export type PortfolioIncrementalExplanationInput = Readonly<{
  comparisonPolicyVersion: string;
  previousAsOf: string;
  currentAsOf: string;
  deterministicFieldsAreImmutable: true;
  changes: readonly Readonly<{
    id: string;
    category: PortfolioIncrementalCategory;
    state: PortfolioIncrementalChangeState;
    code: string;
    title: string;
    summary: string;
    before: PortfolioIncrementalValue;
    after: PortfolioIncrementalValue;
    threshold: string | null;
  }>[];
}>;

export type PortfolioIncrementalChangeExplanation = Readonly<{
  id: string;
  title: string;
  explanation: string;
  whyItMatters: string;
}>;

export type PortfolioIncrementalExplanation = Readonly<{
  version: typeof PORTFOLIO_INCREMENTAL_EXPLANATION_VERSION;
  source: "ai" | "deterministic-fallback";
  summary: string;
  changeExplanations: readonly PortfolioIncrementalChangeExplanation[];
  limitations: readonly string[];
  disclaimer: typeof PORTFOLIO_INCREMENTAL_EXPLANATION_DISCLAIMER;
  metadata: PortfolioExplanationMetadata | null;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") throw new Error(`${field} inválido.`);
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`${field} inválido.`);
  return normalized;
}

function isoDate(value: unknown, field: string) {
  const normalized = text(value, field, 48);
  if (!Number.isFinite(Date.parse(normalized))) throw new Error(`${field} inválido.`);
  return normalized;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${field} inválido.`);
  return value as T;
}

function primitive(value: unknown, field: string): PortfolioIncrementalValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${field} inválido.`);
    return value;
  }
  if (typeof value === "string") return text(value, field, 240);
  throw new Error(`${field} inválido.`);
}

export function sanitizePortfolioIncrementalExplanationInput(value: unknown): PortfolioIncrementalExplanationInput {
  if (!isRecord(value) || !isRecord(value.current) || !isRecord(value.previous)) {
    throw new Error("Comparação incremental inválida.");
  }
  const rawChanges = Array.isArray(value.materialChanges) ? value.materialChanges : null;
  if (!rawChanges || rawChanges.length === 0 || rawChanges.length > 12) {
    throw new Error("Mudanças materiais inválidas.");
  }
  const ids = new Set<string>();
  const changes = rawChanges.slice(0, PORTFOLIO_INCREMENTAL_EXPLANATION_MAX_CHANGES).map((raw, index) => {
    if (!isRecord(raw) || !isRecord(raw.evidence)) throw new Error(`Mudança ${index + 1} inválida.`);
    const id = text(raw.id, `Identificador da mudança ${index + 1}`, 180);
    if (ids.has(id)) throw new Error(`Mudança duplicada: ${id}.`);
    ids.add(id);
    return Object.freeze({
      id,
      category: enumValue(raw.category, CATEGORIES, `Categoria da mudança ${id}`),
      state: enumValue(raw.state, STATES, `Estado da mudança ${id}`),
      code: text(raw.code, `Código da mudança ${id}`, 160),
      title: text(raw.title, `Título da mudança ${id}`, 240),
      summary: text(raw.summary, `Resumo da mudança ${id}`, 900),
      before: primitive(raw.before, `Valor anterior ${id}`),
      after: primitive(raw.after, `Valor atual ${id}`),
      threshold: raw.evidence.threshold === null
        ? null
        : text(raw.evidence.threshold, `Limiar da mudança ${id}`, 180),
    });
  });

  return Object.freeze({
    comparisonPolicyVersion: text(value.policyVersion, "Versão da política incremental", 80),
    previousAsOf: isoDate(value.previous.asOf, "Data-base anterior"),
    currentAsOf: isoDate(value.current.asOf, "Data-base atual"),
    deterministicFieldsAreImmutable: true,
    changes: Object.freeze(changes),
  });
}

export function buildPortfolioIncrementalExplanationInput(
  comparison: PortfolioIncrementalComparison,
): PortfolioIncrementalExplanationInput {
  return sanitizePortfolioIncrementalExplanationInput(comparison);
}

function whyItMatters(category: PortfolioIncrementalCategory) {
  const messages: Record<PortfolioIncrementalCategory, string> = {
    data: "Ajuda a distinguir uma alteração real da carteira de uma simples repetição do relatório anterior.",
    rule: "Evita tratar uma mudança metodológica como se fosse uma mudança financeira da carteira.",
    coverage: "Mostra se a comparação atual passou a usar mais ou menos informação confiável.",
    quality: "Explicita limitações dos dados antes de transformar ausência ou inconsistência em conclusão.",
  };
  return messages[category];
}

export function buildDeterministicPortfolioIncrementalExplanation(
  input: PortfolioIncrementalExplanationInput,
): PortfolioIncrementalExplanation {
  return Object.freeze({
    version: PORTFOLIO_INCREMENTAL_EXPLANATION_VERSION,
    source: "deterministic-fallback",
    summary: "As mudanças abaixo já foram determinadas pela política incremental. Esta explicação apenas traduz o significado delas.",
    changeExplanations: Object.freeze(input.changes.map((change) => Object.freeze({
      id: change.id,
      title: change.title,
      explanation: change.summary,
      whyItMatters: whyItMatters(change.category),
    }))),
    limitations: Object.freeze([
      "A explicação não recalcula valores, severidades, categorias ou materialidade.",
      "A comparação depende das duas referências válidas e das respectivas coberturas de dados.",
    ]),
    disclaimer: PORTFOLIO_INCREMENTAL_EXPLANATION_DISCLAIMER,
    metadata: null,
  });
}

function hasDigits(value: string) {
  return /\d/.test(value);
}

function hasRecommendation(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(?:recomendo|recomendamos|deve|deveria|considere|hora de)\s+(?:comprar|vender|manter|aportar)\b/.test(normalized)
    || /\b(?:compre|venda|mantenha|aporte)\b/.test(normalized);
}

export function normalizePortfolioIncrementalExplanationOutput(
  value: unknown,
  input: PortfolioIncrementalExplanationInput,
  metadata: PortfolioExplanationMetadata,
): PortfolioIncrementalExplanation {
  if (!isRecord(value)) throw new Error("Saída incremental inválida.");
  const summary = text(value.summary, "Resumo incremental", 1000);
  const rawItems = Array.isArray(value.changeExplanations) ? value.changeExplanations : null;
  if (!rawItems || rawItems.length === 0 || rawItems.length > input.changes.length) {
    throw new Error("Explicações de mudanças inválidas.");
  }
  const expected = new Map(input.changes.map((change) => [change.id, change]));
  const seen = new Set<string>();
  const items = rawItems.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`Explicação ${index + 1} inválida.`);
    const id = text(raw.id, `Identificador da explicação ${index + 1}`, 180);
    const original = expected.get(id);
    if (!original || seen.has(id)) throw new Error(`Identificador incompatível: ${id}.`);
    seen.add(id);
    return Object.freeze({
      id,
      title: original.title,
      explanation: text(raw.explanation, `Explicação ${id}`, 800),
      whyItMatters: text(raw.whyItMatters, `Importância ${id}`, 600),
    });
  });
  const rawLimitations = Array.isArray(value.limitations) ? value.limitations : null;
  if (!rawLimitations || rawLimitations.length === 0 || rawLimitations.length > 6) {
    throw new Error("Limitações inválidas.");
  }
  const limitations = rawLimitations.map((item, index) => text(item, `Limitação ${index + 1}`, 400));
  const narrative = [summary, ...items.flatMap((item) => [item.explanation, item.whyItMatters]), ...limitations].join(" ");
  if (hasDigits(narrative)) throw new Error("A IA introduziu números e foi rejeitada.");
  if (hasRecommendation(narrative)) throw new Error("A IA introduziu recomendação e foi rejeitada.");

  return Object.freeze({
    version: PORTFOLIO_INCREMENTAL_EXPLANATION_VERSION,
    source: "ai",
    summary,
    changeExplanations: Object.freeze(items),
    limitations: Object.freeze(limitations),
    disclaimer: PORTFOLIO_INCREMENTAL_EXPLANATION_DISCLAIMER,
    metadata,
  });
}
