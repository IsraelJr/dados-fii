import { productPlanLabel } from "@/lib/productPlans";
import type { PublicFundData } from "@/types/regulatory";
import type { RegulatoryTimelineResponse } from "@/types/timeline";
import {
  FundRadarError,
  fundRadarLimit,
  normalizeFundRadarTicker,
  type FundRadarEntry,
  type FundRadarUpdate,
} from "./FundRadar";
import {
  createFundRadarObservation,
  detectFundRadarUpdates,
  latestFundRadarDividend,
} from "./FundRadarObservation";
import type { FundRadarRepository, FundRadarSubject } from "./FundRadarRepository";

export interface FundRadarDataSource {
  getByTicker(ticker: string): Promise<PublicFundData | null>;
  getTimeline(ticker: string, options?: { limit?: number }): Promise<RegulatoryTimelineResponse | null>;
}

export type FundRadarFundView = Readonly<{
  ticker: string;
  status: FundRadarEntry["status"];
  notificationsEnabled: boolean;
  name: string | null;
  segment: string | null;
  type: string | null;
  quality: Readonly<{
    status: string;
    confidence: number | null;
    missingFields: readonly string[];
    invalidFields: readonly string[];
  }>;
  lastDividend: ReturnType<typeof latestFundRadarDividend>;
  recentEvents: readonly Readonly<{
    id: string;
    title: string;
    type: string;
    source: string;
    asOf: string | null;
    url: string | null;
  }>[];
  signals: Readonly<{
    riskScore: number | null;
    confidence: number | null;
    level: string | null;
    reasons: readonly string[];
  }>;
  asOf: string | null;
  insufficientData: boolean;
  dataUnavailable: boolean;
}>;

function stringValue(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return null;
}

function latestSourceDate(fund: PublicFundData) {
  const candidates = [
    fund.marketDataUpdatedAt,
    ...fund.regulatoryMeta.sources.flatMap((source) => [source.fetchedAt]),
  ].filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)));
  return candidates.sort().at(-1) || null;
}

export function fundRadarFundView(
  entry: FundRadarEntry,
  fund: PublicFundData | null,
  timeline: RegulatoryTimelineResponse | null,
): FundRadarFundView {
  if (!fund) {
    return Object.freeze({
      ticker: entry.ticker,
      status: entry.status,
      notificationsEnabled: entry.notificationsEnabled,
      name: null,
      segment: null,
      type: null,
      quality: Object.freeze({ status: "unavailable", confidence: null, missingFields: Object.freeze([]), invalidFields: Object.freeze([]) }),
      lastDividend: null,
      recentEvents: Object.freeze([]),
      signals: Object.freeze({ riskScore: null, confidence: null, level: null, reasons: Object.freeze([]) }),
      asOf: null,
      insufficientData: true,
      dataUnavailable: true,
    });
  }
  const assessment = fund.regulatoryMeta.validation.assessment;
  const missingFields = Object.freeze([...(assessment?.missingFields || [])].sort());
  const invalidFields = Object.freeze([...(assessment?.invalidFields || [])].sort());
  const risk = fund.scores?.risk;
  return Object.freeze({
    ticker: entry.ticker,
    status: entry.status,
    notificationsEnabled: entry.notificationsEnabled,
    name: stringValue(fund.name, fund.socialReason, fund.corporateName, fund.razao_social),
    segment: stringValue(fund.segment_new, fund.segment, fund.segmento),
    type: stringValue(fund.fundKind, fund.kind, fund.type),
    quality: Object.freeze({
      status: assessment?.status || fund.regulatoryMeta.validation.status || (fund.regulatoryMeta.validation.valid ? "valid" : "unavailable"),
      confidence: typeof assessment?.confidence === "number" ? assessment.confidence : null,
      missingFields,
      invalidFields,
    }),
    lastDividend: latestFundRadarDividend(fund),
    recentEvents: Object.freeze((timeline?.items || []).slice(0, 5).map((item) => Object.freeze({
      id: item.id,
      title: item.title,
      type: item.type,
      source: item.source,
      asOf: item.occurredAt || item.publishedAt || null,
      url: item.url || null,
    }))),
    signals: Object.freeze({
      riskScore: typeof risk?.score === "number" ? risk.score : null,
      confidence: typeof risk?.confidence === "number" ? risk.confidence : null,
      level: risk?.level || null,
      reasons: Object.freeze([...(risk?.reasons || [])].slice(0, 4)),
    }),
    asOf: latestSourceDate(fund),
    insufficientData: !assessment || assessment.status !== "valid" || missingFields.length > 0 || invalidFields.length > 0,
    dataUnavailable: false,
  });
}

