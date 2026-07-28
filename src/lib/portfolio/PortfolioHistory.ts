export const PORTFOLIO_HISTORY_SCHEMA_VERSION = 1 as const;

export type PortfolioHistorySource =
  | "manual"
  | "automatic_snapshot"
  | "legacy";

export type PortfolioHistoryCompetence = `${number}-${string}`;

export type PortfolioHistoryEntry = Readonly<{
  schemaVersion: typeof PORTFOLIO_HISTORY_SCHEMA_VERSION;
  portfolioId: string;
  competence: PortfolioHistoryCompetence;
  totalValue: number | null;
  dividends: number | null;
  source: PortfolioHistorySource;
  createdAt: string;
  updatedAt: string;
}>;

export type ManualPortfolioHistoryInput = Readonly<{
  portfolioId: string;
  year: unknown;
  month: unknown;
  dividends: unknown;
}>;

export type PortfolioHistoryConflict = Readonly<{
  competence: PortfolioHistoryCompetence;
  existingSource: PortfolioHistorySource;
  incomingSource: PortfolioHistorySource;
  resolution: "reject_duplicate" | "require_explicit_resolution";
}>;

export type PortfolioHistoryValidationCode =
  | "INVALID_PORTFOLIO_ID"
  | "INVALID_YEAR"
  | "INVALID_MONTH"
  | "FUTURE_COMPETENCE"
  | "INVALID_MONEY"
  | "EMPTY_ENTRY"
  | "DUPLICATE_COMPETENCE"
  | "IMMUTABLE_SNAPSHOT";

export class PortfolioHistoryValidationError extends Error {
  readonly code: PortfolioHistoryValidationCode;

  constructor(code: PortfolioHistoryValidationCode, message: string) {
    super(message);
    this.code = code;
    this.name = "PortfolioHistoryValidationError";
  }
}

function requirePortfolioId(value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(normalized)) {
    throw new PortfolioHistoryValidationError(
      "INVALID_PORTFOLIO_ID",
      "Identificador da carteira inválido.",
    );
  }
  return normalized;
}

function requireInteger(value: unknown, code: "INVALID_YEAR" | "INVALID_MONTH"): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(parsed)) {
    throw new PortfolioHistoryValidationError(
      code,
      code === "INVALID_YEAR" ? "Ano inválido." : "Mês inválido.",
    );
  }
  return parsed;
}

export function buildCompetence(year: unknown, month: unknown): PortfolioHistoryCompetence {
  const normalizedYear = requireInteger(year, "INVALID_YEAR");
  const normalizedMonth = requireInteger(month, "INVALID_MONTH");

  if (normalizedYear < 2000 || normalizedYear > 9999) {
    throw new PortfolioHistoryValidationError("INVALID_YEAR", "Ano inválido.");
  }
  if (normalizedMonth < 1 || normalizedMonth > 12) {
    throw new PortfolioHistoryValidationError("INVALID_MONTH", "Mês inválido.");
  }

  return `${normalizedYear}-${String(normalizedMonth).padStart(2, "0")}` as PortfolioHistoryCompetence;
}

export function isFutureCompetence(
  competence: PortfolioHistoryCompetence,
  now: Date,
): boolean {
  const current = buildCompetence(now.getUTCFullYear(), now.getUTCMonth() + 1);
  return competence > current;
}

function normalizePtBrMoneyString(value: string): string {
  const trimmed = value.trim().replace(/^R\$\s?/, "").replace(/\s/g, "");
  if (!trimmed) return "";

  if (/^-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/.test(trimmed)) {
    return trimmed.replace(/\./g, "").replace(",", ".");
  }
  if (/^-?\d+(?:,\d{1,2})?$/.test(trimmed)) {
    return trimmed.replace(",", ".");
  }
  if (/^-?\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    return trimmed;
  }

  throw new PortfolioHistoryValidationError("INVALID_MONEY", "Valor monetário inválido.");
}

export function parseOptionalMoney(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;

  const parsed = typeof value === "number"
    ? value
    : Number(normalizePtBrMoneyString(String(value)));

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new PortfolioHistoryValidationError("INVALID_MONEY", "Valor monetário inválido.");
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

export function createManualPortfolioHistoryEntry(
  input: ManualPortfolioHistoryInput,
  now: Date,
): PortfolioHistoryEntry {
  const portfolioId = requirePortfolioId(input.portfolioId);
  const competence = buildCompetence(input.year, input.month);
  if (isFutureCompetence(competence, now)) {
    throw new PortfolioHistoryValidationError(
      "FUTURE_COMPETENCE",
      "Não é permitido cadastrar uma competência futura.",
    );
  }

  const dividends = parseOptionalMoney(input.dividends);
  if (dividends === null) {
    throw new PortfolioHistoryValidationError(
      "EMPTY_ENTRY",
      "Informe o total de dividendos recebidos no mês.",
    );
  }

  const timestamp = now.toISOString();
  return Object.freeze({
    schemaVersion: PORTFOLIO_HISTORY_SCHEMA_VERSION,
    portfolioId,
    competence,
    totalValue: null,
    dividends,
    source: "manual" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function detectPortfolioHistoryConflict(
  existing: PortfolioHistoryEntry | undefined,
  incoming: PortfolioHistoryEntry,
): PortfolioHistoryConflict | null {
  if (!existing) return null;
  if (existing.portfolioId !== incoming.portfolioId || existing.competence !== incoming.competence) {
    return null;
  }

  if (existing.source === "manual" && incoming.source === "manual") {
    return {
      competence: incoming.competence,
      existingSource: existing.source,
      incomingSource: incoming.source,
      resolution: "reject_duplicate",
    };
  }

  return {
    competence: incoming.competence,
    existingSource: existing.source,
    incomingSource: incoming.source,
    resolution: "require_explicit_resolution",
  };
}

export function assertCanEditPortfolioHistory(entry: PortfolioHistoryEntry): void {
  if (entry.source !== "manual") {
    throw new PortfolioHistoryValidationError(
      "IMMUTABLE_SNAPSHOT",
      "Somente registros manuais podem ser editados ou excluídos.",
    );
  }
}

export function insertPortfolioHistoryEntry(
  entries: readonly PortfolioHistoryEntry[],
  incoming: PortfolioHistoryEntry,
): readonly PortfolioHistoryEntry[] {
  const existing = entries.find(
    (entry) => entry.portfolioId === incoming.portfolioId && entry.competence === incoming.competence,
  );
  const conflict = detectPortfolioHistoryConflict(existing, incoming);
  if (conflict) {
    throw new PortfolioHistoryValidationError(
      "DUPLICATE_COMPETENCE",
      conflict.resolution === "reject_duplicate"
        ? "Já existe um registro manual para esta competência."
        : "Existe um snapshot ou registro legado para esta competência.",
    );
  }

  return Object.freeze(
    [...entries, incoming].sort((left, right) => left.competence.localeCompare(right.competence)),
  );
}
