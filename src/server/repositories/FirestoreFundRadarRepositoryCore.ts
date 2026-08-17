import { createHash } from "node:crypto";
import {
  emptyFundRadarAccount,
  FUND_RADAR_SCHEMA_VERSION,
  FundRadarError,
  reconcileFundRadarEntries,
  removeFundRadarFollow,
  setFundRadarNotifications,
  startFundRadarFollow,
  type FundRadarAccount,
  type FundRadarEntry,
  type FundRadarObservation,
  type FundRadarUpdate,
} from "@/lib/fund-radar/FundRadar";
import type { FundRadarRepository, FundRadarSubject } from "@/lib/fund-radar/FundRadarRepository";
import { extractUserWallet } from "@/lib/userWallet";

const USER_COLLECTION = "User";
const RADAR_SUBCOLLECTION = "FundRadar";
const RADAR_DOCUMENT = "main";
const MAX_UPDATES = 100;

export class FundRadarPersistenceError extends Error {
  readonly code: "FUND_RADAR_OWNER_INVALID" | "FUND_RADAR_ACCOUNT_CORRUPTED";

  constructor(code: FundRadarPersistenceError["code"]) {
    super(code);
    this.name = "FundRadarPersistenceError";
    this.code = code;
  }
}

export type FirestoreFundRadarRepositoryDependencies = Readonly<{
  db: FirebaseFirestore.Firestore;
}>;

function ownerId(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 512) throw new FundRadarPersistenceError("FUND_RADAR_OWNER_INVALID");
  return normalized;
}

function isIso(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isFingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function observation(value: unknown): FundRadarObservation | null {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FundRadarPersistenceError("FUND_RADAR_ACCOUNT_CORRUPTED");
  const raw = value as Record<string, unknown>;
  if (
    !isFingerprint(raw.fingerprint)
    || (raw.dividendFingerprint !== null && !isFingerprint(raw.dividendFingerprint))
    || !Array.isArray(raw.timelineFingerprints)
    || !raw.timelineFingerprints.every(isFingerprint)
    || !isFingerprint(raw.qualityFingerprint)
    || !isFingerprint(raw.signalFingerprint)
  ) throw new FundRadarPersistenceError("FUND_RADAR_ACCOUNT_CORRUPTED");
  return Object.freeze({
    fingerprint: raw.fingerprint,
    dividendFingerprint: raw.dividendFingerprint as string | null,
    timelineFingerprints: Object.freeze([...raw.timelineFingerprints] as string[]),
    qualityFingerprint: raw.qualityFingerprint,
    signalFingerprint: raw.signalFingerprint,
  });
}

function entry(value: unknown): FundRadarEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FundRadarPersistenceError("FUND_RADAR_ACCOUNT_CORRUPTED");
  const raw = value as Record<string, unknown>;
  const status = String(raw.status || "");
  if (
    !/^[A-Z]{4,6}\d{1,2}$/.test(String(raw.ticker || ""))
    || !["active", "paused_by_plan", "in_portfolio", "removed"].includes(status)
    || typeof raw.notificationsEnabled !== "boolean"
    || !isIso(raw.createdAt)
    || !isIso(raw.updatedAt)
    || (raw.removedAt !== null && !isIso(raw.removedAt))
    || (raw.lastProcessedFingerprint !== null && !isFingerprint(raw.lastProcessedFingerprint))
  ) throw new FundRadarPersistenceError("FUND_RADAR_ACCOUNT_CORRUPTED");
  return Object.freeze({
    ticker: String(raw.ticker),
    status: status as FundRadarEntry["status"],
    notificationsEnabled: raw.notificationsEnabled,
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
    removedAt: raw.removedAt as string | null,
    lastProcessedFingerprint: raw.lastProcessedFingerprint as string | null,
    lastObservation: observation(raw.lastObservation),
  });
}

function update(value: unknown): FundRadarUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FundRadarPersistenceError("FUND_RADAR_ACCOUNT_CORRUPTED");
  const raw = value as Record<string, unknown>;
  const delivery = raw.delivery && typeof raw.delivery === "object" && !Array.isArray(raw.delivery)
    ? raw.delivery as Record<string, unknown>
    : null;
  if (
    !isFingerprint(raw.fingerprint)
    || !/^[A-Z]{4,6}\d{1,2}$/.test(String(raw.ticker || ""))
    || !["dividend", "regulatory_event", "data_quality", "deterministic_signal"].includes(String(raw.kind || ""))
    || !isIso(raw.createdAt)
    || !delivery
    || !["pending", "sending", "sent"].includes(String(delivery.status || ""))
    || !Number.isInteger(delivery.attemptCount)
    || Number(delivery.attemptCount) < 0
    || (delivery.leaseUntil !== null && !isIso(delivery.leaseUntil))
    || (delivery.sentAt !== null && !isIso(delivery.sentAt))
  ) throw new FundRadarPersistenceError("FUND_RADAR_ACCOUNT_CORRUPTED");
  return Object.freeze({
    fingerprint: raw.fingerprint,
    ticker: String(raw.ticker),
    kind: String(raw.kind) as FundRadarUpdate["kind"],
    title: String(raw.title || "").slice(0, 180),
    whatChanged: String(raw.whatChanged || "").slice(0, 500),
    whyItMatters: String(raw.whyItMatters || "").slice(0, 500),
    source: String(raw.source || "").slice(0, 180),
    asOf: raw.asOf === null ? null : String(raw.asOf || "").slice(0, 80) || null,
    missingData: Object.freeze(Array.isArray(raw.missingData) ? raw.missingData.map(String).slice(0, 20) : []),
    createdAt: String(raw.createdAt),
    delivery: Object.freeze({
      status: String(delivery.status) as FundRadarUpdate["delivery"]["status"],
      attemptCount: Number(delivery.attemptCount),
      leaseUntil: delivery.leaseUntil as string | null,
      sentAt: delivery.sentAt as string | null,
    }),
  });
}

