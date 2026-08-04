import {
  assertCanEditPortfolioHistory,
  type PortfolioHistoryEntry,
  type PortfolioHistorySource,
} from "@/lib/portfolio/PortfolioHistory";
import {
  portfolioHistoryAnnualDocumentId,
  type PortfolioHistoryKey,
  type PortfolioHistoryRepository,
  type PortfolioOwnerId,
} from "@/lib/portfolio/PortfolioHistoryRepository";

const COLLECTION = "UserPortfolioHistory";
const SCHEMA_VERSION = 2;
const MONTH = /^(0[1-9]|1[0-2])$/;

type StoredTimestamp = string | Readonly<{ toDate(): Date }>;

type StoredMonth = Readonly<{
  dividends: number | null;
  source: PortfolioHistorySource;
  createdAt?: StoredTimestamp;
  updatedAt?: StoredTimestamp;
}>;

type FieldValueFactory = Readonly<{
  serverTimestamp(): FirebaseFirestore.FieldValue;
  delete(): FirebaseFirestore.FieldValue;
}>;

export type PortfolioHistoryStorageDiagnostic = Readonly<{
  code: "PORTFOLIO_HISTORY_LEGACY_CONFLICT";
  year: number;
  month: string;
}>;

export type FirestorePortfolioHistoryRepositoryDependencies = Readonly<{
  db: FirebaseFirestore.Firestore;
  fieldValue: FieldValueFactory;
  diagnose?: (diagnostic: PortfolioHistoryStorageDiagnostic) => void;
}>;

type MonthResolution = Readonly<{
  canonical: StoredMonth | null;
  legacy: StoredMonth | null;
  hasCanonical: boolean;
  hasLegacy: boolean;
  read: StoredMonth | null;
  action: "none" | "migrate" | "deduplicate" | "conflict";
}>;

function iso(value: StoredTimestamp | undefined): string {
  if (!value) return new Date(0).toISOString();
  return typeof value === "string" ? value : value.toDate().toISOString();
}

function storedMonth(value: unknown): StoredMonth | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!["manual", "automatic_snapshot", "legacy"].includes(String(record.source))) return null;
  if (record.dividends !== null && (
    typeof record.dividends !== "number"
    || !Number.isFinite(record.dividends)
    || record.dividends < 0
  )) {
    return null;
  }
  for (const timestamp of [record.createdAt, record.updatedAt]) {
    if (timestamp !== undefined
      && typeof timestamp !== "string"
      && !(timestamp && typeof timestamp === "object" && "toDate" in timestamp && typeof timestamp.toDate === "function")) {
      return null;
    }
  }
  return {
    dividends: record.dividends as number | null,
    source: record.source as PortfolioHistorySource,
    createdAt: record.createdAt as StoredTimestamp | undefined,
    updatedAt: record.updatedAt as StoredTimestamp | undefined,
  };
}

function comparableStoredValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparableStoredValue);
  if (value && typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") {
      return { timestamp: value.toDate().toISOString() };
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, comparableStoredValue(item)]),
    );
  }
  return value;
}

function sameStoredValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(comparableStoredValue(left)) === JSON.stringify(comparableStoredValue(right));
}

function legacyMonthField(month: string): string {
  return `months.${month}`;
}

