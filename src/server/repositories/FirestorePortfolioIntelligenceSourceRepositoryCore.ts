import type { PortfolioIntelligenceSnapshotInput } from "@/lib/portfolio-intelligence/PortfolioIntelligence";
import type { PortfolioHistoryRepository } from "@/lib/portfolio/PortfolioHistoryRepository";
import { extractUserWallet, userWalletFrom } from "@/lib/userWallet";

const USER_COLLECTION = "User";
const SNAPSHOT_SUBCOLLECTION = "WalletSnapshots";
const DEFAULT_PORTFOLIO_ID = "default";
const MAX_SNAPSHOTS = 120;
const COMPETENCE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export type PortfolioIntelligenceWalletPositionSource = Readonly<{
  ticker: string;
  quantity: number;
}>;

export type PortfolioIntelligenceCanonicalSource = Readonly<{
  wallet: readonly PortfolioIntelligenceWalletPositionSource[];
  snapshots: readonly PortfolioIntelligenceSnapshotInput[];
}>;

export interface PortfolioIntelligenceSourceRepository {
  load(input: Readonly<{
    ownerId: string;
    portfolioId: string;
  }>): Promise<PortfolioIntelligenceCanonicalSource>;
}

export type FirestorePortfolioIntelligenceSourceRepositoryDependencies = Readonly<{
  db: FirebaseFirestore.Firestore;
  history: PortfolioHistoryRepository;
}>;

export class PortfolioIntelligenceSourceError extends Error {
  readonly code:
    | "PORTFOLIO_INCREMENTAL_OWNER_INVALID"
    | "PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED"
    | "PORTFOLIO_INCREMENTAL_SOURCE_NOT_FOUND";

  constructor(
    code:
      | "PORTFOLIO_INCREMENTAL_OWNER_INVALID"
      | "PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED"
      | "PORTFOLIO_INCREMENTAL_SOURCE_NOT_FOUND",
  ) {
    super(code);
    this.name = "PortfolioIntelligenceSourceError";
    this.code = code;
  }
}

function assertOwnerId(value: unknown) {
  const ownerId = String(value ?? "").trim();
  if (!ownerId || ownerId.length > 512) {
    throw new PortfolioIntelligenceSourceError("PORTFOLIO_INCREMENTAL_OWNER_INVALID");
  }
  return ownerId;
}

function assertDefaultPortfolio(value: unknown) {
  if (String(value ?? DEFAULT_PORTFOLIO_ID).trim() !== DEFAULT_PORTFOLIO_ID) {
    throw new PortfolioIntelligenceSourceError("PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED");
  }
  return DEFAULT_PORTFOLIO_ID;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const compact = value.replace(/R\$/gi, "").replace(/\s/g, "").trim();
  if (!compact) return null;
  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

export function normalizePortfolioIntelligenceSnapshotDocument(
  documentId: string,
  data: Readonly<Record<string, unknown>>,
): Readonly<{ competence: string; dividends: number | null; totalValue: number }> | null {
  const competence = String(data.monthKey ?? documentId).trim();
  if (!COMPETENCE.test(competence)) return null;
  const dividends = nonNegativeNumber(
    data.estimatedDividendIncome
      ?? data.estimatedMonthlyIncome
      ?? data.announcedMonthlyIncome,
  );
  const totalValue = nonNegativeNumber(data.totalValue) ?? 0;
  if (totalValue <= 0 && dividends === null) return null;
  return Object.freeze({ competence, dividends, totalValue });
}

function snapshotFromDocument(
  document: FirebaseFirestore.QueryDocumentSnapshot,
) {
  return normalizePortfolioIntelligenceSnapshotDocument(document.id, document.data());
}

export function extractPortfolioIntelligenceWallet(data: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(data, "wallet")) {
    return extractUserWallet(data);
  }
  const wallet = data.wallet;
  const direct = userWalletFrom(wallet);
  if (direct.length || Array.isArray(wallet)) return direct;
  if (!wallet || typeof wallet !== "object") return [];
  const record = wallet as Record<string, unknown>;
  for (const nested of [record.items, record.fiis, record.assets, record.positions]) {
    const parsed = userWalletFrom(nested);
    if (parsed.length) return parsed;
  }
  return [];
}

export class FirestorePortfolioIntelligenceSourceRepositoryCore
implements PortfolioIntelligenceSourceRepository {
  private readonly db: FirebaseFirestore.Firestore;
  private readonly history: PortfolioHistoryRepository;

  constructor(dependencies: FirestorePortfolioIntelligenceSourceRepositoryDependencies) {
    this.db = dependencies.db;
    this.history = dependencies.history;
  }

  async load(input: Readonly<{
    ownerId: string;
    portfolioId: string;
  }>): Promise<PortfolioIntelligenceCanonicalSource> {
    const ownerId = assertOwnerId(input.ownerId);
    const portfolioId = assertDefaultPortfolio(input.portfolioId);
    const userReference = this.db.collection(USER_COLLECTION).doc(ownerId);

    const [userSnapshot, walletSnapshots, historyEntries] = await Promise.all([
      userReference.get(),
      userReference.collection(SNAPSHOT_SUBCOLLECTION)
        .orderBy("monthKey", "desc")
        .limit(MAX_SNAPSHOTS)
        .get(),
      this.history.listByPortfolio(ownerId, portfolioId),
    ]);

    if (!userSnapshot.exists) {
      throw new PortfolioIntelligenceSourceError("PORTFOLIO_INCREMENTAL_SOURCE_NOT_FOUND");
    }

    const wallet = Object.freeze(extractPortfolioIntelligenceWallet(userSnapshot.data() || {}).map((position) => Object.freeze({
      ticker: position.ticker,
      quantity: position.quotas,
    })));
    const byCompetence = new Map<string, PortfolioIntelligenceSnapshotInput>();

    for (const document of walletSnapshots.docs) {
      const snapshot = snapshotFromDocument(document);
      if (!snapshot) continue;
      byCompetence.set(snapshot.competence, Object.freeze({
        competence: snapshot.competence,
        dividends: snapshot.dividends,
      }));
    }

    // PortfolioHistory has the same precedence used by consolidatedSnapshots in
    // the wallet page: a canonical history dividend replaces the snapshot value.
    for (const entry of historyEntries) {
      if (!COMPETENCE.test(entry.competence) || typeof entry.dividends !== "number") continue;
      if (!Number.isFinite(entry.dividends) || entry.dividends < 0) continue;
      byCompetence.set(entry.competence, Object.freeze({
        competence: entry.competence,
        dividends: entry.dividends,
      }));
    }

    const snapshots = Object.freeze([...byCompetence.values()]
      .sort((left, right) => left.competence.localeCompare(right.competence))
      .slice(-MAX_SNAPSHOTS));

    return Object.freeze({ wallet, snapshots });
  }
}
