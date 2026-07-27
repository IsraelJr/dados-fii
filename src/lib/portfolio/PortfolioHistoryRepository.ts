import type {
  PortfolioHistoryCompetence,
  PortfolioHistoryEntry,
} from "./PortfolioHistory.ts";

export type PortfolioOwnerId = string;

export type PortfolioHistoryKey = Readonly<{
  ownerId: PortfolioOwnerId;
  portfolioId: string;
  competence: PortfolioHistoryCompetence;
}>;

export interface PortfolioHistoryRepository {
  listByPortfolio(ownerId: PortfolioOwnerId, portfolioId: string): Promise<readonly PortfolioHistoryEntry[]>;
  findByCompetence(key: PortfolioHistoryKey): Promise<PortfolioHistoryEntry | null>;
  create(key: PortfolioHistoryKey, entry: PortfolioHistoryEntry): Promise<void>;
  updateManual(key: PortfolioHistoryKey, entry: PortfolioHistoryEntry): Promise<void>;
  deleteManual(key: PortfolioHistoryKey): Promise<void>;
}

export function portfolioHistoryDocumentId(key: PortfolioHistoryKey): string {
  const ownerId = String(key.ownerId || "").trim();
  const portfolioId = String(key.portfolioId || "").trim();
  const competence = String(key.competence || "").trim();

  if (!/^[A-Za-z0-9_-]{1,128}$/.test(ownerId)) {
    throw new Error("INVALID_OWNER_ID");
  }
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(portfolioId)) {
    throw new Error("INVALID_PORTFOLIO_ID");
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence)) {
    throw new Error("INVALID_COMPETENCE");
  }

  return `${ownerId}__${portfolioId}__${competence}`;
}
