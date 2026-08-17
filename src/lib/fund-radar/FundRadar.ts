import { monitoredFundLimit, type ProductPlan } from "@/lib/productPlans";

export const FUND_RADAR_SCHEMA_VERSION = 1 as const;

export type FundRadarStatus = "active" | "paused_by_plan" | "in_portfolio" | "removed";

export type FundRadarObservation = Readonly<{
  fingerprint: string;
  dividendFingerprint: string | null;
  timelineFingerprints: readonly string[];
  qualityFingerprint: string;
  signalFingerprint: string;
}>;

export type FundRadarEntry = Readonly<{
  ticker: string;
  status: FundRadarStatus;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  removedAt: string | null;
  lastProcessedFingerprint: string | null;
  lastObservation: FundRadarObservation | null;
}>;

export type FundRadarUpdate = Readonly<{
  fingerprint: string;
  ticker: string;
  kind: "dividend" | "regulatory_event" | "data_quality" | "deterministic_signal";
  title: string;
  whatChanged: string;
  whyItMatters: string;
  source: string;
  asOf: string | null;
  missingData: readonly string[];
  createdAt: string;
  delivery: Readonly<{
    status: "pending" | "sending" | "sent";
    attemptCount: number;
    leaseUntil: string | null;
    sentAt: string | null;
  }>;
}>;

export type FundRadarAccount = Readonly<{
  schemaVersion: typeof FUND_RADAR_SCHEMA_VERSION;
  entries: readonly FundRadarEntry[];
  updates: readonly FundRadarUpdate[];
}>;

export type FundRadarErrorCode =
  | "FUND_RADAR_INVALID_TICKER"
  | "FUND_RADAR_FUND_NOT_FOUND"
  | "FUND_RADAR_FUND_INACTIVE"
  | "FUND_RADAR_FUND_IN_PORTFOLIO"
  | "FUND_RADAR_LIMIT_REACHED"
  | "FUND_RADAR_FOLLOW_NOT_FOUND"
  | "FUND_RADAR_OBSERVATION_STALE";

export class FundRadarError extends Error {
  readonly code: FundRadarErrorCode;
  readonly status: 400 | 404 | 409 | 422;

  constructor(code: FundRadarErrorCode, status: FundRadarError["status"]) {
    super(code);
    this.name = "FundRadarError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeFundRadarTicker(value: unknown) {
  const ticker = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{4,6}\d{1,2}$/.test(ticker)) {
    throw new FundRadarError("FUND_RADAR_INVALID_TICKER", 400);
  }
  return ticker;
}

export function fundRadarLimit(plan: ProductPlan) {
  return monitoredFundLimit(plan);
}

function entryOrder(left: FundRadarEntry, right: FundRadarEntry) {
  return left.createdAt.localeCompare(right.createdAt) || left.ticker.localeCompare(right.ticker);
}

function updatedEntry(entry: FundRadarEntry, status: FundRadarStatus, now: string): FundRadarEntry {
  if (entry.status === status) return entry;
  return Object.freeze({
    ...entry,
    status,
    updatedAt: now,
  });
}

export function reconcileFundRadarEntries(input: Readonly<{
  entries: readonly FundRadarEntry[];
  plan: ProductPlan;
  walletTickers: ReadonlySet<string>;
  now: string;
}>) {
  const activeCandidates = input.entries
    .filter((entry) => entry.status !== "removed" && !input.walletTickers.has(entry.ticker))
    .sort(entryOrder);
  const activeTickers = new Set(activeCandidates.slice(0, fundRadarLimit(input.plan)).map((entry) => entry.ticker));

  return Object.freeze(input.entries
    .map((entry) => {
      if (entry.status === "removed") return entry;
      if (input.walletTickers.has(entry.ticker)) return updatedEntry(entry, "in_portfolio", input.now);
      return updatedEntry(entry, activeTickers.has(entry.ticker) ? "active" : "paused_by_plan", input.now);
    })
    .sort(entryOrder));
}

