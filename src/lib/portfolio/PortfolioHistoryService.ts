import {
  assertCanEditPortfolioHistory,
  createManualPortfolioHistoryEntry,
  detectPortfolioHistoryConflict,
  type ManualPortfolioHistoryInput,
  type PortfolioHistoryEntry,
} from "./PortfolioHistory.ts";
import type {
  PortfolioHistoryRepository,
  PortfolioOwnerId,
} from "./PortfolioHistoryRepository.ts";

export type PortfolioActor = Readonly<{
  ownerId: PortfolioOwnerId;
}>;

export class PortfolioHistoryService {
  constructor(
    private readonly repository: PortfolioHistoryRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(actor: PortfolioActor, portfolioId: string): Promise<readonly PortfolioHistoryEntry[]> {
    return this.repository.listByPortfolio(actor.ownerId, portfolioId);
  }

  async createManual(
    actor: PortfolioActor,
    input: ManualPortfolioHistoryInput,
  ): Promise<PortfolioHistoryEntry> {
    const entry = createManualPortfolioHistoryEntry(input, this.clock());
    const key = {
      ownerId: actor.ownerId,
      portfolioId: entry.portfolioId,
      competence: entry.competence,
    } as const;

    const existing = await this.repository.findByCompetence(key);
    const conflict = detectPortfolioHistoryConflict(existing ?? undefined, entry);
    if (conflict) {
      throw new Error(
        conflict.resolution === "reject_duplicate"
          ? "HISTORY_ENTRY_ALREADY_EXISTS"
          : "HISTORY_ENTRY_CONFLICT_REQUIRES_RESOLUTION",
      );
    }

    await this.repository.create(key, entry);
    return entry;
  }

  async updateManual(
    actor: PortfolioActor,
    current: PortfolioHistoryEntry,
    values: Readonly<{ totalValue?: unknown; dividends?: unknown }>,
  ): Promise<PortfolioHistoryEntry> {
    assertCanEditPortfolioHistory(current);
    const now = this.clock();
    const [year, month] = current.competence.split("-").map(Number);
    const replacement = createManualPortfolioHistoryEntry({
      portfolioId: current.portfolioId,
      year,
      month,
      totalValue: values.totalValue,
      dividends: values.dividends,
    }, now);
    const updated = Object.freeze({
      ...replacement,
      createdAt: current.createdAt,
      updatedAt: now.toISOString(),
    });

    await this.repository.updateManual({
      ownerId: actor.ownerId,
      portfolioId: current.portfolioId,
      competence: current.competence,
    }, updated);
    return updated;
  }

  async deleteManual(actor: PortfolioActor, entry: PortfolioHistoryEntry): Promise<void> {
    assertCanEditPortfolioHistory(entry);
    await this.repository.deleteManual({
      ownerId: actor.ownerId,
      portfolioId: entry.portfolioId,
      competence: entry.competence,
    });
  }
}
