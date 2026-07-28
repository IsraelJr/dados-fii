import {
  assertCanEditPortfolioHistory,
  createManualPortfolioHistoryEntry,
  detectPortfolioHistoryConflict,
  type ManualPortfolioHistoryInput,
  type PortfolioHistoryEntry,
} from "./PortfolioHistory";
import type {
  PortfolioHistoryRepository,
  PortfolioOwnerId,
} from "./PortfolioHistoryRepository";

export type PortfolioActor = Readonly<{
  ownerId: PortfolioOwnerId;
}>;

export type PortfolioHistoryImportResult = Readonly<{
  imported: number;
  skipped: number;
}>;

export class PortfolioHistoryService {
  private readonly repository: PortfolioHistoryRepository;
  private readonly clock: () => Date;

  constructor(
    repository: PortfolioHistoryRepository,
    clock: () => Date = () => new Date(),
  ) {
    this.repository = repository;
    this.clock = clock;
  }

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

  async importLegacy(
    actor: PortfolioActor,
    entries: readonly PortfolioHistoryEntry[],
  ): Promise<PortfolioHistoryImportResult> {
    let imported = 0;
    let skipped = 0;

    for (const entry of entries) {
      if (entry.source !== "legacy") throw new Error("INVALID_LEGACY_SOURCE");
      const key = {
        ownerId: actor.ownerId,
        portfolioId: entry.portfolioId,
        competence: entry.competence,
      } as const;
      const existing = await this.repository.findByCompetence(key);
      if (existing) {
        skipped += 1;
        continue;
      }
      await this.repository.create(key, entry);
      imported += 1;
    }

    return Object.freeze({ imported, skipped });
  }

  async updateManual(
    actor: PortfolioActor,
    current: PortfolioHistoryEntry,
    values: Readonly<{ dividends: unknown }>,
  ): Promise<PortfolioHistoryEntry> {
    assertCanEditPortfolioHistory(current);
    const now = this.clock();
    const [year, month] = current.competence.split("-").map(Number);
    const replacement = createManualPortfolioHistoryEntry({
      portfolioId: current.portfolioId,
      year,
      month,
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
