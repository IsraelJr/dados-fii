import {
  assertCanEditPortfolioHistory,
  type PortfolioHistoryEntry,
} from "./PortfolioHistory";
import {
  portfolioHistoryDocumentId,
  type PortfolioHistoryKey,
  type PortfolioHistoryRepository,
  type PortfolioOwnerId,
} from "./PortfolioHistoryRepository";

type StoredPortfolioHistoryRecord = Readonly<{
  key: PortfolioHistoryKey;
  entry: PortfolioHistoryEntry;
}>;

export class InMemoryPortfolioHistoryRepository implements PortfolioHistoryRepository {
  private readonly records = new Map<string, StoredPortfolioHistoryRecord>();

  async listByPortfolio(
    ownerId: PortfolioOwnerId,
    portfolioId: string,
  ): Promise<readonly PortfolioHistoryEntry[]> {
    return Object.freeze(
      [...this.records.values()]
        .filter((record) => record.key.ownerId === ownerId && record.key.portfolioId === portfolioId)
        .map((record) => record.entry)
        .sort((left, right) => left.competence.localeCompare(right.competence)),
    );
  }

  async findByCompetence(key: PortfolioHistoryKey): Promise<PortfolioHistoryEntry | null> {
    return this.records.get(portfolioHistoryDocumentId(key))?.entry ?? null;
  }

  async create(key: PortfolioHistoryKey, entry: PortfolioHistoryEntry): Promise<void> {
    const id = portfolioHistoryDocumentId(key);
    if (this.records.has(id)) throw new Error("HISTORY_ENTRY_ALREADY_EXISTS");
    this.records.set(id, Object.freeze({
      key: Object.freeze({ ...key }),
      entry: Object.freeze({ ...entry }),
    }));
  }

  async updateManual(key: PortfolioHistoryKey, entry: PortfolioHistoryEntry): Promise<void> {
    const id = portfolioHistoryDocumentId(key);
    const current = this.records.get(id);
    if (!current) throw new Error("HISTORY_ENTRY_NOT_FOUND");
    assertCanEditPortfolioHistory(current.entry);
    assertCanEditPortfolioHistory(entry);
    this.records.set(id, Object.freeze({
      key: current.key,
      entry: Object.freeze({ ...entry, createdAt: current.entry.createdAt }),
    }));
  }

  async deleteManual(key: PortfolioHistoryKey): Promise<void> {
    const id = portfolioHistoryDocumentId(key);
    const current = this.records.get(id);
    if (!current) throw new Error("HISTORY_ENTRY_NOT_FOUND");
    assertCanEditPortfolioHistory(current.entry);
    this.records.delete(id);
  }
}
