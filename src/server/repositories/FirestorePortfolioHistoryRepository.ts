import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
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

type StoredMonth = {
  dividends: number | null;
  source: PortfolioHistorySource;
  createdAt: FirebaseFirestore.Timestamp | string;
  updatedAt: FirebaseFirestore.Timestamp | string;
};

function iso(value: FirebaseFirestore.Timestamp | string | undefined): string {
  if (!value) return new Date(0).toISOString();
  return typeof value === "string" ? value : value.toDate().toISOString();
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
    dividends: data.dividends === null ? null : Number(data.dividends),
    source: data.source,
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
  });
}

function yearAndMonth(competence: string) {
  const [yearText, month] = competence.split("-");
  return { year: Number(yearText), month };
}

export class FirestorePortfolioHistoryRepository implements PortfolioHistoryRepository {
  async listByPortfolio(ownerId: PortfolioOwnerId, portfolioId: string): Promise<readonly PortfolioHistoryEntry[]> {
    const snapshot = await adminDb.collection(COLLECTION)
      .where("ownerId", "==", ownerId)
      .where("portfolioId", "==", portfolioId)
      .get();

    const entries = snapshot.docs.flatMap((document) => {
      const data = document.data();
      const year = Number(data.year);
      const months = (data.months || {}) as Record<string, StoredMonth>;
      return Object.entries(months).map(([month, value]) => entryFromMonth(portfolioId, year, month, value));
    });

    return Object.freeze(entries.sort((left, right) => left.competence.localeCompare(right.competence)));
  }

  async findByCompetence(key: PortfolioHistoryKey): Promise<PortfolioHistoryEntry | null> {
    const reference = adminDb.collection(COLLECTION).doc(portfolioHistoryAnnualDocumentId(key));
    const snapshot = await reference.get();
    if (!snapshot.exists) return null;
    const data = snapshot.data() || {};
    if (data.ownerId !== key.ownerId || data.portfolioId !== key.portfolioId) return null;
    const { year, month } = yearAndMonth(key.competence);
    const stored = data.months?.[month] as StoredMonth | undefined;
    return stored ? entryFromMonth(key.portfolioId, year, month, stored) : null;
  }

  async create(key: PortfolioHistoryKey, entry: PortfolioHistoryEntry): Promise<void> {
    const reference = adminDb.collection(COLLECTION).doc(portfolioHistoryAnnualDocumentId(key));
    const { year, month } = yearAndMonth(entry.competence);

    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const data = snapshot.data() || {};
      if (snapshot.exists && (data.ownerId !== key.ownerId || data.portfolioId !== key.portfolioId)) {
        throw new Error("HISTORY_ENTRY_NOT_FOUND");
      }
      if (data.months?.[month]) throw new Error("HISTORY_ENTRY_ALREADY_EXISTS");

      const timestamp = adminFieldValue.serverTimestamp();
      transaction.set(reference, {
        ownerId: key.ownerId,
        portfolioId: key.portfolioId,
        year,
        schemaVersion: SCHEMA_VERSION,
        [`months.${month}`]: {
          dividends: entry.dividends,
          source: entry.source,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        createdAt: data.createdAt || timestamp,
        updatedAt: timestamp,
      }, { merge: true });
    });
  }

  async updateManual(key: PortfolioHistoryKey, entry: PortfolioHistoryEntry): Promise<void> {
    const reference = adminDb.collection(COLLECTION).doc(portfolioHistoryAnnualDocumentId(key));
    const { year, month } = yearAndMonth(entry.competence);

    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new Error("HISTORY_ENTRY_NOT_FOUND");
      const data = snapshot.data() || {};
      if (data.ownerId !== key.ownerId || data.portfolioId !== key.portfolioId) throw new Error("HISTORY_ENTRY_NOT_FOUND");
      const current = data.months?.[month] as StoredMonth | undefined;
      if (!current) throw new Error("HISTORY_ENTRY_NOT_FOUND");
      assertCanEditPortfolioHistory(entryFromMonth(key.portfolioId, year, month, current));
      assertCanEditPortfolioHistory(entry);

      transaction.update(reference, {
        [`months.${month}.dividends`]: entry.dividends,
        [`months.${month}.updatedAt`]: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
      });
    });
  }

  async deleteManual(key: PortfolioHistoryKey): Promise<void> {
    const reference = adminDb.collection(COLLECTION).doc(portfolioHistoryAnnualDocumentId(key));
    const { year, month } = yearAndMonth(key.competence);

    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new Error("HISTORY_ENTRY_NOT_FOUND");
      const data = snapshot.data() || {};
      if (data.ownerId !== key.ownerId || data.portfolioId !== key.portfolioId) throw new Error("HISTORY_ENTRY_NOT_FOUND");
      const current = data.months?.[month] as StoredMonth | undefined;
      if (!current) throw new Error("HISTORY_ENTRY_NOT_FOUND");
      assertCanEditPortfolioHistory(entryFromMonth(key.portfolioId, year, month, current));

      transaction.update(reference, {
        [`months.${month}`]: adminFieldValue.delete(),
        updatedAt: adminFieldValue.serverTimestamp(),
      });
    });
  }
}
