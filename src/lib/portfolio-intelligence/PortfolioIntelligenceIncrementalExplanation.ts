import type { PortfolioExplanationMetadata } from "./PortfolioIntelligenceExplanation";
import type {
  PortfolioIncrementalCategory,
  PortfolioIncrementalChangeState,
  PortfolioIncrementalComparison,
  PortfolioIncrementalValue,
} from "./PortfolioIntelligenceIncremental";

export const PORTFOLIO_INCREMENTAL_EXPLANATION_VERSION = "1.0.0";
export const PORTFOLIO_INCREMENTAL_EXPLANATION_PROMPT_VERSION = "portfolio-incremental-explanation-v3";
export const PORTFOLIO_INCREMENTAL_EXPLANATION_MAX_CHANGES = 6;
export const PORTFOLIO_INCREMENTAL_EXPLANATION_DISCLAIMER = "Explicação informativa de mudanças já calculadas. Não é recomendação de compra, venda, manutenção ou aporte.";

const CATEGORIES: readonly PortfolioIncrementalCategory[] = ["data", "rule", "coverage", "quality"];
const STATES: readonly PortfolioIncrementalChangeState[] = ["new", "aggravated", "reduced", "resolved", "unchanged"];
const CHANGE_SELECTION_ORDER: readonly PortfolioIncrementalCategory[] = ["rule", "quality", "coverage", "data"];

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

