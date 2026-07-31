import type {
  PortfolioIntelligenceInput,
  PortfolioIntelligencePositionInput,
  PortfolioIntelligenceResult,
  PortfolioIntelligenceSnapshotInput,
  PortfolioIntelligenceWarning,
} from "./PortfolioIntelligence";
import { PortfolioIntelligenceValidationError } from "./PortfolioIntelligence";
import { assessPortfolioIntelligenceDataQuality } from "./PortfolioIntelligenceDataQuality";
import {
  calculateIncomeMetrics,
  calculatePortfolioMetrics,
  type NormalizedIncomeMonth,
  type NormalizedPortfolioPosition,
} from "./PortfolioIntelligenceMetrics";
import {
  PORTFOLIO_INTELLIGENCE_POLICY,
  type PortfolioIntelligencePolicy,
} from "./PortfolioIntelligencePolicy";
import { buildPortfolioIntelligenceSignals } from "./PortfolioIntelligenceSignals";

const TIME_ZONE = "America/Sao_Paulo";

function canonicalCompetence(value: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) {
    throw new PortfolioIntelligenceValidationError(
      "INVALID_COMPETENCE",
      "Competência inválida; use YYYY-MM.",
    );
  }
  return value;
}

function competenceAt(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}`;
}

function requireFiniteNonNegative(
  value: number,
  code: "INVALID_DIVIDENDS" | "INVALID_PRICE" | "INVALID_ESTIMATED_INCOME",
  message: string,
) {
  if (!Number.isFinite(value) || value < 0) {
    throw new PortfolioIntelligenceValidationError(code, message);
  }
  return value;
}

function normalizeSnapshots(
  snapshots: readonly PortfolioIntelligenceSnapshotInput[],
  currentCompetence: string,
) {
  const seen = new Set<string>();
  const months: NormalizedIncomeMonth[] = [];
  const warnings: PortfolioIntelligenceWarning[] = [];

  for (const snapshot of snapshots) {
    const competence = canonicalCompetence(String(snapshot.competence));
    if (seen.has(competence)) {
      throw new PortfolioIntelligenceValidationError(
        "DUPLICATE_COMPETENCE",
        `Competência duplicada: ${competence}.`,
      );
    }
    seen.add(competence);
    if (snapshot.dividends !== null) {
      requireFiniteNonNegative(
        snapshot.dividends,
        "INVALID_DIVIDENDS",
        `Dividendos inválidos em ${competence}.`,
      );
    }
    if (competence > currentCompetence) {
      warnings.push(Object.freeze({
        code: "FUTURE_COMPETENCE_IGNORED",
        competence,
        message: "Competência futura excluída dos cálculos.",
      }));
      continue;
    }
    if (competence === currentCompetence) {
      warnings.push(Object.freeze({
        code: "CURRENT_COMPETENCE_IGNORED",
        competence,
        message: "Competência corrente excluída por ainda não estar encerrada.",
      }));
      continue;
    }
    if (snapshot.dividends === null) continue;
    months.push(Object.freeze({ competence, value: snapshot.dividends }));
  }

  months.sort((left, right) => left.competence.localeCompare(right.competence));
  warnings.sort((left, right) => (
    left.code.localeCompare(right.code)
    || String(left.competence ?? "").localeCompare(String(right.competence ?? ""))
  ));
  return Object.freeze({ months: Object.freeze(months), warnings: Object.freeze(warnings) });
}

function normalizePosition(position: PortfolioIntelligencePositionInput): NormalizedPortfolioPosition {
  const ticker = String(position.ticker ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(ticker)) {
    throw new PortfolioIntelligenceValidationError("INVALID_TICKER", "Ticker inválido na carteira.");
  }
  if (!Number.isFinite(position.quantity) || position.quantity <= 0) {
    throw new PortfolioIntelligenceValidationError(
      "INVALID_QUANTITY",
      `Quantidade inválida para ${ticker}.`,
    );
  }
  const price = position.price === null
    ? null
    : requireFiniteNonNegative(position.price, "INVALID_PRICE", `Cotação inválida para ${ticker}.`);
  const estimatedIncome = position.estimatedIncome === null
    ? null
    : requireFiniteNonNegative(
      position.estimatedIncome,
      "INVALID_ESTIMATED_INCOME",
      `Renda estimada inválida para ${ticker}.`,
    );
  const rawSegment = String(position.segment ?? "").trim();
  const segment = rawSegment && !/^(sem segmento|unknown|n\/a)$/i.test(rawSegment)
    ? rawSegment
    : null;
  return Object.freeze({
    ticker,
    quantity: position.quantity,
    price: price && price > 0 ? price : null,
    estimatedIncome,
    segment,
  });
}

function normalizePositions(positions: readonly PortfolioIntelligencePositionInput[]) {
  const seen = new Set<string>();
  const normalized = positions.map((position) => {
    const item = normalizePosition(position);
    if (seen.has(item.ticker)) {
      throw new PortfolioIntelligenceValidationError(
        "DUPLICATE_POSITION",
        `Posição duplicada para ${item.ticker}.`,
      );
    }
    seen.add(item.ticker);
    return item;
  });
  return Object.freeze(normalized.sort((left, right) => left.ticker.localeCompare(right.ticker)));
}

function validateDate(value: Date | string, code: "INVALID_AS_OF") {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new PortfolioIntelligenceValidationError(code, "Data de referência inválida.");
  }
  return date;
}

export class PortfolioIntelligenceService {
  private readonly policy: PortfolioIntelligencePolicy;
  private readonly clock: () => Date;

  constructor(
    policy: PortfolioIntelligencePolicy = PORTFOLIO_INTELLIGENCE_POLICY,
    clock: () => Date = () => new Date(),
  ) {
    this.policy = policy;
    this.clock = clock;
  }

  analyze(
    input: PortfolioIntelligenceInput,
    options: Readonly<{ asOf: Date | string; generatedAt?: Date | string }>,
  ): PortfolioIntelligenceResult {
    const asOf = validateDate(options.asOf, "INVALID_AS_OF");
    const generatedAt = validateDate(options.generatedAt ?? this.clock(), "INVALID_AS_OF");
    const normalizedHistory = normalizeSnapshots(input.snapshots, competenceAt(asOf));
    const positions = normalizePositions(input.positions);
    const incomeResult = calculateIncomeMetrics(normalizedHistory.months, this.policy);
    const portfolio = calculatePortfolioMetrics(positions);
    const qualityResult = assessPortfolioIntelligenceDataQuality({
      positions,
      income: incomeResult.metrics,
      portfolio,
      policy: this.policy,
    });
    const metrics = Object.freeze({ income: incomeResult.metrics, portfolio });
    const signals = buildPortfolioIntelligenceSignals({
      metrics,
      dataQuality: qualityResult.quality,
      policy: this.policy,
    });
    const warnings = Object.freeze([
      ...normalizedHistory.warnings,
      ...incomeResult.warnings,
      ...qualityResult.warnings,
    ].sort((left, right) => (
      left.code.localeCompare(right.code)
      || String(left.competence ?? "").localeCompare(String(right.competence ?? ""))
      || left.message.localeCompare(right.message)
    )));

    return Object.freeze({
      policyVersion: this.policy.version,
      generatedAt: generatedAt.toISOString(),
      asOf: asOf.toISOString(),
      metrics,
      signals,
      dataQuality: qualityResult.quality,
      warnings,
    });
  }

  analyzeSafely(
    input: PortfolioIntelligenceInput,
    options: Readonly<{ asOf: Date | string; generatedAt?: Date | string }>,
  ): PortfolioIntelligenceResult {
    try {
      return this.analyze(input, options);
    } catch (error) {
      if (!(error instanceof PortfolioIntelligenceValidationError)) throw error;
      const empty = this.analyze({ snapshots: [], positions: [] }, options);
      return Object.freeze({
        ...empty,
        warnings: Object.freeze([
          ...empty.warnings,
          Object.freeze({
            code: "INVALID_INPUT_REJECTED" as const,
            message: "Entrada inválida rejeitada; nenhuma métrica financeira foi calculada.",
          }),
        ]),
      });
    }
  }
}

export const portfolioIntelligenceService = new PortfolioIntelligenceService();
