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
const DEFAULT_PORTFOLIO_ID = "default";

type FieldValueFactory = Readonly<{
  serverTimestamp(): FirebaseFirestore.FieldValue;
}>;

export type FirestorePortfolioIntelligenceReferenceRepositoryDependencies = Readonly<{
  db: FirebaseFirestore.Firestore;
  fieldValue: FieldValueFactory;
}>;

export type PortfolioIntelligencePersistedReferencePair = Readonly<{
  previous: PortfolioIntelligenceReference | null;
  current: PortfolioIntelligenceReference;
}>;

export interface PortfolioIntelligenceReferencePairReader {
  readPair(input: Readonly<{
    ownerId: string;
    portfolioId: string;
  }>): Promise<PortfolioIntelligencePersistedReferencePair | null>;
}

export type PortfolioIntelligenceReferenceTransition = Readonly<{
  result: PortfolioIntelligenceReferenceStoreResult;
  nextPair: PortfolioIntelligencePersistedReferencePair | null;
}>;

export class PortfolioIntelligenceReferencePersistenceError extends Error {
  readonly code:
    | "PORTFOLIO_INCREMENTAL_OWNER_INVALID"
    | "PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED"
    | "PORTFOLIO_INCREMENTAL_REFERENCE_NOT_FOUND"
    | "PORTFOLIO_INCREMENTAL_REFERENCE_CORRUPTED"
    | "PORTFOLIO_INCREMENTAL_REFERENCE_STALE"
    | "PORTFOLIO_INCREMENTAL_REFERENCE_CONFLICT";

