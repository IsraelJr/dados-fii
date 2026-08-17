import type { VerifiedWalletIdentityDependencies } from "./VerifiedWalletIdentityCore";

const SESSION_COLLECTION = "WalletSessions";
const USER_COLLECTION = "User";

export function firestoreVerifiedWalletIdentityDependencies(
  db: FirebaseFirestore.Firestore,
  now?: () => number,
): VerifiedWalletIdentityDependencies {
  return Object.freeze({
    async readSession(documentId: string) {
      const snapshot = await db.collection(SESSION_COLLECTION).doc(documentId).get();
      return snapshot.exists ? snapshot.data() || {} : null;
    },
    async findOwnerId(email: string) {
      const users = db.collection(USER_COLLECTION);
      const direct = await users.doc(email).get();
      if (direct.exists) return direct.id;
      const query = await users.where("email", "==", email).limit(1).get();
      return query.docs.at(0)?.id ?? null;
    },
    ...(now ? { now } : {}),
  });
}
