import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import {
  assertCanEditPortfolioHistory,
  type PortfolioHistoryEntry,
} from "@/lib/portfolio/PortfolioHistory";
import {
  portfolioHistoryDocumentId,
  type PortfolioHistoryKey,
  type PortfolioHistoryRepository,
  type PortfolioOwnerId,
} from "@/lib/portfolio/PortfolioHistoryRepository";

const COLLECTION = "UserPortfolioHistory";

function entryFromData(data: FirebaseFirestore.DocumentData): PortfolioHistoryEntry {
  return Object.freeze({
    schemaVersion: 1,
    portfolioId: String(data.portfolioId),
    competence: String(data.competence) as PortfolioHistoryEntry["competence"],
    totalValue: data.totalValue === null ? null : Number(data.totalValue),
    dividends: data.dividends === null ? null : Number(data.dividends),
    source: data.source,
    createdAt: data.createdAt?.toDate?.().toISOString?.() ?? String(data.createdAt),
    updatedAt: data.updatedAt?.toDate?.().toISOString?.() ?? String(data.updatedAt),
  });
}

export class FirestorePortfolioHistoryRepository implements PortfolioHistoryRepository {
  async listByPortfolio(ownerId: PortfolioOwnerId, portfolioId: string): Promise<readonly PortfolioHistoryEntry[]> {
    const snapshot = await adminDb.collection(COLLECTION)
      .where("ownerId", "==", ownerId)
      .where("portfolioId", "==", portfolioId)
      .orderBy("competence", "asc")
      .get();
    return Object.freeze(snapshot.docs.map((document) => entryFromData(document.data())));
  }

  async findByCompetence(key: PortfolioHistoryKey): Promise<PortfolioHistoryEntry | null> {
    const snapshot = await adminDb.collection(COLLECTION).doc(portfolioHistoryDocumentId(key)).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data() || {};
    if (data.ownerId !== key.ownerId) return null;
    return entryFromData(data);
  }

  async create(key: PortfolioHistoryKey, entry: PortfolioHistoryEntry): Promise<void> {
    await adminDb.collection(COLLECTION).doc(portfolioHistoryDocumentId(key)).create({
      ownerId: key.ownerId,
      portfolioId: entry.portfolioId,
      competence: entry.competence,
      totalValue: entry.totalValue,
      dividends: entry.dividends,
      source: entry.source,
      schemaVersion: entry.schemaVersion,
      createdAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    });
  }

  async updateManual(key: PortfolioHistoryKey, entry: PortfolioHistoryEntry): Promise<void> {
    const reference = adminDb.collection(COLLECTION).doc(portfolioHistoryDocumentId(key));
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new Error("HISTORY_ENTRY_NOT_FOUND");
      const data = snapshot.data() || {};
      if (data.ownerId !== key.ownerId) throw new Error("HISTORY_ENTRY_NOT_FOUND");
      assertCanEditPortfolioHistory(entryFromData(data));
      assertCanEditPortfolioHistory(entry);
      transaction.update(reference, {
        totalValue: entry.totalValue,
        dividends: entry.dividends,
        updatedAt: adminFieldValue.serverTimestamp(),
      });
    });
  }

  async deleteManual(key: PortfolioHistoryKey): Promise<void> {
    const reference = adminDb.collection(COLLECTION).doc(portfolioHistoryDocumentId(key));
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new Error("HISTORY_ENTRY_NOT_FOUND");
      const data = snapshot.data() || {};
      if (data.ownerId !== key.ownerId) throw new Error("HISTORY_ENTRY_NOT_FOUND");
      assertCanEditPortfolioHistory(entryFromData(data));
      transaction.delete(reference);
    });
  }
}
