import { createHash } from "crypto";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import {
  REGULATORY_SCHEMA_VERSION,
  type FundKind,
  type MarketQuote,
  type ParserHealth,
  type PublicFundData,
  type RegulatoryFund,
  type RegulatorySource,
  type SystemHealth,
  type ValidationFundResult,
  type ValidationIssue,
  type ValidationRun,
} from "@/types/regulatory";

export const REGULATORY_COLLECTIONS = {
  legacyFunds: "Fiis",
  funds: "RegulatoryFunds",
  versions: "RegulatoryFundVersions",
  validationRuns: "RegulatoryValidationRuns",
  parserHealth: "RegulatoryParserHealth",
  auditLogs: "RegulatoryAuditLogs",
} as const;

const FUND_CACHE_TTL_MS = positiveInt(process.env.REGULATORY_CACHE_TTL_MS, 5 * 60_000);
const MARKET_CACHE_TTL_MS = positiveInt(process.env.REGULATORY_MARKET_CACHE_TTL_MS, 60_000);
const MAX_CACHE_ENTRIES = positiveInt(process.env.REGULATORY_CACHE_MAX_ENTRIES, 500);
const GOOGLE_SHEET_RANGE = "A1:F400";
const PARSER_VERSION = "regulatory-v1";

type CacheEntry = { expiresAt: number; value: PublicFundData };
type LegacyRecord = { id: string; data: Record<string, unknown> };
type CanonicalRecord = RegulatoryFund & Record<string, unknown>;
type AuditAction = "publish" | "rollback" | "validation";

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeTicker(value: unknown) {
  const ticker = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(ticker) ? ticker : "";
}

function stringValue(value: unknown): string | null {
  const result = String(value ?? "").trim();
  return result || null;
}

function firstString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = stringValue(data[key]);
    if (value) return value;
  }
  return null;
}

export function inferFundKind(data: Record<string, unknown>): FundKind {
  const haystack = [data.kind, data.fundKind, data.type, data.tipo, data.segment, data.segmento, data.sector]
    .map((value) => String(value || "").toUpperCase())
    .join(" ");
  if (/FIAGRO|AGRO|CRA/.test(haystack)) return "FIAGRO";
  if (/FI.?INFRA|INFRAESTRUTURA/.test(haystack)) return "FI_INFRA";
  if (/FII|IMOBILI|RECEBÍVEIS|RECEBIVEIS|SHOPPING|LOGÍSTIC|LOGISTIC|LAJE|HÍBRID|HIBRID/.test(haystack)) return "FII";
  const ticker = normalizeTicker(data.ticker || data.code);
  return ticker.endsWith("11") ? "FII" : "UNKNOWN";
}

function normalizeCnpj(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 14 ? digits : "";
}

function validCnpj(value: unknown) {
  const digits = normalizeCnpj(value);
  if (!digits || /^(\d)\1+$/.test(digits)) return false;
  const calculate = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(digits[12]) && calculate(13) === Number(digits[13]);
}

export function validateRegulatoryFund(fund: RegulatoryFund): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!normalizeTicker(fund.ticker)) issues.push({ code: "invalid_ticker", field: "ticker", message: "Ticker ausente ou inválido.", severity: "error" });
  if (fund.kind === "UNKNOWN") issues.push({ code: "unknown_fund_kind", field: "kind", message: "Tipo FII/FIAGRO não identificado.", severity: "error" });
  if (!fund.name && !fund.corporateName) issues.push({ code: "missing_name", field: "name", message: "Nome do fundo não informado.", severity: "warning" });
  if (!fund.cnpj) issues.push({ code: "missing_cnpj", field: "cnpj", message: "CNPJ não informado.", severity: "warning" });
  else if (!validCnpj(fund.cnpj)) issues.push({ code: "invalid_cnpj", field: "cnpj", message: "CNPJ com formato ou dígitos inválidos.", severity: "error" });
  if (!fund.segment) issues.push({ code: "missing_segment", field: "segment", message: "Segmento não informado.", severity: "warning" });
  if (!fund.sources.length) issues.push({ code: "missing_source", field: "sources", message: "Fonte regulatória não identificada.", severity: "error" });
  return issues;
}

function source(provider: string, kind: RegulatorySource["kind"], fetchedAt?: string | null): RegulatorySource {
  return { provider, kind, fetchedAt: fetchedAt || null, parserVersion: PARSER_VERSION };
}

