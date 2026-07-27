import {
  assertCanEditPortfolioHistory,
  type PortfolioHistoryEntry,
} from "./PortfolioHistory.ts";
import {
  portfolioHistoryDocumentId,
  type PortfolioHistoryKey,
  type PortfolioHistoryRepository,
  type PortfolioOwnerId,
} from "./PortfolioHistoryRepository.ts";

export class InMemoryPortfolioHistoryRepository implements PortfolioHistoryRepository {
  private readonly records = new Map<string, PortfolioHistoryEntry>();

  async listByPortfolio(
    ownerId: PortfolioOwnerId,
    portfolioId: string,
  ): Promise<readonly PortfolioHistoryEntry[]> {
    const prefix = `${ownerId}__${portfolioId}__`;
    return Object.freeze(
      [...this.records.entries()]
        .filter(([id]) => id.startsWith(prefix))
        .map(([, entry]) => entry)
        .sort((left, right) => left.competence.localeCompare(right.competence)),
    );
  }

  async findByCompetence(key: PortfolioHistoryKey): Promise<PortfolioHistoryEntry | null> {
    return this.records.get(portfolioHistoryDocumentId(key)) ?? null;
  }

  async create(key: PortfolioHistoryKey, entry: PortfolioHistoryEntry): Promise<void> {
    const id = portfolioHistoryDocumentId(key);
    if (this.records.has(id)) throw new Error("HISTORY_ENTRY_ALREADY_EXISTS");
    this.records.set(id, Object.freeze({ ...entry }));
  }

  async updateManual(key: PortfolioHistoryKey, entry: PortfolioHistoryEntry): Promise<void> {
    const id = portfolioHistoryDocumentId(key);
    const current = this.records.get(id);
    if (!current) throw new Error("HISTORY_ENTRY_NOT_FOUND");
    assertCanEditPortfolioHistory(current);
    assertCanEditPortfolioHistory(entry);
    this.records.set(id, Object.freeze({ ...entry, createdAt: current.createdAt }));
  }

  async deleteManual(key: PortfolioHistoryKey): Promise<void> {
    const id = portfolioHistoryDocumentId(key);
    const current = this.records.get(id);
    if (!current) throw new Error("HISTORY_ENTRY_NOT_FOUND");
    assertCanEditPortfolioHistory(current);
    this.records.delete(id);
  }
}
