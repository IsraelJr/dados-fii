import { createHash } from "crypto";
import { aiInsightsEngine, type AIInsightsEngine } from "@/lib/ai/AIInsightsEngine";
import { featureEnabled } from "@/lib/featureFlags";
import { deriveFiiRiskData, plausiblePvpValue } from "@/lib/fiiDerivedData";
import { healthEngine, type HealthEngine } from "@/lib/health/HealthEngine";
import { RegulatoryCache, positiveInt } from "@/lib/regulatory/RegulatoryCache";
import { applyOfficialFundReference, getOfficialFundReference } from "@/lib/regulatory/OfficialFundReferences";
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
import { premiumReportEngine, PremiumReportError, type PremiumPortfolioHolding, type PremiumReportEngine } from "@/lib/reports/PremiumReportEngine";
import { observabilityEngine, type ObservabilityEngine } from "@/lib/observability/ObservabilityEngine";
import { automaticMonitor, type AutomaticMonitor } from "@/lib/monitor/AutomaticMonitor";
import { fetchIfixComposition, ifixMembership } from "@/lib/indexes/IfixComposition";
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
import type { PremiumFundReport } from "@/types/premium-report";
import type { SystemObservability } from "@/types/observability";
import type { MonitorRun, MonitorStatus } from "@/types/monitor";
import type { IfixComposition } from "@/types/indexes";

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
  private readonly indexCache = new RegulatoryCache<IfixComposition>(24 * 60 * 60_000, 4);
  private marketPromise: Promise<MarketQuote[]> | null = null;
  private readonly validationRunner: ValidationRunner;

  constructor(
    private readonly repository: RegulatoryRepository = regulatoryRepository,
    private readonly scores: ScoreEngine = scoreEngine,
    private readonly health: HealthEngine = healthEngine,
    private readonly timeline: RegulatoryTimeline = regulatoryTimeline,
    private readonly freeReports: FreeReportEngine = freeReportEngine,
    private readonly aiInsights: AIInsightsEngine = aiInsightsEngine,
    private readonly premiumReports: PremiumReportEngine = premiumReportEngine,
    private readonly observability: ObservabilityEngine = observabilityEngine,
    private readonly monitor: AutomaticMonitor = automaticMonitor,
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
    let payload: { values?: unknown[][] } | null = null;
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
        if (!response.ok) throw new Error(`Google Sheets HTTP ${response.status}`);
        payload = await response.json() as { values?: unknown[][] };
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Falha ao consultar cotações.");
        if (attempt < 2) this.observability.recordRetry("market.ingestion");
      }
    }
    if (!payload) throw lastError || new Error("Falha ao consultar cotações.");
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
    ifixCompositionData: IfixComposition | null = null,
  ) {
    const legacy = normalizeDividendFields(legacyRecord?.data || {});
    const publicOverlay = Object.fromEntries(Object.entries(safeRegulatoryOverlay(overlay)).filter(([key]) => key !== "sources"));
    const baseData = applyOfficialFundReference(ticker, {
      ...legacy,
      ...publicOverlay,
      ...(quote || marketFallback(ticker)),
    });
    const officialReference = getOfficialFundReference(ticker);
    const canonical = canonicalFrom(ticker, baseData, overlay);
    const membership = ifixMembership(ticker, canonical.kind, ifixCompositionData);
    const issues = validateRegulatoryFund(canonical);
    const derivedData = deriveFiiRiskData(baseData);
    const publicData = {
      ...baseData,
      ...derivedData,
      code: ticker,
      ticker,
      fundKind: canonical.kind,
      isIFIX: membership.status === "member",
      ifixMembership: membership,
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
        sources: canonical.sources
          .concat(officialReference ? [source(officialReference.sourceName, "regulatory", officialReference.referenceDate)] : [])
          .concat(quote ? [source("Planilha de cotações Dados FII", "market", nowIso())] : []),
        validation: { valid: !issues.some((issue) => issue.severity === "error"), issues },
      },
    } as PublicFundData;
    const safePvp = plausiblePvpValue(publicData.pvp);
    if (safePvp === undefined) delete publicData.pvp;
    else publicData.pvp = safePvp;
    if (publicData.valuation && typeof publicData.valuation === "object" && !Array.isArray(publicData.valuation)) {
      const valuation = { ...(publicData.valuation as Record<string, unknown>) };
      const valuationPvp = plausiblePvpValue(valuation.pvp);
      if (valuationPvp === undefined) delete valuation.pvp;
      else valuation.pvp = valuationPvp;
      publicData.valuation = valuation;
    }
    if (includeScores && scoresEnabled()) publicData.scores = this.scores.calculate(publicData);
    return publicData;
  }

  async getByTicker(value: unknown, options?: { bypassCache?: boolean; marketQuote?: MarketQuote | null }): Promise<PublicFundData | null> {
    return this.observability.track("regulatory.read", async () => {
      const ticker = normalizeTicker(value);
      if (!ticker) return null;
      const cached = options?.bypassCache ? null : this.fundCache.get(ticker);
      if (cached) {
        const cachedQuote = options && "marketQuote" in options
          ? options.marketQuote || null
          : (await this.getMarketQuotes()).find((item) => item.code === ticker) || null;
        return withMarketQuote(cached, cachedQuote, "hit");
      }

      const [legacyRecord, overlay, quotes, ifixCompositionData] = await Promise.all([
        this.repository.getLegacyByTicker(ticker),
        this.repository.getOverlayByTicker(ticker),
        options && "marketQuote" in options ? Promise.resolve([]) : this.getMarketQuotes(),
        this.getIfixComposition(),
      ]);
      const quote = options && "marketQuote" in options ? options.marketQuote : quotes.find((item) => item.code === ticker) || null;
      if (!legacyRecord && !overlay && !quote) return null;

      const publicData = this.composePublicData(ticker, legacyRecord, overlay, quote || null, true, ifixCompositionData);
      this.fundCache.set(ticker, publicData);
      return publicData;
    });
  }

  async listFunds(limit = 500, options?: { includeMarket?: boolean; includeScores?: boolean }) {
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 2_000);
    const [legacyRecords, overlayRecords, quotes, ifixCompositionData] = await Promise.all([
      this.repository.listLegacy(safeLimit),
      this.repository.listOverlays(safeLimit),
      options?.includeMarket === false ? Promise.resolve([] as MarketQuote[]) : this.getMarketQuotes(),
      this.getIfixComposition(),
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
      ifixCompositionData,
    ));
  }

  async getIfixComposition(options?: { force?: boolean }) {
    const cached = options?.force ? null : this.indexCache.get("IFIX");
    if (cached) return cached;
    const composition = await this.repository.getIndexComposition("IFIX");
    if (composition) this.indexCache.set("IFIX", composition);
    return composition;
  }

  async syncIfixComposition(actor: string) {
    const composition = await fetchIfixComposition();
    const persistence = await this.repository.saveIndexComposition(composition, actor);
    this.indexCache.set("IFIX", composition);
    if (persistence.changed) this.invalidate();
    return { composition, ...persistence };
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
    return this.observability.track("timeline.read", async () => {
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
    });
  }

  async getFreeReport(value: unknown): Promise<FreeFundReport | null> {
    return this.observability.track("report.free", async () => {
      const ticker = normalizeTicker(value);
      if (!ticker) return null;
      const [fund, timeline] = await Promise.all([
        this.getByTicker(ticker),
        this.getTimeline(ticker, { limit: 5 }),
      ]);
      if (!fund) return null;
      return this.freeReports.generate(fund, timeline, nowIso());
    });
  }

  async getAIInsights(value: unknown, options?: { requestKey?: string | null }): Promise<FundAIInsights | null> {
    return this.observability.track("ai.insights", async () => {
      const report = await this.getFreeReport(value);
      if (!report) return null;
      return this.aiInsights.generateFundInsights(report, { requestKey: options?.requestKey });
    });
  }

  async getPremiumReport(value: unknown, options?: { requestKey?: string | null; holdings?: Array<{ ticker: string; quotas: number }> }): Promise<PremiumFundReport | null> {
    if (!featureEnabled("ENABLE_REPORT_PREMIUM")) {
      throw new PremiumReportError("Relatório Premium está desabilitado.", "PREMIUM_REPORT_DISABLED", 503);
    }
    return this.observability.track("report.premium", async () => {
      const freeReport = await this.getFreeReport(value);
      if (!freeReport) return null;
      const holdingMap = new Map<string, number>();
      for (const item of options?.holdings || []) {
        const ticker = normalizeTicker(item.ticker);
        const quotas = Number(item.quotas);
        if (ticker && Number.isFinite(quotas) && quotas > 0) holdingMap.set(ticker, quotas);
        if (holdingMap.size >= 120) break;
      }
      const holdings = Array.from(holdingMap, ([ticker, quotas]) => ({ ticker, quotas }));
      const [peers, portfolioData] = await Promise.all([
        this.listFunds(500, { includeMarket: false, includeScores: true }),
        holdings.length ? this.getMany(holdings.map((item) => item.ticker), 120) : Promise.resolve(null),
      ]);
      const portfolioHoldings: PremiumPortfolioHolding[] = holdings.map((item) => ({
        ...item,
        fund: portfolioData?.items[item.ticker] || null,
      }));
      const draft = this.premiumReports.prepare(freeReport, peers, nowIso(), portfolioHoldings);
      const aiAnalysis = await this.aiInsights.generatePremiumInsights(draft, { requestKey: options?.requestKey });
      return this.premiumReports.complete(draft, aiAnalysis);
    });
  }

  async getObservability(): Promise<SystemObservability> {
    const [health, history, auditEvents] = await Promise.all([
      this.getSystemHealth(),
      this.getValidationHistory(1),
      this.repository.getAuditEvents(100),
    ]);
    return this.observability.snapshot({
      health,
      parsers: health.parsers,
      latestValidation: history[0] || null,
      auditEvents,
      fundCache: this.fundCache.stats(),
      marketCache: this.marketCache.stats(),
      aiCache: this.aiInsights.stats(),
      generatedAt: nowIso(),
    });
  }

  getMonitorStatus(limit = 20): Promise<MonitorStatus> {
    return this.repository.getMonitorStatus(limit);
  }

  async runAutomaticMonitor(actor: string): Promise<MonitorRun> {
    return this.observability.track("monitor.run", async () => {
      try {
        const [health, history] = await Promise.all([this.getSystemHealth(), this.getValidationHistory(1)]);
        return await this.monitor.run({ actor, health, parsers: health.parsers, latestValidation: history[0] || null });
      } catch (error) {
        if (error instanceof Error && error.name === "AutomaticMonitorError") throw error;
        await this.monitor.failed(actor, error);
        throw error;
      }
    });
  }

  async publish(ticker: unknown, patch: Record<string, unknown>, authorization: PublicationAuthorization) {
    return this.observability.track("regulatory.publish", async () => {
      const result = await this.repository.publish(ticker, patch, authorization);
      this.invalidate(String(ticker));
      return result;
    });
  }

  async publishOfficialFundReference(tickerInput: unknown, actor: string) {
    const ticker = normalizeTicker(tickerInput);
    const reference = getOfficialFundReference(ticker);
    if (!reference) throw new Error("Não existe referência oficial cadastrada para este fundo.");
    const approvedAt = nowIso();
    const patch = {
      cnpj: reference.cnpj,
      ...(reference.corporateName ? { socialReason: reference.corporateName, corporateName: reference.corporateName } : {}),
      ...(reference.manager ? { manager: reference.manager } : {}),
      ...(reference.managerCnpj ? { managerCnpj: reference.managerCnpj } : {}),
      ...(reference.administrator ? { administrator: reference.administrator } : {}),
      ...(reference.administratorCnpj ? { administratorCnpj: reference.administratorCnpj } : {}),
      ...(reference.vpCota !== undefined ? {
        vpCota: reference.vpCota,
        valorPatrimonialPorCota: reference.vpCota,
        valuationReferenceDate: reference.referenceDate,
        valuationSource: reference.sourceUrl,
      } : {}),
      sources: [source(reference.sourceName, "regulatory", approvedAt)],
    };
    const approvalHash = createHash("sha256")
      .update([ticker, actor, approvedAt, reference.sourceUrl, JSON.stringify(patch)].join(":"), "utf8")
      .digest("hex");
    return this.publish(ticker, patch, {
      actor,
      approvalHash,
      approvedAt,
      backupId: `official-${ticker}-${Date.now()}`,
      reason: `Publicação dos dados oficiais disponíveis de ${ticker}.`,
    });
  }

  async rollback(ticker: unknown, versionId: string, authorization: RollbackAuthorization) {
    return this.observability.track("regulatory.rollback", async () => {
      const result = await this.repository.rollback(ticker, versionId, authorization);
      this.invalidate(String(ticker));
      return result;
    });
  }

  async runValidation(actor: string, options?: { limit?: number }): Promise<ValidationRun> {
    return this.observability.track("validation.run", async () => {
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
    });
  }

  getValidationHistory(limit = 20) {
    return this.repository.getValidationHistory(limit);
  }

  getParserHealth() {
    return this.repository.getParserHealth();
  }

  async getSystemHealth(): Promise<SystemHealth> {
    return this.observability.track("system.health", async () => {
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