function canonicalFrom(ticker: string, legacy: Record<string, unknown>, overlay?: Record<string, unknown> | null): RegulatoryFund {
  const merged: Record<string, unknown> = { ...legacy, ...(overlay || {}), ticker, code: ticker };
  const overlaySources = Array.isArray(overlay?.sources) ? overlay?.sources as RegulatorySource[] : [];
  const sources = [...(Object.keys(legacy).length ? [source("Base interna Dados FII", "legacy", toIso(legacy.modified_in || legacy.updatedAt))] : []), ...overlaySources]
    .filter((item) => item && typeof item === "object" && typeof item.provider === "string" && typeof item.kind === "string")
    .filter((item, index, list) => list.findIndex((candidate) => candidate.provider === item.provider && candidate.kind === item.kind) === index);
  return {
    schemaVersion: REGULATORY_SCHEMA_VERSION,
    ticker,
    kind: inferFundKind(merged),
    name: firstString(merged, ["name", "fundName", "fantasyName", "nome"]),
    corporateName: firstString(merged, ["corporateName", "company_name", "razaoSocial", "razãoSocial"]),
    cnpj: firstString(merged, ["cnpj", "CNPJ"]),
    segment: firstString(merged, ["segment", "segmento", "sector"]),
    manager: firstString(merged, ["manager", "gestor", "management"]),
    administrator: firstString(merged, ["administrator", "administrador", "admin"]),
    status: ["active", "inactive"].includes(String(merged.status)) ? merged.status as "active" | "inactive" : "unknown",
    currentVersion: Number(overlay?.currentVersion || 0),
    publishedAt: toIso(overlay?.publishedAt),
    publishedBy: stringValue(overlay?.publishedBy),
    sources,
    raw: merged,
  };
}