function storedAccount(data: FirebaseFirestore.DocumentData | undefined): FundRadarAccount {
  if (!data) return emptyFundRadarAccount();
  if (data.schemaVersion !== FUND_RADAR_SCHEMA_VERSION) throw new FundRadarPersistenceError("FUND_RADAR_ACCOUNT_CORRUPTED");
  const items = data.items && typeof data.items === "object" && !Array.isArray(data.items) ? data.items : {};
  const updates = data.updates && typeof data.updates === "object" && !Array.isArray(data.updates) ? data.updates : {};
  return Object.freeze({
    schemaVersion: FUND_RADAR_SCHEMA_VERSION,
    entries: Object.freeze(Object.values(items).map(entry)),
    updates: Object.freeze(Object.values(updates).map(update).sort((left, right) => right.createdAt.localeCompare(left.createdAt))),
  });
}

function dataFromAccount(account: FundRadarAccount) {
  return {
    schemaVersion: FUND_RADAR_SCHEMA_VERSION,
    items: Object.fromEntries(account.entries.map((item) => [item.ticker, item])),
    updates: Object.fromEntries(account.updates
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, MAX_UPDATES)
      .map((item) => [item.fingerprint, item])),
  };
}

function notificationId(fingerprint: string) {
  return createHash("sha256").update(`fund-radar-notification:${fingerprint}`, "utf8").digest("hex").slice(0, 48);
}

export class FirestoreFundRadarRepositoryCore implements FundRadarRepository {
  private readonly db: FirebaseFirestore.Firestore;

  constructor(dependencies: FirestoreFundRadarRepositoryDependencies) {
    this.db = dependencies.db;
  }

  private references(subject: FundRadarSubject) {
    const owner = ownerId(subject.ownerId);
    const user = this.db.collection(USER_COLLECTION).doc(owner);
    return { user, radar: user.collection(RADAR_SUBCOLLECTION).doc(RADAR_DOCUMENT) };
  }

  private async transaction<T>(
    subject: FundRadarSubject,
    action: (input: Readonly<{
      account: FundRadarAccount;
      walletTickers: ReadonlySet<string>;
      transaction: FirebaseFirestore.Transaction;
      user: FirebaseFirestore.DocumentReference;
    }>) => T,
  ) {
    const { user, radar } = this.references(subject);
    return this.db.runTransaction(async (transaction) => {
      const [userSnapshot, radarSnapshot] = await Promise.all([
        transaction.get(user),
        transaction.get(radar),
      ]);
      const walletTickers = new Set(extractUserWallet(userSnapshot.data() || {}).map((item) => item.ticker));
      const result = action({ account: storedAccount(radarSnapshot.data()), walletTickers, transaction, user });
      const account = (result as { account?: FundRadarAccount }).account || result as FundRadarAccount;
      transaction.set(radar, dataFromAccount(account), { merge: false });
      return result;
    });
  }

  reconcile(subject: FundRadarSubject, now: string) {
    return this.transaction(subject, ({ account, walletTickers }) => Object.freeze({
      ...account,
      entries: reconcileFundRadarEntries({ entries: account.entries, plan: subject.plan, walletTickers, now }),
    }));
  }

  start(input: Readonly<{ subject: FundRadarSubject; ticker: string; observation: FundRadarObservation; now: string }>) {
    return this.transaction(input.subject, ({ account, walletTickers }) => {
      const result = startFundRadarFollow({ ...input, account, plan: input.subject.plan, walletTickers });
      return Object.freeze({ account: result.account, created: result.created });
    });
  }

  remove(input: Readonly<{ subject: FundRadarSubject; ticker: string; now: string }>) {
    return this.transaction(input.subject, ({ account, walletTickers }) => {
      const result = removeFundRadarFollow({ ...input, account, plan: input.subject.plan, walletTickers });
      return Object.freeze({ account: result.account, removed: result.removed });
    });
  }

