import { createHash } from "node:crypto";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import type {
  PremiumDiscoveryEvent,
  PremiumDiscoveryRepository,
  PremiumInterestRecord,
} from "@/lib/premium-discovery";

const INTEREST_COLLECTION = "PremiumBetaInterest";
const EVENT_COLLECTION = "PremiumDiscoveryEvents";

function subjectHash(uid: string) {
  return createHash("sha256").update(uid, "utf8").digest("hex");
}

export class FirestorePremiumDiscoveryRepository implements PremiumDiscoveryRepository {
  async hasInterest(uid: string): Promise<boolean> {
    const snapshot = await adminDb.collection(INTEREST_COLLECTION).doc(uid).get();
    return snapshot.exists;
  }

  async saveInterest(record: PremiumInterestRecord): Promise<void> {
    await adminDb.collection(INTEREST_COLLECTION).doc(record.subject.uid).set({
      email: record.subject.email,
      origin: record.origin,
      motivation: record.motivation,
      status: "requested",
      requestedAt: record.requestedAt,
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });
  }

  async appendEvent(uid: string, event: PremiumDiscoveryEvent): Promise<void> {
    await adminDb.collection(EVENT_COLLECTION).add({
      subjectHash: subjectHash(uid),
      name: event.name,
      schemaVersion: event.schemaVersion,
      origin: event.origin,
      audience: event.audience,
      correlationId: event.correlationId,
      retentionDays: event.retentionDays,
      occurredAt: event.occurredAt,
      createdAt: adminFieldValue.serverTimestamp(),
    });
  }
}
