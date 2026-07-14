import { normalizeIngestionTicker } from "@/lib/fiiIngestionConfig";
import { buildRegulatoryInsights } from "@/lib/regulatoryInsights";
import { buildRegulatoryTimeline } from "@/lib/regulatoryTimeline";
import { InvalidTickerError } from "./RegulatoryErrors";
import { RegulatoryCache, regulatoryCacheTtlMs } from "./RegulatoryCache";
import { isPublishedRegulatoryData, normalizeFundDocument } from "./RegulatoryNormalizer";
import type { RegulatoryRepository } from "./RegulatoryRepository";
import type {
  RegulatoryFundResult,
  RegulatoryFundView,
  RegulatoryReportResult,
} from "./RegulatoryTypes";

type RegulatoryDataServiceOptions = {
  repository?: RegulatoryRepository;
  cache?: RegulatoryCache<RegulatoryFundView | null>;
};

function lazyFirestoreRepository(): RegulatoryRepository {
  return {
    async getFundDocument(ticker: string) {
      const { FirestoreRegulatoryRepository } = await import("./RegulatoryRepository");
      return new FirestoreRegulatoryRepository().getFundDocument(ticker);
    },
  };
}

export class RegulatoryDataService {
  private readonly repository: RegulatoryRepository;
  private readonly cache: RegulatoryCache<RegulatoryFundView | null>;

  constructor(options: RegulatoryDataServiceOptions = {}) {
    this.repository = options.repository || lazyFirestoreRepository();
    this.cache = options.cache || new RegulatoryCache<RegulatoryFundView | null>(regulatoryCacheTtlMs());
  }

  async getFund(tickerInput: unknown, options: { bypassCache?: boolean } = {}): Promise<RegulatoryFundResult> {
    const ticker = normalizeIngestionTicker(tickerInput);
    if (!ticker) throw new InvalidTickerError();

    if (!options.bypassCache) {
      const cached = this.cache.get(ticker);
      if (cached) {
        return {
          found: Boolean(cached.value),
          ticker,
          fund: cached.value,
          cache: { hit: true, loadedAt: cached.loadedAt },
        };
      }
    }

    const raw = await this.repository.getFundDocument(ticker);
    const fund = raw ? normalizeFundDocument(ticker, raw) : null;
    const stored = this.cache.set(ticker, fund);

    return {
      found: Boolean(fund),
      ticker,
      fund,
      cache: { hit: false, loadedAt: stored.loadedAt },
    };
  }

  async getReportInput(tickerInput: unknown, options: { bypassCache?: boolean } = {}): Promise<RegulatoryReportResult> {
    const response = await this.getFund(tickerInput, options);
    if (!response.found || !response.fund) {
      return {
        ...response,
        reportAvailable: false,
        reason: "fund_not_found",
        insights: null,
        timeline: null,
      };
    }

    const regulatoryData = response.fund.regulatoryData;
    if (!regulatoryData) {
      return {
        ...response,
        reportAvailable: false,
        reason: "regulatory_data_invalid",
        insights: null,
        timeline: null,
      };
    }

    if (!isPublishedRegulatoryData(regulatoryData)) {
      return {
        ...response,
        reportAvailable: false,
        reason: "regulatory_data_not_published",
        insights: null,
        timeline: null,
      };
    }

    const insights = buildRegulatoryInsights({
      ticker: response.ticker,
      monthlyHistory: regulatoryData.monthlyHistory,
      quality: regulatoryData.quality,
      documents: regulatoryData.documents,
    });
    const timeline = buildRegulatoryTimeline({
      ticker: response.ticker,
      monthlyHistory: regulatoryData.monthlyHistory,
      documents: regulatoryData.documents,
    });

    return {
      ...response,
      reportAvailable: true,
      reason: null,
      insights,
      timeline,
    };
  }

  async getReportInputs(tickers: unknown[]) {
    return Promise.all(tickers.map((ticker) => this.getReportInput(ticker)));
  }

  invalidate(tickerInput: unknown) {
    const ticker = normalizeIngestionTicker(tickerInput);
    if (ticker) this.cache.delete(ticker);
  }

  clearCache() {
    this.cache.clear();
  }

  cacheSize() {
    return this.cache.size();
  }
}

export const regulatoryDataService = new RegulatoryDataService();