  setNotifications(input: Readonly<{ subject: FundRadarSubject; ticker: string; enabled: boolean; now: string }>) {
    return this.transaction(input.subject, ({ account, walletTickers }) => setFundRadarNotifications({
      ...input,
      account,
      plan: input.subject.plan,
      walletTickers,
    }));
  }

  recordObservation(input: Readonly<{
    subject: FundRadarSubject;
    ticker: string;
    expectedPreviousFingerprint: string | null;
    observation: FundRadarObservation;
    updates: readonly FundRadarUpdate[];
    now: string;
  }>) {
    return this.transaction(input.subject, ({ account, walletTickers, transaction, user }) => {
      const reconciled = reconcileFundRadarEntries({ entries: account.entries, plan: input.subject.plan, walletTickers, now: input.now });
      const current = reconciled.find((item) => item.ticker === input.ticker && item.status !== "removed");
      if (!current) throw new FundRadarError("FUND_RADAR_FOLLOW_NOT_FOUND", 404);
      if (current.lastProcessedFingerprint === input.observation.fingerprint) {
        return Object.freeze({ account: Object.freeze({ ...account, entries: reconciled }), createdUpdates: Object.freeze([]) });
      }
      if (current.lastProcessedFingerprint !== input.expectedPreviousFingerprint) {
        throw new FundRadarError("FUND_RADAR_OBSERVATION_STALE", 409);
      }
      const storedFingerprints = new Set(account.updates.map((item) => item.fingerprint));
      const createdUpdates = current.status === "active" && current.notificationsEnabled
        ? input.updates.filter((item) => !storedFingerprints.has(item.fingerprint))
        : [];
      const nextEntry = Object.freeze({
        ...current,
        lastProcessedFingerprint: input.observation.fingerprint,
        lastObservation: input.observation,
        updatedAt: input.now,
      });
      const nextAccount = Object.freeze({
        ...account,
        entries: Object.freeze(reconciled.map((item) => item.ticker === input.ticker ? nextEntry : item)),
        updates: Object.freeze([...createdUpdates, ...account.updates]),
      });
      for (const item of createdUpdates) {
        transaction.set(user.collection("Notifications").doc(notificationId(item.fingerprint)), {
          id: notificationId(item.fingerprint),
          type: "fund_radar_update",
          eventKey: item.fingerprint,
          ticker: item.ticker,
          title: item.title,
          message: `${item.whatChanged} ${item.whyItMatters}`,
          severity: "info",
          actionUrl: "/radar",
          portfolioImpact: null,
          createdAt: new Date(item.createdAt),
          readAt: null,
          dismissedAt: null,
          emailAttemptedAt: null,
          emailSentAt: null,
        }, { merge: false });
      }
      return Object.freeze({ account: nextAccount, createdUpdates: Object.freeze(createdUpdates) });
    });
  }

  claimPendingEmailUpdates(input: Readonly<{ subject: FundRadarSubject; now: string; leaseUntil: string; maximum: number }>) {
    return this.transaction(input.subject, ({ account, walletTickers }) => {
      const entries = reconcileFundRadarEntries({ entries: account.entries, plan: input.subject.plan, walletTickers, now: input.now });
      const eligible = new Set(entries.filter((item) => item.status === "active" && item.notificationsEnabled).map((item) => item.ticker));
      const claimed: FundRadarUpdate[] = [];
      const updates = account.updates.map((item) => {
        const leaseExpired = item.delivery.status === "sending" && Date.parse(item.delivery.leaseUntil || "") <= Date.parse(input.now);
        if (
          claimed.length >= Math.min(Math.max(input.maximum, 1), 20)
          || !eligible.has(item.ticker)
          || (item.delivery.status !== "pending" && !leaseExpired)
        ) return item;
        const next = Object.freeze({
          ...item,
          delivery: Object.freeze({
            ...item.delivery,
            status: "sending" as const,
            attemptCount: item.delivery.attemptCount + 1,
            leaseUntil: input.leaseUntil,
          }),
        });
        claimed.push(next);
        return next;
      });
      return Object.assign(Object.freeze({ ...account, entries, updates: Object.freeze(updates) }), {
        claimed: Object.freeze(claimed),
      });
    }).then((account) => (account as FundRadarAccount & { claimed: readonly FundRadarUpdate[] }).claimed);
  }

  async completeEmailDelivery(input: Readonly<{ subject: FundRadarSubject; fingerprints: readonly string[]; sent: boolean; now: string }>) {
    const fingerprints = new Set(input.fingerprints);
    await this.transaction(input.subject, ({ account, walletTickers }) => Object.freeze({
      ...account,
      entries: reconcileFundRadarEntries({ entries: account.entries, plan: input.subject.plan, walletTickers, now: input.now }),
      updates: Object.freeze(account.updates.map((item) => !fingerprints.has(item.fingerprint) ? item : Object.freeze({
        ...item,
        delivery: Object.freeze({
          ...item.delivery,
          status: input.sent ? "sent" as const : "pending" as const,
          leaseUntil: null,
          sentAt: input.sent ? input.now : null,
        }),
      }))),
    }));
  }
}
