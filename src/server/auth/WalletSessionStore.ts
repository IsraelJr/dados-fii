import {
  normalizeWalletSessionEmail,
  WALLET_SESSION_COLLECTION,
  WALLET_SESSION_FAMILY_COLLECTION,
  walletSessionDocumentId,
  walletSessionFamilyDocumentId,
  walletSessionFamilyMatches,
  walletSessionMatches,
  type WalletSessionFamilyRecord,
  type WalletSessionRecord,
} from "@/server/auth/WalletSessionPolicy";

type SnapshotLike = Readonly<{
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}>;

type ReferenceLike = Readonly<{
  get(): Promise<SnapshotLike>;
}>;

type TransactionLike = Readonly<{
  get(reference: ReferenceLike): Promise<SnapshotLike>;
  set(reference: ReferenceLike, value: Record<string, unknown>, options?: { merge?: boolean }): void;
  delete(reference: ReferenceLike): void;
}>;

export type WalletSessionDatabase = Readonly<{
  collection(name: string): {
    doc(id: string): ReferenceLike;
  };
  runTransaction<T>(callback: (transaction: TransactionLike) => Promise<T>): Promise<T>;
}>;

export class WalletSessionFamilyRevokedError extends Error {
  constructor() {
    super("A família da sessão foi revogada.");
    this.name = "WalletSessionFamilyRevokedError";
  }
}

type FirebaseSessionInput = Readonly<{
  email: string;
  uid: string;
  firebaseAuthTime: number;
  token: string;
  expiresAt: Date;
  now?: Date;
}>;

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function familyIdentityMatches(
  family: WalletSessionFamilyRecord,
  input: Pick<FirebaseSessionInput, "email" | "uid" | "firebaseAuthTime">,
) {
  return normalizeWalletSessionEmail(family.email) === normalizeWalletSessionEmail(input.email)
    && String(family.uid || "") === input.uid
    && positiveInteger(family.firebaseAuthTime) === input.firebaseAuthTime;
}

export class WalletSessionStore {
  private readonly database: WalletSessionDatabase;
  private readonly serverTimestamp: () => unknown;

  constructor(
    database: WalletSessionDatabase,
    serverTimestamp: () => unknown = () => new Date(),
  ) {
    this.database = database;
    this.serverTimestamp = serverTimestamp;
  }

  async issueFirebaseSession(input: FirebaseSessionInput) {
    const email = normalizeWalletSessionEmail(input.email);
    const uid = String(input.uid || "").trim();
    const firebaseAuthTime = positiveInteger(input.firebaseAuthTime);
    const token = String(input.token || "");
    if (!email || !uid || !firebaseAuthTime || !token) {
      throw new Error("Identidade Firebase inválida para a sessão da carteira.");
    }

    const familyId = walletSessionFamilyDocumentId(uid, firebaseAuthTime);
    const familyReference = this.database.collection(WALLET_SESSION_FAMILY_COLLECTION).doc(familyId);
    const sessionReference = this.database.collection(WALLET_SESSION_COLLECTION).doc(walletSessionDocumentId(email, token));
    const now = input.now ?? new Date();

    const generation = await this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(familyReference);
      const family = snapshot.data() || {};
      if (snapshot.exists && (!familyIdentityMatches(family, { email, uid, firebaseAuthTime }) || family.status !== "active")) {
        throw new WalletSessionFamilyRevokedError();
      }

      const currentGeneration = snapshot.exists ? positiveInteger(family.currentGeneration) : 0;
      const nextGeneration = currentGeneration + 1;
      transaction.set(familyReference, {
        email,
        uid,
        firebaseAuthTime,
        status: "active",
        currentGeneration: nextGeneration,
        revokedBeforeGeneration: snapshot.exists ? positiveInteger(family.revokedBeforeGeneration) : 1,
        createdAt: snapshot.exists ? family.createdAt || now : now,
        updatedAt: this.serverTimestamp(),
      }, { merge: false });
      transaction.set(sessionReference, {
        email,
        uid,
        source: "firebase",
        familyId,
        generation: nextGeneration,
        createdAt: now,
        expiresAt: input.expiresAt,
      }, { merge: false });
      return nextGeneration;
    });

    return { familyId, generation };
  }

  async verify(emailValue: unknown, tokenValue: unknown, nowMs = Date.now()) {
    const email = normalizeWalletSessionEmail(emailValue);
    const token = String(tokenValue || "");
    if (!email || !token) return false;

    const session = await this.database.collection(WALLET_SESSION_COLLECTION)
      .doc(walletSessionDocumentId(email, token))
      .get();
    if (!session.exists) return false;
    const sessionData = session.data() || {};
    if (!walletSessionMatches(sessionData, email, nowMs)) return false;

    const familyId = String(sessionData.familyId || "");
    if (!familyId) return sessionData.source !== "firebase";
    const family = await this.database.collection(WALLET_SESSION_FAMILY_COLLECTION).doc(familyId).get();
    return family.exists && walletSessionFamilyMatches(sessionData, family.data() || {}, email, nowMs);
  }

  async revokeFamily(emailValue: unknown, tokenValue: unknown, now = new Date()) {
    const email = normalizeWalletSessionEmail(emailValue);
    const token = String(tokenValue || "");
    if (!email || !token) return;

    const sessionReference = this.database.collection(WALLET_SESSION_COLLECTION)
      .doc(walletSessionDocumentId(email, token));
    await this.database.runTransaction(async (transaction) => {
      const sessionSnapshot = await transaction.get(sessionReference);
      if (!sessionSnapshot.exists) return;
      const session = sessionSnapshot.data() || {};
      if (normalizeWalletSessionEmail(session.email) !== email) return;

      const familyId = String(session.familyId || "");
      if (!familyId) {
        transaction.delete(sessionReference);
        return;
      }

      const familyReference = this.database.collection(WALLET_SESSION_FAMILY_COLLECTION).doc(familyId);
      const familySnapshot = await transaction.get(familyReference);
      const family = familySnapshot.data() || {};
      if (!familySnapshot.exists || normalizeWalletSessionEmail(family.email) !== email) return;

      const currentGeneration = Math.max(
        positiveInteger(family.currentGeneration),
        positiveInteger(session.generation),
      );
      transaction.set(familyReference, {
        status: "revoked",
        revokedBeforeGeneration: currentGeneration + 1,
        revokedAt: family.revokedAt || now,
        updatedAt: this.serverTimestamp(),
      }, { merge: true });
    });
  }
}
