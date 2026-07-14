import { createHash } from "crypto";
import { aiInsightsEngine, type AIInsightsEngine } from "@/lib/ai/AIInsightsEngine";
import { featureEnabled } from "@/lib/featureFlags";
import { healthEngine, type HealthEngine } from "@/lib/health/HealthEngine";
import { RegulatoryCache, positiveInt } from "@/lib/regulatory/RegulatoryCache";
import { regulatoryTimeline, type RegulatoryTimeline } from "@/lib/regulatory/RegulatoryTimeline";
import {
  canonicalFrom,
  marketFallback,
  normalizeDividendFields,
  normalizeTicker,
  nowIso,
  safeRegulatoryOverlay,
  source,
  withMarketQuote,
} from "@/lib/regulatory/RegulatoryNormalizer";
import { regulatoryRepository, type RegulatoryRepository } from "@/lib/regulatory/RegulatoryRepository";
import {
  REGULATORY_COLLECTIONS,
  type LegacyFundRecord,
  type PublicationAuthorization,
  type RegulatoryOverlay,
  type RollbackAuthorization,
} from "@/lib/regulatory/RegulatoryTypes";
import { validateRegulatoryFund } from "@/lib/regulatory/RegulatoryValidator";
import { scoreEngine, type ScoreEngine } from "@/lib/scores/ScoreEngine";
import { freeReportEngine, type FreeReportEngine } from "@/lib/reports/FreeReportEngine";
import { ValidationRunner } from "@/lib/validation/ValidationRunner";
import type {
  MarketQuote,
  PublicFundData,
  SystemHealth,
  ValidationRun,
} from "@/types/regulatory";
import type { RegulatoryTimelineResponse, RegulatoryTimelineType } from "@/types/timeline";
import type { FreeFundReport } from "@/types/reports";
import type { FundAIInsights } from "@/types/ai-insights";

const FUND_CACHE_TTL_MS = positiveInt(process.env.REGULATORY_CACHE_TTL_MS, 5 * 60_000);
const MARKET_CACHE_TTL_MS = positiveInt(process.env.REGULATORY_MARKET_CACHE_TTL_MS, 60_000);
const MAX_CACHE_ENTRIES = positiveInt(process.env.REGULATORY_CACHE_MAX_ENTRIES, 500);
const GOOGLE_SHEET_RANGE = "A1:F400";

function scoresEnabled() {
  return featureEnabled("ENABLE_SCORE_ENGINE");
}

export class ValidationExecutionError extends Error {
  constructor(message: string, readonly run: ValidationRun) {
    super(message);
    this.name = "ValidationExecutionError";
  }
}

export class RegulatoryDataService {
  private readonly fundCache = new RegulatoryCache<PublicFundData>(FUND_CACHE_TTL_MS, MAX_CACHE_ENTRIES);
  private readonly marketCache = new RegulatoryCache<MarketQuote[]>(MARKET_CACHE_TTL_MS, 1);
  private marketPromise: Promise<MarketQuote[]> | null = null;
  private readonly validationRunner: ValidationRunner;

  constructor(
    private readonly repository: RegulatoryRepository = regulatoryRepository,
    private readonly scores: ScoreEngine = scoreEngine,
    private readonly health: HealthEngine = healthEngine,
    private readonly timeline: RegulatoryTimeline = regulatoryTimeline,
    private readonly freeReports: FreeReportEngine = freeReportEngine,
    private readonly aiInsights: AIInsightsEngine = aiInsightsEngine,
  ) {
    this.validationRunner = new ValidationRunner({ canonicalFrom, normalizeTicker, validateFund: validateRegulatoryFund, now: nowIso });
  }

  invalidate(ticker?: string) {
    if (ticker) this.fundCache.delete(normalizeTicker(ticker));
    else this.fundCache.clear();
  }

  async getMarketQuotes(options?: { force?: boolean }) {
    const cached = options?.force ? null : this.marketCache.get("market");
    if (cached) return cached;
    if (this.marketPromise) return this.marketPromise;
    this.marketPromise = this.fetchMarketQuotes();
    try {
      const items = await this.marketPromise;
      this.marketCache.set("market", items);
      return items;
    } finally {
      this.marketPromise = null;
    }
  }