  constructor(
    code:
      | "PORTFOLIO_INCREMENTAL_OWNER_INVALID"
      | "PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED"
      | "PORTFOLIO_INCREMENTAL_REFERENCE_NOT_FOUND"
      | "PORTFOLIO_INCREMENTAL_REFERENCE_CORRUPTED"
      | "PORTFOLIO_INCREMENTAL_REFERENCE_STALE"
      | "PORTFOLIO_INCREMENTAL_REFERENCE_CONFLICT",
  ) {
    super(code);
    this.name = "PortfolioIntelligenceReferencePersistenceError";
    this.code = code;
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function ownerHash(ownerId: string) {
  return sha256(`portfolio-intelligence-owner:${ownerId}`);
}

export function portfolioIntelligenceReferenceDocumentId(ownerId: string, portfolioId: string) {
  return sha256(`portfolio-intelligence-reference:${ownerHash(ownerId)}:${portfolioId}`);
}

function assertOwnerId(value: unknown) {
  const ownerId = String(value ?? "").trim();
  if (!ownerId || ownerId.length > 512) {
    throw new PortfolioIntelligenceReferencePersistenceError("PORTFOLIO_INCREMENTAL_OWNER_INVALID");
  }
  return ownerId;
}

function assertDefaultPortfolio(value: unknown) {
  if (String(value ?? "").trim() !== DEFAULT_PORTFOLIO_ID) {
    throw new PortfolioIntelligenceReferencePersistenceError(
      "PORTFOLIO_INCREMENTAL_PORTFOLIO_UNSUPPORTED",
    );
  }
  return DEFAULT_PORTFOLIO_ID;
}

function referenceTime(reference: PortfolioIntelligenceReference) {
  const value = Date.parse(reference.asOf);
  if (!Number.isFinite(value)) {
    throw new PortfolioIntelligenceReferencePersistenceError(
      "PORTFOLIO_INCREMENTAL_REFERENCE_CORRUPTED",
    );
  }
  return value;
}

function sanitizeStoredReference(value: unknown) {
  try {
    return sanitizePortfolioIntelligenceReference(value);
  } catch {
    throw new PortfolioIntelligenceReferencePersistenceError(
      "PORTFOLIO_INCREMENTAL_REFERENCE_CORRUPTED",
    );
  }
}

function storedPair(
  data: FirebaseFirestore.DocumentData,
  expectedOwnerHash: string,
  portfolioId: string,
): PortfolioIntelligencePersistedReferencePair {
  if (data.ownerHash !== expectedOwnerHash || data.portfolioId !== portfolioId) {
    throw new PortfolioIntelligenceReferencePersistenceError(
      "PORTFOLIO_INCREMENTAL_REFERENCE_NOT_FOUND",
    );
  }
  if (data.schemaVersion !== PORTFOLIO_INCREMENTAL_SCHEMA_VERSION || !data.current) {
    throw new PortfolioIntelligenceReferencePersistenceError(
      "PORTFOLIO_INCREMENTAL_REFERENCE_CORRUPTED",
    );
  }
  const current = sanitizeStoredReference(data.current);
  const previous = data.previous === null || data.previous === undefined
    ? null
    : sanitizeStoredReference(data.previous);
  if (previous && referenceTime(previous) >= referenceTime(current)) {
    throw new PortfolioIntelligenceReferencePersistenceError(
      "PORTFOLIO_INCREMENTAL_REFERENCE_CORRUPTED",
    );
  }
  return Object.freeze({ previous, current });
}

export function resolvePortfolioIntelligenceReferenceTransition(
  pair: PortfolioIntelligencePersistedReferencePair | null,
  current: PortfolioIntelligenceReference,
): PortfolioIntelligenceReferenceTransition {
  if (!pair) {
    return Object.freeze({
      result: Object.freeze({
        previous: null,
        current,
        stored: true,
        baselineState: "missing" as const,
      }),
      nextPair: Object.freeze({ previous: null, current }),
    });
  }

  const incomingTime = referenceTime(current);
  const storedTime = referenceTime(pair.current);
  if (incomingTime < storedTime) {
    throw new PortfolioIntelligenceReferencePersistenceError(
      "PORTFOLIO_INCREMENTAL_REFERENCE_STALE",
    );
  }
  if (incomingTime === storedTime) {
    if (current.fingerprint === pair.current.fingerprint) {
      return Object.freeze({
        result: Object.freeze({
          previous: pair.previous,
          current: pair.current,
          stored: false,
          baselineState: "found" as const,
        }),
        nextPair: null,
      });
    }
    throw new PortfolioIntelligenceReferencePersistenceError(
      "PORTFOLIO_INCREMENTAL_REFERENCE_CONFLICT",
    );
  }

  return Object.freeze({
    result: Object.freeze({
      previous: pair.current,
      current,
      stored: true,
      baselineState: "found" as const,
    }),
    nextPair: Object.freeze({ previous: pair.current, current }),
  });
}

export class FirestorePortfolioIntelligenceReferenceRepositoryCore
implements PortfolioIntelligenceReferenceRepository, PortfolioIntelligenceReferencePairReader {
  private readonly db: FirebaseFirestore.Firestore;
  private readonly fieldValue: FieldValueFactory;

  constructor(dependencies: FirestorePortfolioIntelligenceReferenceRepositoryDependencies) {
    this.db = dependencies.db;
    this.fieldValue = dependencies.fieldValue;
  }

  async readPair(input: Readonly<{
    ownerId: string;
    portfolioId: string;
  }>): Promise<PortfolioIntelligencePersistedReferencePair | null> {
    const ownerId = assertOwnerId(input.ownerId);
    const portfolioId = assertDefaultPortfolio(input.portfolioId);
    const expectedOwnerHash = ownerHash(ownerId);
    const document = this.db.collection(COLLECTION)
      .doc(portfolioIntelligenceReferenceDocumentId(ownerId, portfolioId));
    const snapshot = await document.get();
    if (!snapshot.exists) return null;
    return storedPair(snapshot.data() || {}, expectedOwnerHash, portfolioId);
  }

  async compareAndStore(input: Readonly<{
    ownerId: string;
    portfolioId: string;
    current: PortfolioIntelligenceReference;
  }>): Promise<PortfolioIntelligenceReferenceStoreResult> {
    const ownerId = assertOwnerId(input.ownerId);
    const portfolioId = assertDefaultPortfolio(input.portfolioId);
    const current = sanitizeStoredReference(input.current);
    const expectedOwnerHash = ownerHash(ownerId);
    const document = this.db.collection(COLLECTION)
      .doc(portfolioIntelligenceReferenceDocumentId(ownerId, portfolioId));

    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(document);
      const timestamp = this.fieldValue.serverTimestamp();

      if (!snapshot.exists) {
        const transition = resolvePortfolioIntelligenceReferenceTransition(null, current);
        transaction.create(document, {
          schemaVersion: PORTFOLIO_INCREMENTAL_SCHEMA_VERSION,
          ownerHash: expectedOwnerHash,
          portfolioId,
          previous: null,
          current,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        return transition.result;
      }

      const data = snapshot.data() || {};
      let pair: PortfolioIntelligencePersistedReferencePair;
      try {
        pair = storedPair(data, expectedOwnerHash, portfolioId);
      } catch (error) {
        if (
          error instanceof PortfolioIntelligenceReferencePersistenceError
          && error.code === "PORTFOLIO_INCREMENTAL_REFERENCE_CORRUPTED"
          && data.ownerHash === expectedOwnerHash
          && data.portfolioId === portfolioId
        ) {
          transaction.set(document, {
            schemaVersion: PORTFOLIO_INCREMENTAL_SCHEMA_VERSION,
            ownerHash: expectedOwnerHash,
            portfolioId,
            previous: null,
            current,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          return Object.freeze({
            previous: null,
            current,
            stored: true,
            baselineState: "invalid" as const,
          });
        }
        throw error;
      }
      const transition = resolvePortfolioIntelligenceReferenceTransition(pair, current);
      if (!transition.nextPair) {
        // An exact replay must not collapse or rotate the persisted pair.
        return transition.result;
      }

      transaction.set(document, {
        schemaVersion: PORTFOLIO_INCREMENTAL_SCHEMA_VERSION,
        ownerHash: expectedOwnerHash,
        portfolioId,
        previous: transition.nextPair.previous,
        current: transition.nextPair.current,
        createdAt: data.createdAt || timestamp,
        updatedAt: timestamp,
      });

      return transition.result;
    });
  }
}
