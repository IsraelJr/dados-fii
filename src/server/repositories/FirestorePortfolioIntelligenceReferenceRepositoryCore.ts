import { createHash } from "node:crypto";
import {
  PORTFOLIO_INCREMENTAL_SCHEMA_VERSION,
  sanitizePortfolioIntelligenceReference,
  type PortfolioIntelligenceReference,
} from "@/lib/portfolio-intelligence/PortfolioIntelligenceIncremental";
import type {
  PortfolioIntelligenceReferenceRepository,
  PortfolioIntelligenceReferenceStoreResult,
} from "@/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalService";

const COLLECTION = "UserPortfolioIntelligenceReference";

type FieldValueFactory = Readonly<{
  serverTimestamp(): FirebaseFirestore.FieldValue;
}>;

export type FirestorePortfolioIntelligenceReferenceRepositoryDependencies = Readonly<{
  db: FirebaseFirestore.Firestore;
  fieldValue: FieldValueFactory;
}>;

function referenceDocumentId(ownerId: string, portfolioId: string) {
  return createHash("sha256").update(`${ownerId}:${portfolioId}`, "utf8").digest("hex");
}

function storedReference(value: unknown): PortfolioIntelligenceReference | null {
  try {
    return sanitizePortfolioIntelligenceReference(value);
  } catch {
    return null;
  }
}

export class FirestorePortfolioIntelligenceReferenceRepositoryCore
implements PortfolioIntelligenceReferenceRepository {
  constructor(private readonly dependencies: FirestorePortfolioIntelligenceReferenceRepositoryDependencies) {}

  async compareAndStore(input: Readonly<{
    ownerId: string;
    portfolioId: string;
    current: PortfolioIntelligenceReference;
  }>): Promise<PortfolioIntelligenceReferenceStoreResult> {
    const reference = this.dependencies.db.collection(COLLECTION)
      .doc(referenceDocumentId(input.ownerId, input.portfolioId));

    return this.dependencies.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const data = snapshot.data() || {};
      if (snapshot.exists && (data.ownerId !== input.ownerId || data.portfolioId !== input.portfolioId)) {
        throw new Error("PORTFOLIO_INCREMENTAL_REFERENCE_NOT_FOUND");
      }

      const previous = snapshot.exists ? storedReference(data.current) : null;
      const baselineState = !snapshot.exists ? "missing" as const
        : previous ? "found" as const
          : "invalid" as const;

      if (previous?.fingerprint === input.current.fingerprint) {
        return Object.freeze({ previous, stored: false, baselineState });
      }

      const timestamp = this.dependencies.fieldValue.serverTimestamp();
      transaction.set(reference, {
        schemaVersion: PORTFOLIO_INCREMENTAL_SCHEMA_VERSION,
        ownerId: input.ownerId,
        portfolioId: input.portfolioId,
        previous,
        current: input.current,
        createdAt: data.createdAt || timestamp,
        updatedAt: timestamp,
      });

      return Object.freeze({ previous, stored: true, baselineState });
    });
  }
}
