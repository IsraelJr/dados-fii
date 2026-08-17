import type {
  PortfolioIntelligenceInput,
  PortfolioIntelligencePositionInput,
} from "@/lib/portfolio-intelligence/PortfolioIntelligence";
import type { PublicFundData } from "@/types/regulatory";
import type { PortfolioIntelligenceSourceRepository } from "@/server/repositories/FirestorePortfolioIntelligenceSourceRepositoryCore";

const DEFAULT_PORTFOLIO_ID = "default";
const MAX_POSITIONS = 120;

export type RegulatoryPortfolioDataReader = Readonly<{
  getMany(
    values: unknown[],
    limit?: number,
    options?: Readonly<{ asOf?: Date | string }>,
  ): Promise<Readonly<{
    items: Readonly<Record<string, PublicFundData>>;
    errors: Readonly<Record<string, string>>;
  }>>;
}>;

export type PortfolioIntelligenceCanonicalInputServiceDependencies = Readonly<{
  source: PortfolioIntelligenceSourceRepository;
  regulatory: RegulatoryPortfolioDataReader;
}>;

function canonicalAsOf(value: Date | string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("PORTFOLIO_INCREMENTAL_AS_OF_INVALID");
  return date.toISOString();
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function valueAtPath(value: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    const currentRecord = record(current);
    return currentRecord ? currentRecord[key] : undefined;
  }, value);
}

function localizedNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const numeric = value.replace(/R\$/gi, "").replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  if (!numeric) return null;
  const comma = numeric.lastIndexOf(",");
  const dot = numeric.lastIndexOf(".");
  let normalized = numeric;
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? numeric.replace(/\./g, "").replace(",", ".")
      : numeric.replace(/,/g, "");
  } else if (comma >= 0) {
    normalized = numeric.replace(/\./g, "").replace(",", ".");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function firstNumber(value: unknown, paths: readonly string[]) {
  for (const path of paths) {
    const parsed = localizedNumber(valueAtPath(value, path));
    if (parsed !== null) return parsed;
  }
  return null;
}

function firstText(value: unknown, paths: readonly string[]) {
  for (const path of paths) {
    const candidate = valueAtPath(value, path);
    if (typeof candidate !== "string") continue;
    const normalized = candidate.replace(/\s+/g, " ").trim();
    if (normalized) return normalized;
  }
  return null;
}

function positionFromFund(
  ticker: string,
  quantity: number,
  fund: PublicFundData | undefined,
): PortfolioIntelligencePositionInput {
  if (!fund) {
    return Object.freeze({ ticker, quantity, price: null, estimatedIncome: null, segment: null });
  }
  const price = firstNumber(fund, ["price", "currentPrice", "cotacao", "marketData.price"]);
  const dividendPerShare = firstNumber(fund, ["lastDividend", "dividends.lastDividend"]);
  const segment = firstText(fund, ["segment_new", "segment", "catalog.identity.segment"]);
  return Object.freeze({
    ticker,
    quantity,
    price: price !== null && price > 0 ? price : null,
    estimatedIncome: dividendPerShare === null
      ? null
      : Number((dividendPerShare * quantity).toFixed(8)),
    segment,
  });
}

export class PortfolioIntelligenceCanonicalInputService {
  private readonly source: PortfolioIntelligenceSourceRepository;
  private readonly regulatory: RegulatoryPortfolioDataReader;

  constructor(dependencies: PortfolioIntelligenceCanonicalInputServiceDependencies) {
    this.source = dependencies.source;
    this.regulatory = dependencies.regulatory;
  }

  async load(input: Readonly<{
    ownerId: string;
    portfolioId: string;
    asOf: Date | string;
  }>): Promise<PortfolioIntelligenceInput> {
    if (String(input.portfolioId ?? "").trim() !== DEFAULT_PORTFOLIO_ID) {
      throw new Error("PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED");
    }
    const asOf = canonicalAsOf(input.asOf);
    const source = await this.source.load({
      ownerId: input.ownerId,
      portfolioId: DEFAULT_PORTFOLIO_ID,
    });
    const tickers = source.wallet.map((position) => position.ticker);
    const regulatory = await this.regulatory.getMany(tickers, MAX_POSITIONS, { asOf });
    const positions = Object.freeze(source.wallet.map((position) => positionFromFund(
      position.ticker,
      position.quantity,
      regulatory.items[position.ticker],
    )));

    return Object.freeze({
      snapshots: source.snapshots,
      positions,
    });
  }
}