function stableTextOrder(left: string, right: string) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function sanitizePortfolioIncrementalExplanationInput(value: unknown): PortfolioIncrementalExplanationInput {
  if (!isRecord(value) || !isRecord(value.current) || !isRecord(value.previous)) {
    throw new Error("Comparação incremental inválida.");
  }
  const rawChanges = Array.isArray(value.materialChanges) ? value.materialChanges : null;
  if (!rawChanges || rawChanges.length === 0) {
    throw new Error("Mudanças materiais inválidas.");
  }
  const ids = new Set<string>();
  const codes = new Set<string>();
  const validatedChanges = rawChanges.map((raw, index) => {
    if (!isRecord(raw) || !isRecord(raw.evidence)) throw new Error(`Mudança ${index + 1} inválida.`);
    const id = text(raw.id, `Identificador da mudança ${index + 1}`, 180);
    if (ids.has(id)) throw new Error(`Mudança duplicada: ${id}.`);
    ids.add(id);
    const code = text(raw.code, `Código da mudança ${id}`, 160);
    if (codes.has(code)) throw new Error(`Código de mudança duplicado: ${code}.`);
    codes.add(code);
    return Object.freeze({
      id,
      category: enumValue(raw.category, CATEGORIES, `Categoria da mudança ${id}`),
      state: enumValue(raw.state, STATES, `Estado da mudança ${id}`),
      code,
      title: text(raw.title, `Título da mudança ${id}`, 240),
      summary: text(raw.summary, `Resumo da mudança ${id}`, 900),
      before: primitive(raw.before, `Valor anterior ${id}`),
      after: primitive(raw.after, `Valor atual ${id}`),
      threshold: raw.evidence.threshold === null
        ? null
        : text(raw.evidence.threshold, `Limiar da mudança ${id}`, 180),
    });
  });
  const changes = [...validatedChanges]
    .sort((left, right) => (
      CHANGE_SELECTION_ORDER.indexOf(left.category) - CHANGE_SELECTION_ORDER.indexOf(right.category)
      || stableTextOrder(left.code, right.code)
      || stableTextOrder(left.id, right.id)
    ))
    .slice(0, PORTFOLIO_INCREMENTAL_EXPLANATION_MAX_CHANGES);

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

function normalizeGuardText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‐‑‒–—−/]/g, " ")
    .replace(/[^a-zA-Z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hasQuantitativeLanguage(value: string) {
  if (/\p{Number}/u.test(value)) return true;
  const normalized = normalizeGuardText(value);
  const unambiguousNumberWord = /\b(?:zero|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezasseis|dezessete|dezassete|dezoito|dezenove|dezanove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzentos|duzentas|trezentos|trezentas|quatrocentos|quatrocentas|quinhentos|quinhentas|seiscentos|seiscentas|setecentos|setecentas|oitocentos|oitocentas|novecentos|novecentas|mil|milhar|milhares|milhao|milhoes|bilhao|bilhoes|trilhao|trilhoes)\b/;
  const explicitOne = /\b(?:um|uma)\s+(?:vez|vezes|terco|quarto|dezena|centena|duzia|milhar|milhao|bilhao|trilhao|real|reais|centavo|centavos|cota|cotas|unidade|unidades|ponto|pontos|por\s+cento)\b/;
  const multiplier = /\b(?:duplo|dupla|dobro|dobra|dobram|dobrou|dobrar|dobrado|dobrada|dobrados|dobradas|dobrando|dobraria|dobrariam|duplicacao|duplica|duplicam|duplicou|duplicar|duplicado|duplicada|duplicados|duplicadas|duplicando|duplicaria|duplicariam|triplo|tripla|triplicacao|triplica|triplicam|triplicou|triplicar|triplicado|triplicada|triplicados|triplicadas|triplicando|triplicaria|triplicariam|quadruplo|quadrupla|quadruplicacao|quadruplica|quadruplicam|quadruplicou|quadruplicar|quadruplicado|quadruplicada|quadruplicados|quadruplicadas|quadruplicando|quadruplicaria|quadruplicariam|metade)\b/;
  return unambiguousNumberWord.test(normalized)
    || explicitOne.test(normalized)
    || multiplier.test(normalized);
}

function hasRecommendation(value: string) {
  const normalized = normalizeGuardText(value);
  const imperative = /\b(?:compre|comprem|venda|vendam|mantenha|mantenham|aporte|aportem|invista|invistam|reinvista|reinvistam|desinvista|desinvistam|aumente|aumentem|reduza|reduzam|diminua|diminuam|eleve|elevem|reforce|reforcem|zere|zerem|liquide|liquidem|troque|troquem|substitua|substituam|saia|saiam|prefira|prefiram|evite|evitem|desfaca\s+se|desfacam\s+se|se\s+desfaca|se\s+desfacam)\b/;
  const recommendationLead = /\b(?:recomendo|recomendamos|recomenda|deve|devem|deveria|deveriam|considere|considerem|hora\s+de|vale\s+a\s+pena|e\s+melhor|seria\s+melhor)(?:\s+[a-z]+){0,4}\s+(?:comprar|vender|manter|aportar|investir|reinvestir|desinvestir|aumentar|reduzir|diminuir|elevar|reforcar|zerar|liquidar|trocar|substituir|realocar|sair|desfazer\s+se|se\s+desfazer)\b/;
  const nominalRecommendation = /\b(?:recomendacao|orientacao|sugestao)(?:\s+[a-z]+){0,4}\s+(?:compra|venda|manutencao|aporte|investimento|desinvestimento|aumento|reducao|liquidacao)\b/;
  const targetedAction = /\b(?:comprar|vender|manter|aportar|investir|reinvestir|desinvestir|aumentar|reduzir|diminuir|elevar|reforcar|zerar|liquidar|trocar|substituir|realocar|sair|desfazer\s+se|se\s+desfazer)(?:\s+[a-z]+){0,4}\s+(?:fundo|fundos|ativo|ativos|cota|cotas|posicao|posicoes|alocacao|exposicao|participacao|carteira)\b/;
  const transactionCommand = /\b(?:faca|facam|realize|realizem)(?:\s+[a-z]+){0,2}\s+(?:aporte|aportes|compra|compras|venda|vendas|investimento|investimentos|desinvestimento|desinvestimentos)\b/;
  const allocationGuidance = /\b(?:diversifique|diversifiquem|diversificar|rebalanceie|rebalanceiem|rebalancear|realoque|realocarem|realocar|equilibre|equilibrem|equilibrar|desconcentre|desconcentrem|desconcentrar)\b/;
  const prudentGuidance = /\b(?:busque|busquem|convem|prudente|aconselhavel|indicado|sugiro|sugerimos)(?:\s+[a-z]+){0,5}\s+(?:diversificar|rebalancear|realocar|equilibrar|reduzir|aumentar|diminuir|elevar|concentrar|desconcentrar|investir|desinvestir)\b/;
  return imperative.test(normalized)
    || recommendationLead.test(normalized)
    || nominalRecommendation.test(normalized)
    || targetedAction.test(normalized)
    || transactionCommand.test(normalized)
    || allocationGuidance.test(normalized)
    || prudentGuidance.test(normalized);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length
    && actual.every((key, index) => key === canonical[index]);
}

function unsupportedNarrative(value: Record<string, unknown>) {
  const parts: string[] = [];
  for (const key of ["summary", "explanation", "whyItMatters", "narrative", "recommendation"]) {
    if (typeof value[key] === "string") parts.push(value[key]);
  }
  if (Array.isArray(value.limitations)) {
    parts.push(...value.limitations.filter((item): item is string => typeof item === "string"));
  }
  if (Array.isArray(value.changeExplanations)) {
    for (const item of value.changeExplanations) {
      if (!isRecord(item)) continue;
      for (const key of ["explanation", "whyItMatters", "narrative", "recommendation"]) {
        if (typeof item[key] === "string") parts.push(item[key]);
      }
    }
  }
  return parts.join(" ");
}

export function normalizePortfolioIncrementalExplanationOutput(
  value: unknown,
  input: PortfolioIncrementalExplanationInput,
  metadata: PortfolioExplanationMetadata,
): PortfolioIncrementalExplanation {
  if (!isRecord(value)) throw new Error("Saída incremental inválida.");
  const narrative = unsupportedNarrative(value);
  if (narrative) {
    if (hasQuantitativeLanguage(narrative)) throw new Error("A IA introduziu números e foi rejeitada.");
    if (hasRecommendation(narrative)) throw new Error("A IA introduziu recomendação e foi rejeitada.");
    throw new Error("A IA introduziu afirmação não comprovável e foi rejeitada.");
  }
  if (!hasExactKeys(value, ["summaryStyle", "changeExplanations", "limitationCodes"])) {
    throw new Error("Saída incremental inválida.");
  }
  const summaryStyle = enumValue(value.summaryStyle, ["plain", "audit"] as const, "Estilo do resumo");
  const rawItems = Array.isArray(value.changeExplanations) ? value.changeExplanations : null;
  if (!rawItems || rawItems.length !== input.changes.length) {
    throw new Error("Explicações de mudanças inválidas.");
  }
  const expected = new Map(input.changes.map((change) => [change.id, change]));
  const seen = new Set<string>();
  const focusById = new Map<string, "meaning" | "monitoring">();
  rawItems.forEach((raw, index) => {
    if (!isRecord(raw)) throw new Error(`Explicação ${index + 1} inválida.`);
    if (!hasExactKeys(raw, ["id", "focus"])) throw new Error(`Explicação ${index + 1} inválida.`);
    const id = text(raw.id, `Identificador da explicação ${index + 1}`, 180);
    const original = expected.get(id);
    if (!original || seen.has(id)) throw new Error(`Identificador incompatível: ${id}.`);
    seen.add(id);
    focusById.set(id, enumValue(raw.focus, ["meaning", "monitoring"] as const, `Foco ${id}`));
  });
  const items = input.changes.map((change) => {
    const focus = focusById.get(change.id);
    if (!focus) throw new Error(`Identificador incompatível: ${change.id}.`);
    return Object.freeze({
      id: change.id,
      title: change.title,
      explanation: change.summary,
      whyItMatters: focus === "meaning"
        ? whyItMatters(change.category)
        : "Mantém o acompanhamento desta mudança separado de qualquer recálculo ou orientação de investimento.",
    });
  });
  const limitationCodes = Array.isArray(value.limitationCodes)
    ? value.limitationCodes.map((item) => enumValue(
      item,
      ["NO_RECALCULATION", "DATA_DEPENDENCY"] as const,
      "Código de limitação",
    ))
    : null;
  if (
    !limitationCodes
    || limitationCodes.length !== 2
    || new Set(limitationCodes).size !== 2
  ) {
    throw new Error("Limitações inválidas.");
  }
  const deterministic = buildDeterministicPortfolioIncrementalExplanation(input);

  return Object.freeze({
    version: PORTFOLIO_INCREMENTAL_EXPLANATION_VERSION,
    source: "ai",
    summary: summaryStyle === "plain"
      ? deterministic.summary
      : "A comparação foi validada no servidor; a IA apenas escolheu a forma de apresentar mudanças já determinadas.",
    changeExplanations: Object.freeze(items),
    limitations: deterministic.limitations,
    disclaimer: PORTFOLIO_INCREMENTAL_EXPLANATION_DISCLAIMER,
    metadata,
  });
}