export function startFundRadarFollow(input: Readonly<{
  account: FundRadarAccount;
  ticker: unknown;
  plan: ProductPlan;
  walletTickers: ReadonlySet<string>;
  observation: FundRadarObservation;
  now: string;
}>) {
  const ticker = normalizeFundRadarTicker(input.ticker);
  if (input.walletTickers.has(ticker)) {
    throw new FundRadarError("FUND_RADAR_FUND_IN_PORTFOLIO", 409);
  }
  const reconciled = reconcileFundRadarEntries({
    entries: input.account.entries,
    plan: input.plan,
    walletTickers: input.walletTickers,
    now: input.now,
  });
  const existing = reconciled.find((entry) => entry.ticker === ticker && entry.status !== "removed");
  if (existing) {
    return Object.freeze({ account: Object.freeze({ ...input.account, entries: reconciled }), entry: existing, created: false });
  }
  if (reconciled.filter((entry) => entry.status === "active").length >= fundRadarLimit(input.plan)) {
    throw new FundRadarError("FUND_RADAR_LIMIT_REACHED", 422);
  }

  const entry: FundRadarEntry = Object.freeze({
    ticker,
    status: "active",
    notificationsEnabled: true,
    createdAt: input.now,
    updatedAt: input.now,
    removedAt: null,
    lastProcessedFingerprint: input.observation.fingerprint,
    lastObservation: input.observation,
  });
  const entries = Object.freeze([
    ...reconciled.filter((item) => item.ticker !== ticker),
    entry,
  ].sort(entryOrder));
  return Object.freeze({ account: Object.freeze({ ...input.account, entries }), entry, created: true });
}

export function removeFundRadarFollow(input: Readonly<{
  account: FundRadarAccount;
  ticker: unknown;
  plan: ProductPlan;
  walletTickers: ReadonlySet<string>;
  now: string;
}>) {
  const ticker = normalizeFundRadarTicker(input.ticker);
  const current = input.account.entries.find((entry) => entry.ticker === ticker);
  if (!current || current.status === "removed") {
    const entries = reconcileFundRadarEntries({
      entries: input.account.entries,
      plan: input.plan,
      walletTickers: input.walletTickers,
      now: input.now,
    });
    return Object.freeze({ account: Object.freeze({ ...input.account, entries }), removed: false });
  }
  const removed: FundRadarEntry = Object.freeze({
    ...current,
    status: "removed",
    removedAt: input.now,
    updatedAt: input.now,
  });
  const entries = reconcileFundRadarEntries({
    entries: input.account.entries.map((entry) => entry.ticker === ticker ? removed : entry),
    plan: input.plan,
    walletTickers: input.walletTickers,
    now: input.now,
  });
  return Object.freeze({ account: Object.freeze({ ...input.account, entries }), removed: true });
}

export function setFundRadarNotifications(input: Readonly<{
  account: FundRadarAccount;
  ticker: unknown;
  enabled: boolean;
  plan: ProductPlan;
  walletTickers: ReadonlySet<string>;
  now: string;
}>) {
  const ticker = normalizeFundRadarTicker(input.ticker);
  const current = input.account.entries.find((entry) => entry.ticker === ticker && entry.status !== "removed");
  if (!current) throw new FundRadarError("FUND_RADAR_FOLLOW_NOT_FOUND", 404);
  const entries = reconcileFundRadarEntries({
    entries: input.account.entries.map((entry) => entry.ticker === ticker
      ? Object.freeze({ ...entry, notificationsEnabled: input.enabled, updatedAt: input.now })
      : entry),
    plan: input.plan,
    walletTickers: input.walletTickers,
    now: input.now,
  });
  return Object.freeze({ ...input.account, entries });
}

export function emptyFundRadarAccount(): FundRadarAccount {
  return Object.freeze({ schemaVersion: FUND_RADAR_SCHEMA_VERSION, entries: Object.freeze([]), updates: Object.freeze([]) });
}