function activeFund(fund: PublicFundData) {
  const status = String(fund.status || "").trim().toLowerCase();
  return fund.active !== false && status !== "inactive" && status !== "closed" && status !== "encerrado";
}

export class FundRadarService {
  constructor(
    private readonly repository: FundRadarRepository,
    private readonly dataSource: FundRadarDataSource,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private nowIso() {
    return this.now().toISOString();
  }

  private async canonical(ticker: string) {
    const fund = await this.dataSource.getByTicker(ticker);
    if (!fund) throw new FundRadarError("FUND_RADAR_FUND_NOT_FOUND", 404);
    if (!activeFund(fund)) throw new FundRadarError("FUND_RADAR_FUND_INACTIVE", 409);
    const timeline = await this.dataSource.getTimeline(ticker, { limit: 10 });
    return { fund, timeline };
  }

  private async view(entry: FundRadarEntry) {
    try {
      const [fund, timeline] = await Promise.all([
        this.dataSource.getByTicker(entry.ticker),
        this.dataSource.getTimeline(entry.ticker, { limit: 10 }),
      ]);
      return fundRadarFundView(entry, fund, timeline);
    } catch {
      return fundRadarFundView(entry, null, null);
    }
  }

  private response(subject: FundRadarSubject, entries: readonly FundRadarEntry[], funds: readonly FundRadarFundView[], updates: readonly FundRadarUpdate[]) {
    const limit = fundRadarLimit(subject.plan);
    return Object.freeze({
      plan: subject.plan,
      planLabel: productPlanLabel(subject.plan),
      limit,
      activeCount: entries.filter((entry) => entry.status === "active").length,
      funds,
      updates: Object.freeze([...updates].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 50)),
    });
  }

  async list(subject: FundRadarSubject) {
    const account = await this.repository.reconcile(subject, this.nowIso());
    const entries = account.entries.filter((entry) => entry.status !== "removed");
    const funds = await Promise.all(entries.map((entry) => this.view(entry)));
    return this.response(subject, entries, funds, account.updates);
  }

  async follow(subject: FundRadarSubject, tickerInput: unknown) {
    const ticker = normalizeFundRadarTicker(tickerInput);
    const { fund, timeline } = await this.canonical(ticker);
    const result = await this.repository.start({
      subject,
      ticker,
      observation: createFundRadarObservation(fund, timeline),
      now: this.nowIso(),
    });
    const entry = result.account.entries.find((item) => item.ticker === ticker)!;
    return Object.freeze({
      created: result.created,
      fund: fundRadarFundView(entry, fund, timeline),
      limit: fundRadarLimit(subject.plan),
      activeCount: result.account.entries.filter((item) => item.status === "active").length,
    });
  }

  async remove(subject: FundRadarSubject, tickerInput: unknown) {
    const ticker = normalizeFundRadarTicker(tickerInput);
    const result = await this.repository.remove({ subject, ticker, now: this.nowIso() });
    return Object.freeze({
      ticker,
      removed: result.removed,
      limit: fundRadarLimit(subject.plan),
      activeCount: result.account.entries.filter((item) => item.status === "active").length,
    });
  }

  async setNotifications(subject: FundRadarSubject, tickerInput: unknown, enabled: boolean) {
    const ticker = normalizeFundRadarTicker(tickerInput);
    const account = await this.repository.setNotifications({ subject, ticker, enabled, now: this.nowIso() });
    return Object.freeze({ ticker, notificationsEnabled: enabled, activeCount: account.entries.filter((item) => item.status === "active").length });
  }

  async refresh(subject: FundRadarSubject) {
    const account = await this.repository.reconcile(subject, this.nowIso());
    const entries = account.entries.filter((entry) => entry.status === "active");
    const created: FundRadarUpdate[] = [];
    for (const entry of entries) {
      const { fund, timeline } = await this.canonical(entry.ticker);
      const current = createFundRadarObservation(fund, timeline);
      const now = this.nowIso();
      const updates = detectFundRadarUpdates({
        ticker: entry.ticker,
        previous: entry.lastObservation,
        current,
        fund,
        timeline,
        now,
      });
      try {
        const result = await this.repository.recordObservation({
          subject,
          ticker: entry.ticker,
          expectedPreviousFingerprint: entry.lastProcessedFingerprint,
          observation: current,
          updates,
          now,
        });
        created.push(...result.createdUpdates);
      } catch (error) {
        if (!(error instanceof FundRadarError) || error.code !== "FUND_RADAR_OBSERVATION_STALE") throw error;
      }
    }
    return Object.freeze({ processed: entries.length, createdUpdates: Object.freeze(created) });
  }
}
