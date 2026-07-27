import {
  DIVIDEND_MONTHS,
  mergeDividendYear,
  parseStatusInvestDividends,
  parseStatusInvestMarketIndicators,
} from "@/lib/market/StatusInvestParser";
import {
  dividendUpdateRepository,
  type DividendUpdateRepository,
} from "@/lib/dividends/DividendUpdateRepository";
import type {
  DividendUpdateCompletedResult,
  DividendUpdateContext,
  DividendUpdateResult,
} from "@/lib/dividends/DividendUpdateTypes";

const TIME_ZONE = "America/Sao_Paulo";
const MONTHS: string[] = [...DIVIDEND_MONTHS];

function saoPauloParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function clean(html: string) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function withoutAccent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function removeUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(removeUndefined) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if (typeof (value as { isEqual?: unknown }).isEqual === "function") return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, field]) => field !== undefined)
        .map(([key, field]) => [key, removeUndefined(field)]),
    ) as T;
  }
  return value;
}

export class DividendUpdateService {
  private readonly repository: DividendUpdateRepository;
  private readonly fetcher: typeof fetch;

  constructor(
    repository: DividendUpdateRepository = dividendUpdateRepository,
    fetcher: typeof fetch = fetch,
  ) {
    this.repository = repository;
    this.fetcher = fetcher;
  }

  private async statusInvestPage(ticker: string) {
    const code = ticker.toLowerCase();
    const urls = [
      `https://statusinvest.com.br/fundos-imobiliarios/${code}`,
      `https://statusinvest.com.br/fiagros/${code}`,
      `https://statusinvest.com.br/fiinfras/${code}`,
    ];
    for (const url of urls) {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const response = await this.fetcher(url, {
            cache: "no-store",
            headers: { "User-Agent": "DadosFII/2.0", Accept: "text/html" },
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const text = clean(await response.text());
          const normalized = withoutAccent(text.toUpperCase());
          if (normalized.includes("OPS") && normalized.includes("NAO ENCONTRAMOS")) break;
          if (normalized.includes(ticker) && (normalized.includes("TIPO DATA COM") || normalized.includes("DIVIDENDOS DO"))) {
            return { text, url };
          }
          break;
        } catch {
          if (attempt === 2) break;
        }
      }
    }
    throw new Error("Fonte externa indisponível ou sem documento compatível.");
  }

  async update(
    ticker: string,
    context: DividendUpdateContext,
    now = new Date(),
  ): Promise<DividendUpdateResult> {
    const completed = await this.repository.getCompletedRun(ticker, context);
    if (completed) return completed;
    const lock = await this.repository.acquireLock(ticker);
    try {
      const completedAfterLock = await this.repository.getCompletedRun(ticker, context);
      if (completedAfterLock) return completedAfterLock;
      const fund = await this.repository.getFund(ticker);
      if (!fund) {
        const result = {
          status: "not_found" as const,
          ticker,
          replayed: false,
        };
        await this.repository.recordOutcome(ticker, context, {
          status: "not_found",
          result,
        });
        return result;
      }
      const parts = saoPauloParts(now);
      const year = Number(parts.year);
      const currentMonth = MONTHS[Number(parts.month) - 1];
      const page = await this.statusInvestPage(ticker);
      const fetched = parseStatusInvestDividends(page.text, year);
      const fetchedMonths = Object.keys(fetched).sort((left, right) => MONTHS.indexOf(left) - MONTHS.indexOf(right));
      if (!fetchedMonths.length) throw new Error(`Nenhum rendimento de ${year} foi validado na fonte.`);
      const yearField = `earnings${year}`;
      const previousYear = fund.data[yearField] && typeof fund.data[yearField] === "object"
        ? fund.data[yearField] as Record<string, unknown>
        : {};
      const merged = mergeDividendYear(previousYear, fetched);
      const indicators = removeUndefined(parseStatusInvestMarketIndicators(
        page.text,
        page.url,
        `${parts.year}-${parts.month}-${parts.day}`,
      ));
      const resultWithoutPersistence: Omit<DividendUpdateCompletedResult, "changed" | "dataHash" | "replayed"> = {
        status: "completed",
        ticker,
        year,
        fetchedMonths,
        currentMonth,
        currentMonthIncluded: Boolean(merged[currentMonth]),
        indicatorsUpdated: Object.keys(indicators).length > 0,
      };
      const persistence = await this.repository.apply(
        ticker,
        fund.ref,
        fund.data,
        { [yearField]: merged, ...indicators },
        page.url,
        context,
        resultWithoutPersistence,
      );
      return {
        ...resultWithoutPersistence,
        changed: persistence.changed,
        dataHash: persistence.dataHash,
        replayed: false,
      };
    } catch (error) {
      await this.repository.recordOutcome(ticker, context, {
        status: "failed",
        failureCode: error instanceof Error ? error.name : "unknown_error",
      }).catch(() => undefined);
      throw error;
    } finally {
      await lock.release().catch(() => undefined);
    }
  }
}

export const dividendUpdateService = new DividendUpdateService();