function recordMonths(data: FirebaseFirestore.DocumentData): Record<string, unknown> {
  const value = data.months;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function resolveMonth(data: FirebaseFirestore.DocumentData, month: string): MonthResolution {
  const months = recordMonths(data);
  const legacyField = legacyMonthField(month);
  const hasCanonical = Object.prototype.hasOwnProperty.call(months, month);
  const hasLegacy = Object.prototype.hasOwnProperty.call(data, legacyField);
  const canonical = hasCanonical ? storedMonth(months[month]) : null;
  const legacy = hasLegacy ? storedMonth(data[legacyField]) : null;

  if (hasCanonical && hasLegacy) {
    if (canonical && legacy && sameStoredValue(months[month], data[legacyField])) {
      return { canonical, legacy, hasCanonical, hasLegacy, read: canonical, action: "deduplicate" };
    }
    return { canonical, legacy, hasCanonical, hasLegacy, read: canonical, action: "conflict" };
  }
  if (hasCanonical) {
    return {
      canonical,
      legacy,
      hasCanonical,
      hasLegacy,
      read: canonical,
      action: canonical ? "none" : "conflict",
    };
  }
  if (hasLegacy) {
    return {
      canonical,
      legacy,
      hasCanonical,
      hasLegacy,
      read: legacy,
      action: legacy ? "migrate" : "conflict",
    };
  }
  return { canonical, legacy, hasCanonical, hasLegacy, read: null, action: "none" };
}

function entryFromMonth(
  portfolioId: string,
  year: number,
  month: string,
  data: StoredMonth,
): PortfolioHistoryEntry {
  return Object.freeze({
    schemaVersion: 1,
    portfolioId,
    competence: `${year}-${month}` as PortfolioHistoryEntry["competence"],
    totalValue: null,
    dividends: data.dividends,
    source: data.source,
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
  });
}

function yearAndMonth(competence: string) {
  const [yearText, month] = competence.split("-");
  return { year: Number(yearText), month };
}

function validStoredYear(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 2000 && Number(value) <= 9999;
}

export class FirestorePortfolioHistoryRepositoryCore implements PortfolioHistoryRepository {
  private readonly db: FirebaseFirestore.Firestore;
  private readonly fieldValue: FieldValueFactory;
  private readonly diagnose: (diagnostic: PortfolioHistoryStorageDiagnostic) => void;

  constructor(dependencies: FirestorePortfolioHistoryRepositoryDependencies) {
    this.db = dependencies.db;
    this.fieldValue = dependencies.fieldValue;
    this.diagnose = dependencies.diagnose ?? ((diagnostic) => {
      console.warn(diagnostic.code, { year: diagnostic.year, month: diagnostic.month });
    });
  }

  private reportConflict(year: number, month: string) {
    this.diagnose({ code: "PORTFOLIO_HISTORY_LEGACY_CONFLICT", year, month });
  }

  private assertOwnership(
    data: FirebaseFirestore.DocumentData,
    ownerId: PortfolioOwnerId,
    portfolioId: string,
  ) {
    if (data.ownerId !== ownerId || data.portfolioId !== portfolioId) {
      throw new Error("HISTORY_ENTRY_NOT_FOUND");
    }
  }

  private migrationPatch(
    migrations: Readonly<Record<string, StoredMonth>>,
    legacyFieldsToDelete: readonly string[],
  ): FirebaseFirestore.DocumentData {
    const patch: FirebaseFirestore.DocumentData = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: this.fieldValue.serverTimestamp(),
    };
    if (Object.keys(migrations).length) patch.months = migrations;
    for (const field of legacyFieldsToDelete) patch[field] = this.fieldValue.delete();
    return patch;
  }

  private applyResolutionMigration(
    transaction: FirebaseFirestore.Transaction,
    reference: FirebaseFirestore.DocumentReference,
    month: string,
    resolution: MonthResolution,
  ) {
    if (resolution.action === "migrate" && resolution.legacy) {
      transaction.set(reference, this.migrationPatch(
        { [month]: resolution.legacy },
        [legacyMonthField(month)],
      ), { merge: true });
    } else if (resolution.action === "deduplicate") {
      transaction.set(reference, this.migrationPatch(
        {},
        [legacyMonthField(month)],
      ), { merge: true });
    }
  }

  async listByPortfolio(ownerId: PortfolioOwnerId, portfolioId: string): Promise<readonly PortfolioHistoryEntry[]> {
    const snapshot = await this.db.collection(COLLECTION)
      .where("ownerId", "==", ownerId)
      .where("portfolioId", "==", portfolioId)
      .get();

    const entries = (await Promise.all(snapshot.docs.map((document) => (
      this.db.runTransaction(async (transaction) => {
        const current = await transaction.get(document.ref);
        if (!current.exists) return [];
        const data = current.data() || {};
        this.assertOwnership(data, ownerId, portfolioId);
        const year = Number(data.year);
        if (!validStoredYear(year)) return [];

        const months = new Set<string>([
          ...Object.keys(recordMonths(data)).filter((month) => MONTH.test(month)),
          ...Object.keys(data)
            .map((field) => /^months\.(0[1-9]|1[0-2])$/.exec(field)?.[1])
            .filter((month): month is string => Boolean(month)),
        ]);
        const migrations: Record<string, StoredMonth> = {};
        const legacyFieldsToDelete: string[] = [];
        const documentEntries: PortfolioHistoryEntry[] = [];

        for (const month of [...months].sort()) {
          const resolution = resolveMonth(data, month);
          if (resolution.action === "migrate" && resolution.legacy) {
            migrations[month] = resolution.legacy;
            legacyFieldsToDelete.push(legacyMonthField(month));
          } else if (resolution.action === "deduplicate") {
            legacyFieldsToDelete.push(legacyMonthField(month));
          } else if (resolution.action === "conflict") {
            this.reportConflict(year, month);
          }
          if (resolution.read) documentEntries.push(entryFromMonth(portfolioId, year, month, resolution.read));
        }

        if (Object.keys(migrations).length || legacyFieldsToDelete.length) {
          transaction.set(document.ref, this.migrationPatch(migrations, legacyFieldsToDelete), { merge: true });
        }
        return documentEntries;
      })
    )))).flat();

    return Object.freeze(entries.sort((left, right) => left.competence.localeCompare(right.competence)));
  }

  async findByCompetence(key: PortfolioHistoryKey): Promise<PortfolioHistoryEntry | null> {
    const reference = this.db.collection(COLLECTION).doc(portfolioHistoryAnnualDocumentId(key));
    const { year, month } = yearAndMonth(key.competence);

    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return null;
      const data = snapshot.data() || {};
      this.assertOwnership(data, key.ownerId, key.portfolioId);
      const resolution = resolveMonth(data, month);
      if (resolution.action === "conflict") this.reportConflict(year, month);
      else this.applyResolutionMigration(transaction, reference, month, resolution);
      return resolution.read ? entryFromMonth(key.portfolioId, year, month, resolution.read) : null;
    });
  }

  async create(key: PortfolioHistoryKey, entry: PortfolioHistoryEntry): Promise<void> {
    const reference = this.db.collection(COLLECTION).doc(portfolioHistoryAnnualDocumentId(key));
    if (entry.competence !== key.competence || entry.portfolioId !== key.portfolioId) {
      throw new Error("INVALID_COMPETENCE");
    }
    const { year, month } = yearAndMonth(key.competence);

    const outcome = await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const data = snapshot.data() || {};
      if (snapshot.exists) this.assertOwnership(data, key.ownerId, key.portfolioId);
      const resolution = resolveMonth(data, month);
      if (resolution.hasCanonical || resolution.hasLegacy) {
        if (resolution.action === "conflict") this.reportConflict(year, month);
        else this.applyResolutionMigration(transaction, reference, month, resolution);
        return resolution.action === "conflict" ? "conflict" : "exists";
      }

      const timestamp = this.fieldValue.serverTimestamp();
      transaction.set(reference, {
        ownerId: key.ownerId,
        portfolioId: key.portfolioId,
        year,
        schemaVersion: SCHEMA_VERSION,
        months: {
          [month]: {
            dividends: entry.dividends,
            source: entry.source,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        },
        createdAt: data.createdAt || timestamp,
        updatedAt: timestamp,
      }, { merge: true });
      return "created";
    });

    if (outcome === "exists") throw new Error("HISTORY_ENTRY_ALREADY_EXISTS");
    if (outcome === "conflict") throw new Error("HISTORY_ENTRY_CONFLICT_REQUIRES_RESOLUTION");
  }

  async updateManual(key: PortfolioHistoryKey, entry: PortfolioHistoryEntry): Promise<void> {
    const reference = this.db.collection(COLLECTION).doc(portfolioHistoryAnnualDocumentId(key));
    if (entry.competence !== key.competence || entry.portfolioId !== key.portfolioId) {
      throw new Error("INVALID_COMPETENCE");
    }
    const { year, month } = yearAndMonth(key.competence);

    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new Error("HISTORY_ENTRY_NOT_FOUND");
      const data = snapshot.data() || {};
      this.assertOwnership(data, key.ownerId, key.portfolioId);
      const resolution = resolveMonth(data, month);
      if (resolution.action === "conflict") this.reportConflict(year, month);
      if (!resolution.read) {
        throw new Error(
          resolution.action === "conflict"
            ? "HISTORY_ENTRY_CONFLICT_REQUIRES_RESOLUTION"
            : "HISTORY_ENTRY_NOT_FOUND",
        );
      }
      assertCanEditPortfolioHistory(entryFromMonth(key.portfolioId, year, month, resolution.read));
      assertCanEditPortfolioHistory(entry);

      const timestamp = this.fieldValue.serverTimestamp();
      const patch: FirebaseFirestore.DocumentData = {
        schemaVersion: SCHEMA_VERSION,
        months: {
          [month]: {
            ...resolution.read,
            dividends: entry.dividends,
            updatedAt: timestamp,
          },
        },
        updatedAt: timestamp,
      };
      if (resolution.action === "migrate" || resolution.action === "deduplicate") {
        patch[legacyMonthField(month)] = this.fieldValue.delete();
      }
      transaction.set(reference, patch, { merge: true });
    });
  }

  async deleteManual(key: PortfolioHistoryKey): Promise<void> {
    const reference = this.db.collection(COLLECTION).doc(portfolioHistoryAnnualDocumentId(key));
    const { year, month } = yearAndMonth(key.competence);

    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return;
      const data = snapshot.data() || {};
      this.assertOwnership(data, key.ownerId, key.portfolioId);
      const resolution = resolveMonth(data, month);
      if (!resolution.hasCanonical && !resolution.hasLegacy) return;
      if (resolution.action === "conflict") this.reportConflict(year, month);
      if (!resolution.read) throw new Error("HISTORY_ENTRY_CONFLICT_REQUIRES_RESOLUTION");
      assertCanEditPortfolioHistory(entryFromMonth(key.portfolioId, year, month, resolution.read));

      transaction.set(reference, {
        schemaVersion: SCHEMA_VERSION,
        months: { [month]: this.fieldValue.delete() },
        [legacyMonthField(month)]: this.fieldValue.delete(),
        updatedAt: this.fieldValue.serverTimestamp(),
      }, { merge: true });
    });
  }
}