  private async fetchMarketQuotes(): Promise<MarketQuote[]> {
    const sheetId = process.env.SHEET_ID;
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    if (!sheetId || !apiKey) return [];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${GOOGLE_SHEET_RANGE}?key=${apiKey}&t=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Google Sheets HTTP ${response.status}`);
    const payload = await response.json() as { values?: unknown[][] };
    const [, ...rows] = payload.values || [];
    return rows.flatMap((row): MarketQuote[] => {
      const ticker = normalizeTicker(row[0]);
      if (!ticker || !row[1] || row[1] === "#N/A") return [];
      return [{
        code: ticker,
        price: String(row[1]).trim(),
        opening: String(row[2] || "").trim(),
        variation: row[3] == null ? "" : `${String(row[3]).trim().replace("R$", "").replace(/\./g, "").replace(",", ".")}%`,
        minimum: String(row[4] || "").trim(),
        maximum: String(row[5] || "").trim(),
      }];
    });
  }

  private composePublicData(
    ticker: string,
    legacyRecord: LegacyFundRecord | null,
    overlay: RegulatoryOverlay | null,
    quote: MarketQuote | null,
    includeScores = true,
  ) {
    const legacy = normalizeDividendFields(legacyRecord?.data || {});
    const canonical = canonicalFrom(ticker, legacy, overlay);
    const issues = validateRegulatoryFund(canonical);
    const publicOverlay = Object.fromEntries(Object.entries(safeRegulatoryOverlay(overlay)).filter(([key]) => key !== "sources"));
    const publicData = {
      ...legacy,
      ...publicOverlay,
      ...(quote || marketFallback(ticker)),
      code: ticker,
      ticker,
      fundKind: canonical.kind,
      dataSources: {
        price: quote ? "Planilha de cotações Dados FII" : "Preço indisponível",
        fund: legacyRecord ? "Base interna Dados FII" : "Dados cadastrais/dividendos indisponíveis",
        regulatory: overlay ? "Base regulatória versionada Dados FII" : "Sem overlay regulatório publicado",
      },
      marketDataSource: quote ? "Planilha de cotações Dados FII" : null,
      fundDataSource: legacyRecord ? "Base interna Dados FII" : null,
      marketDataUpdatedAt: quote ? nowIso() : null,
      regulatoryMeta: {
        schemaVersion: canonical.schemaVersion,
        currentVersion: canonical.currentVersion,
        cache: "miss" as const,
        sources: canonical.sources.concat(quote ? [source("Planilha de cotações Dados FII", "market", nowIso())] : []),
        validation: { valid: !issues.some((issue) => issue.severity === "error"), issues },
      },
    } as PublicFundData;
    if (includeScores && scoresEnabled()) publicData.scores = this.scores.calculate(publicData);
    return publicData;
  }

  async getByTicker(value: unknown, options?: { bypassCache?: boolean; marketQuote?: MarketQuote | null }): Promise<PublicFundData | null> {
    const ticker = normalizeTicker(value);
    if (!ticker) return null;
    const cached = options?.bypassCache ? null : this.fundCache.get(ticker);
    if (cached) {
      const cachedQuote = options && "marketQuote" in options
        ? options.marketQuote || null
        : (await this.getMarketQuotes()).find((item) => item.code === ticker) || null;
      return withMarketQuote(cached, cachedQuote, "hit");
    }

    const [legacyRecord, overlay, quotes] = await Promise.all([
      this.repository.getLegacyByTicker(ticker),
      this.repository.getOverlayByTicker(ticker),
      options && "marketQuote" in options ? Promise.resolve([]) : this.getMarketQuotes(),
    ]);
    const quote = options && "marketQuote" in options ? options.marketQuote : quotes.find((item) => item.code === ticker) || null;
    if (!legacyRecord && !overlay && !quote) return null;

    const publicData = this.composePublicData(ticker, legacyRecord, overlay, quote || null);
    this.fundCache.set(ticker, publicData);
    return publicData;
  }

  async listFunds(limit = 500, options?: { includeMarket?: boolean; includeScores?: boolean }) {
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 2_000);
    const [legacyRecords, overlayRecords, quotes] = await Promise.all([
      this.repository.listLegacy(safeLimit),
      this.repository.listOverlays(safeLimit),
      options?.includeMarket === false ? Promise.resolve([] as MarketQuote[]) : this.getMarketQuotes(),
    ]);
    const legacyMap = new Map(legacyRecords.map((record) => [normalizeTicker(record.data.code || record.id), record]));
    const overlayMap = new Map(overlayRecords.map((record) => [normalizeTicker(record.data.ticker || record.id), record.data]));
    const quoteMap = new Map(quotes.map((quote) => [quote.code, quote]));
    const tickers = Array.from(new Set([...legacyMap.keys(), ...overlayMap.keys()])).filter(Boolean).slice(0, safeLimit);
    return tickers.map((ticker) => this.composePublicData(
      ticker,
      legacyMap.get(ticker) || null,
      overlayMap.get(ticker) || null,
      quoteMap.get(ticker) || null,
      options?.includeScores !== false,
    ));
  }

  async listMissingCnpj(limit: number, cursor?: string) {
    const page = await this.repository.listLegacyPage(Math.min(Math.max(limit, 1), 1_000), cursor);
    const missing = page.records
      .filter(({ data }) => String(data.cnpj || "").replace(/\D/g, "").length !== 14)
      .map(({ id, data }) => ({
        id,
        ticker: normalizeTicker(data.code || id),
        name: String(data.name || data.socialReason || ""),
        cnpj: String(data.cnpj || ""),
      }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
    return { missing, processed: page.records.length, nextCursor: page.nextCursor, hasMore: page.hasMore };
  }

  async getMany(values: unknown[], limit = 80) {
    const tickers = Array.from(new Set(values.map(normalizeTicker).filter(Boolean))).slice(0, limit);
    const quotes = await this.getMarketQuotes();
    const quoteMap = new Map(quotes.map((item) => [item.code, item]));
    const entries = await Promise.all(tickers.map(async (ticker) => [ticker, await this.getByTicker(ticker, { marketQuote: quoteMap.get(ticker) || null })] as const));
    const items: Record<string, PublicFundData> = {};
    const errors: Record<string, string> = {};
    for (const [ticker, item] of entries) {
      if (item) items[ticker] = item;
      else errors[ticker] = "FII não encontrado";
    }
    return { requested: tickers.length, found: Object.keys(items).length, items, errors, updatedAt: nowIso() };
  }

  async getTimeline(value: unknown, options?: { types?: RegulatoryTimelineType[]; limit?: number; cursor?: string | null }): Promise<RegulatoryTimelineResponse | null> {
    const ticker = normalizeTicker(value);
    if (!ticker) return null;
    const [legacy, overlay, records, auditEvents] = await Promise.all([
      this.repository.getLegacyByTicker(ticker),
      this.repository.getOverlayByTicker(ticker),
      this.repository.getTimelineRecords(ticker),
      this.repository.getAuditEventsForTicker(ticker),
    ]);
    if (!legacy && !overlay && !records.length && !auditEvents.length) return null;
    return this.timeline.build({
      ticker,
      records,
      overlay,
      auditEvents,
      types: options?.types,
      limit: options?.limit,
      cursor: options?.cursor,
      generatedAt: nowIso(),
    });
  }

  async getFreeReport(value: unknown): Promise<FreeFundReport | null> {
    const ticker = normalizeTicker(value);
    if (!ticker) return null;
    const [fund, timeline] = await Promise.all([
      this.getByTicker(ticker),
      this.getTimeline(ticker, { limit: 5 }),
    ]);
    if (!fund) return null;
    return this.freeReports.generate(fund, timeline, nowIso());
  }

  async getAIInsights(value: unknown, options?: { requestKey?: string | null }): Promise<FundAIInsights | null> {
    const report = await this.getFreeReport(value);
    if (!report) return null;
    return this.aiInsights.generateFundInsights(report, { requestKey: options?.requestKey });
  }

  async publish(ticker: unknown, patch: Record<string, unknown>, authorization: PublicationAuthorization) {
    const result = await this.repository.publish(ticker, patch, authorization);
    this.invalidate(String(ticker));
    return result;
  }

  async rollback(ticker: unknown, versionId: string, authorization: RollbackAuthorization) {
    const result = await this.repository.rollback(ticker, versionId, authorization);
    this.invalidate(String(ticker));
    return result;
  }

  async runValidation(actor: string, options?: { limit?: number }): Promise<ValidationRun> {
    const startedAt = nowIso();
    const startedMs = Date.now();
    const id = this.repository.validationRunId();
    const limit = Math.min(Math.max(Number(options?.limit || 400), 1), 500);
    try {
      const [legacyRecords, overlayRecords, market] = await Promise.all([
        this.repository.listLegacy(limit),
        this.repository.listOverlays(limit),
        this.getMarketQuotes({ force: true }).then((items) => ({ items, error: null as string | null })).catch((error: Error) => ({ items: [] as MarketQuote[], error: error.message })),
      ]);
      const scoreProbe = scoresEnabled() ? { enabled: true, ...this.scores.healthCheck() } : { enabled: false, ok: false };
      const run = this.validationRunner.complete({ id, actor, startedAt, startedMs, legacyRecords, overlayRecords, market, scoreProbe });
      await this.repository.saveValidationRun(run);
      return run;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida no Validation Runner.";
      const run = this.validationRunner.failed({ id, actor, startedAt, startedMs, error: message });
      await this.repository.saveValidationRun(run).catch(() => undefined);
      throw new ValidationExecutionError(message, run);
    }
  }

  getValidationHistory(limit = 20) {
    return this.repository.getValidationHistory(limit);
  }

  getParserHealth() {
    return this.repository.getParserHealth();
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const [firestore, history, parsers, auditEvents] = await Promise.all([
      this.repository.probe(),
      this.getValidationHistory(1),
      this.getParserHealth(),
      this.repository.getAuditEvents(50),
    ]);
    const scoreProbe = scoresEnabled()
      ? { enabled: true, ...this.scores.healthCheck() }
      : { enabled: false, ok: false, version: "disabled" };
    return this.health.evaluate({
      generatedAt: nowIso(),
      firestore,
      parsers,
      latestValidation: history[0] || null,
      auditEvents,
      fundCache: this.fundCache.stats(),
      marketCache: this.marketCache.stats(),
      scoreProbe,
      ttlMs: FUND_CACHE_TTL_MS,
      marketTtlMs: MARKET_CACHE_TTL_MS,
      collections: REGULATORY_COLLECTIONS,
    });
  }

  requestFingerprint(parts: string[]) {
    return createHash("sha256").update(parts.join(":"), "utf8").digest("hex").slice(0, 24);
  }
}

export const regulatoryDataService = new RegulatoryDataService();
export { REGULATORY_COLLECTIONS, normalizeTicker };
export { inferFundKind } from "@/lib/regulatory/RegulatoryNormalizer";
export { validateRegulatoryFund } from "@/lib/regulatory/RegulatoryValidator";