function normalizeDividendFields(data: Record<string, unknown>) {
  const normalized = { ...data };
  for (const key of Object.keys(normalized)) {
    const year = normalized[key];
    if (!/^earnings\d{4}$/.test(key) || !year || typeof year !== "object" || Array.isArray(year)) continue;
    normalized[key] = Object.fromEntries(Object.entries(year).map(([month, item]) => {
      const info = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const number = Number(String(info.earnings || "0").replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
      return [month, { ...info, earnings: number ? `R$ ${number.toFixed(3).replace(".", ",")}` : info.earnings || "" }];
    }));
  }
  return normalized;
}

function marketFallback(ticker: string): MarketQuote {
  return { code: ticker, price: "-", opening: "-", variation: "-", minimum: "-", maximum: "-" };
}

function withMarketQuote(value: PublicFundData, quote: MarketQuote | null, cache: "hit" | "miss"): PublicFundData {
  const fundSource = value.fundDataSource || null;
  return {
    ...value,
    ...(quote || marketFallback(value.ticker)),
    code: value.ticker,
    ticker: value.ticker,
    dataSources: {
      price: quote ? "Planilha de cotações Dados FII" : "Preço indisponível",
      fund: fundSource ? "Base interna Dados FII" : "Dados cadastrais/dividendos indisponíveis",
      regulatory: value.regulatoryMeta.currentVersion ? "Base regulatória versionada Dados FII" : "Sem overlay regulatório publicado",
    },
    marketDataSource: quote ? "Planilha de cotações Dados FII" : null,
    marketDataUpdatedAt: quote ? nowIso() : null,
    regulatoryMeta: { ...value.regulatoryMeta, cache },
  };
}

class RegulatoryDataService {
  private fundCache = new Map<string, CacheEntry>();
  private marketCache: { expiresAt: number; items: MarketQuote[] } | null = null;
  private marketPromise: Promise<MarketQuote[]> | null = null;

  private trimCache() {
    while (this.fundCache.size > MAX_CACHE_ENTRIES) {
      const oldest = this.fundCache.keys().next().value as string | undefined;
      if (!oldest) break;
      this.fundCache.delete(oldest);
    }
  }

  invalidate(ticker?: string) {
    if (ticker) this.fundCache.delete(normalizeTicker(ticker));
    else this.fundCache.clear();
  }

  private async legacyByTicker(ticker: string): Promise<LegacyRecord | null> {
    const direct = await adminDb.collection(REGULATORY_COLLECTIONS.legacyFunds).doc(ticker).get();
    if (direct.exists) return { id: direct.id, data: direct.data() as Record<string, unknown> };
    const query = await adminDb.collection(REGULATORY_COLLECTIONS.legacyFunds).where("code", "==", ticker).limit(1).get();
    if (query.empty) return null;
    return { id: query.docs[0].id, data: query.docs[0].data() as Record<string, unknown> };
  }

  private async overlayByTicker(ticker: string) {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.funds).doc(ticker).get();
    return snapshot.exists ? snapshot.data() as Record<string, unknown> : null;
  }

  async getMarketQuotes(options?: { force?: boolean }) {
    if (!options?.force && this.marketCache && this.marketCache.expiresAt > Date.now()) return this.marketCache.items;
    if (this.marketPromise) return this.marketPromise;
    this.marketPromise = this.fetchMarketQuotes();
    try {
      const items = await this.marketPromise;
      this.marketCache = { items, expiresAt: Date.now() + MARKET_CACHE_TTL_MS };
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

  async getByTicker(value: unknown, options?: { bypassCache?: boolean; marketQuote?: MarketQuote | null }): Promise<PublicFundData | null> {
    const ticker = normalizeTicker(value);
    if (!ticker) return null;
    const cached = this.fundCache.get(ticker);
    if (!options?.bypassCache && cached && cached.expiresAt > Date.now()) {
      const cachedQuote = options && "marketQuote" in options
        ? options.marketQuote || null
        : (await this.getMarketQuotes()).find((item) => item.code === ticker) || null;
      return withMarketQuote(cached.value, cachedQuote, "hit");
    }

    const [legacyRecord, overlay, quotes] = await Promise.all([
      this.legacyByTicker(ticker),
      this.overlayByTicker(ticker),
      options && "marketQuote" in options ? Promise.resolve([]) : this.getMarketQuotes(),
    ]);
    const quote = options && "marketQuote" in options ? options.marketQuote : quotes.find((item) => item.code === ticker) || null;
    if (!legacyRecord && !overlay && !quote) return null;

    const legacy = normalizeDividendFields(legacyRecord?.data || {});
    const canonical = canonicalFrom(ticker, legacy, overlay);
    const issues = validateRegulatoryFund(canonical);
    const rawOverlay = overlay ? Object.fromEntries(Object.entries(overlay).filter(([key]) => !["raw", "sources"].includes(key))) : {};
    const publicData = {
      ...legacy,
      ...rawOverlay,
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
    this.fundCache.set(ticker, { value: publicData, expiresAt: Date.now() + FUND_CACHE_TTL_MS });
    this.trimCache();
    return publicData;
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

  async publish(tickerInput: unknown, patch: Record<string, unknown>, actor: string, reason?: string) {
    const ticker = normalizeTicker(tickerInput);
    if (!ticker) throw new Error("Ticker inválido.");
    if (!actor) throw new Error("Ator administrativo obrigatório.");
    const currentRef = adminDb.collection(REGULATORY_COLLECTIONS.funds).doc(ticker);
    const auditRef = adminDb.collection(REGULATORY_COLLECTIONS.auditLogs).doc();
    const result = await adminDb.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(currentRef);
      const current = currentSnapshot.data() || {};
      const nextVersion = Number(current.currentVersion || 0) + 1;
      const versionId = `v${String(nextVersion).padStart(6, "0")}`;
      const versionRef = adminDb.collection(REGULATORY_COLLECTIONS.versions).doc(ticker).collection("versions").doc(versionId);
      const next = {
        ...current,
        ...patch,
        ticker,
        code: ticker,
        schemaVersion: REGULATORY_SCHEMA_VERSION,
        currentVersion: nextVersion,
        publishedAt: adminFieldValue.serverTimestamp(),
        publishedBy: actor,
        sources: Array.isArray(patch.sources) ? patch.sources : current.sources || [source("Admin Dados FII", "manual", nowIso())],
      };
      const normalized = canonicalFrom(ticker, {}, next);
      const issues = validateRegulatoryFund(normalized);
      if (issues.some((issue) => issue.severity === "error")) throw new Error(`Publicação bloqueada: ${issues.filter((issue) => issue.severity === "error").map((issue) => issue.message).join(" ")}`);
      transaction.set(versionRef, { ...next, versionId, createdAt: adminFieldValue.serverTimestamp(), createdBy: actor, reason: reason || null });
      transaction.set(currentRef, next, { merge: false });
      transaction.set(auditRef, this.auditPayload("publish", actor, ticker, { versionId, reason: reason || null }));
      return { ticker, versionId, currentVersion: nextVersion, issues };
    });
    this.invalidate(ticker);
    return result;
  }

  async rollback(tickerInput: unknown, versionId: string, actor: string, reason?: string) {
    const ticker = normalizeTicker(tickerInput);
    if (!ticker || !/^v\d{6}$/.test(versionId)) throw new Error("Ticker ou versão inválida.");
    const currentRef = adminDb.collection(REGULATORY_COLLECTIONS.funds).doc(ticker);
    const versionRef = adminDb.collection(REGULATORY_COLLECTIONS.versions).doc(ticker).collection("versions").doc(versionId);
    const auditRef = adminDb.collection(REGULATORY_COLLECTIONS.auditLogs).doc();
    const result = await adminDb.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(currentRef);
      const versionSnapshot = await transaction.get(versionRef);
      if (!versionSnapshot.exists) throw new Error("Versão regulatória não encontrada.");
      const current = currentSnapshot.data() || {};
      const restored = versionSnapshot.data() || {};
      const nextVersion = Number(current.currentVersion || 0) + 1;
      const rollbackVersionId = `v${String(nextVersion).padStart(6, "0")}`;
      const rollbackVersionRef = adminDb.collection(REGULATORY_COLLECTIONS.versions).doc(ticker).collection("versions").doc(rollbackVersionId);
      const next = { ...restored, ticker, code: ticker, currentVersion: nextVersion, rolledBackFrom: versionId, publishedAt: adminFieldValue.serverTimestamp(), publishedBy: actor };
      transaction.set(rollbackVersionRef, { ...next, versionId: rollbackVersionId, createdAt: adminFieldValue.serverTimestamp(), createdBy: actor, reason: reason || `Rollback para ${versionId}` });
      transaction.set(currentRef, next, { merge: false });
      transaction.set(auditRef, this.auditPayload("rollback", actor, ticker, { fromVersion: current.currentVersion || 0, restoredVersion: versionId, versionId: rollbackVersionId, reason: reason || null }));
      return { ticker, restoredVersion: versionId, versionId: rollbackVersionId, currentVersion: nextVersion };
    });
    this.invalidate(ticker);
    return result;
  }

  private auditPayload(action: AuditAction, actor: string, ticker?: string, metadata?: Record<string, unknown>) {
    return { action, actor, ticker: ticker || null, metadata: metadata || {}, createdAt: adminFieldValue.serverTimestamp(), createdAtIso: nowIso() };
  }

  async runValidation(actor: string, options?: { limit?: number }): Promise<ValidationRun> {
    const startedAt = nowIso();
    const startedMs = Date.now();
    const limit = Math.min(Math.max(Number(options?.limit || 400), 1), 500);
    const [legacySnapshot, overlaySnapshot, marketResult] = await Promise.all([
      adminDb.collection(REGULATORY_COLLECTIONS.legacyFunds).limit(limit).get(),
      adminDb.collection(REGULATORY_COLLECTIONS.funds).limit(limit).get(),
      this.getMarketQuotes({ force: true }).then((items) => ({ items, error: null as string | null })).catch((error: Error) => ({ items: [] as MarketQuote[], error: error.message })),
    ]);
    const overlayMap = new Map(overlaySnapshot.docs.map((doc) => [normalizeTicker(doc.id || doc.data().ticker), doc.data() as Record<string, unknown>]));
    const legacyRecords = legacySnapshot.docs.map((doc) => ({ ticker: normalizeTicker(doc.data().code || doc.id), data: doc.data() as Record<string, unknown> })).filter((item) => item.ticker);
    const results: ValidationFundResult[] = legacyRecords.map(({ ticker, data }) => {
      const fund = canonicalFrom(ticker, data, overlayMap.get(ticker));
      const issues = validateRegulatoryFund(fund);
      return { ticker, kind: fund.kind, valid: !issues.some((issue) => issue.severity === "error"), issues };
    });
    const errors = results.reduce((total, item) => total + item.issues.filter((issue) => issue.severity === "error").length, 0);
    const warnings = results.reduce((total, item) => total + item.issues.filter((issue) => issue.severity === "warning").length, 0);
    const valid = results.filter((item) => item.valid).length;
    const parserHealth: ParserHealth[] = [
      this.parser("legacy-firestore", legacyRecords.length ? "healthy" : "down", legacyRecords.length, legacyRecords.length ? 0 : 1, null),
      this.parser("regulatory-overlay", overlaySnapshot.size || legacyRecords.length ? "healthy" : "unknown", overlaySnapshot.size, 0, null),
      this.parser("google-sheets", marketResult.error ? "down" : marketResult.items.length ? "healthy" : "degraded", marketResult.items.length, marketResult.error ? 1 : 0, marketResult.error),
    ];
    const dataScore = results.length ? (valid / results.length) * 80 : 0;
    const parserScore = parserHealth.reduce((sum, parser) => sum + parser.successRate, 0) / Math.max(parserHealth.length, 1) * 0.2;
    const runRef = adminDb.collection(REGULATORY_COLLECTIONS.validationRuns).doc();
    const run: ValidationRun = {
      id: runRef.id,
      status: "completed",
      startedAt,
      finishedAt: nowIso(),
      durationMs: Date.now() - startedMs,
      actor,
      totals: { processed: results.length, valid, invalid: results.length - valid, errors, warnings },
      healthScore: Math.round(Math.max(0, Math.min(100, dataScore + parserScore))),
      results,
      parserHealth,
    };
    const batch = adminDb.batch();
    batch.set(runRef, { ...run, results: results.slice(0, 250), createdAt: adminFieldValue.serverTimestamp() });
    parserHealth.forEach((parser) => batch.set(adminDb.collection(REGULATORY_COLLECTIONS.parserHealth).doc(parser.parser), parser, { merge: true }));
    batch.set(adminDb.collection(REGULATORY_COLLECTIONS.auditLogs).doc(), this.auditPayload("validation", actor, undefined, { runId: run.id, totals: run.totals, healthScore: run.healthScore }));
    await batch.commit();
    return run;
  }

  private parser(parser: string, status: ParserHealth["status"], successes: number, failures: number, error: string | null): ParserHealth {
    const total = successes + failures;
    return {
      parser,
      status,
      successRate: total ? Math.round((successes / total) * 100) : 0,
      successes,
      failures,
      lastSuccessAt: successes ? nowIso() : null,
      lastFailureAt: failures ? nowIso() : null,
      lastError: error,
      updatedAt: nowIso(),
    };
  }

  async getValidationHistory(limit = 20): Promise<ValidationRun[]> {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.validationRuns).orderBy("createdAt", "desc").limit(Math.min(Math.max(limit, 1), 50)).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data() as ValidationRun & { createdAt?: unknown };
      return { ...data, id: doc.id, startedAt: toIso(data.startedAt) || data.startedAt, finishedAt: toIso(data.finishedAt) || data.finishedAt };
    });
  }

  async getParserHealth(): Promise<ParserHealth[]> {
    const snapshot = await adminDb.collection(REGULATORY_COLLECTIONS.parserHealth).get();
    return snapshot.docs.map((doc) => ({ ...(doc.data() as ParserHealth), parser: doc.id })).sort((a, b) => a.parser.localeCompare(b.parser));
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const [history, parsers] = await Promise.all([this.getValidationHistory(1), this.getParserHealth()]);
    const latest = history[0] || null;
    const score = latest?.healthScore || 0;
    const latestValidation = latest ? Object.fromEntries(Object.entries(latest).filter(([key]) => key !== "results")) as Omit<ValidationRun, "results"> : null;
    return {
      ok: score >= 80 && parsers.every((parser) => !["down"].includes(parser.status)),
      score,
      generatedAt: nowIso(),
      latestValidation,
      parsers,
      cache: { entries: this.fundCache.size, ttlMs: FUND_CACHE_TTL_MS, marketTtlMs: MARKET_CACHE_TTL_MS },
      collections: REGULATORY_COLLECTIONS,
    };
  }

  requestFingerprint(parts: string[]) {
    return createHash("sha256").update(parts.join(":"), "utf8").digest("hex").slice(0, 24);
  }
}

export const regulatoryDataService = new RegulatoryDataService();
export type { RegulatoryDataService };
