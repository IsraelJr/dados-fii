import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import type { EditorialEvent } from "@/lib/editorial/EditorialEvent";

const COLLECTION = "EditorialEvents";

export class FirestoreEditorialEventRepository {
  async append(event: EditorialEvent): Promise<void> {
    await adminDb.collection(COLLECTION).add({
      name: event.name,
      page: event.page,
      entryClass: event.entryClass,
      destination: event.destination ?? null,
      origin: event.origin,
      schemaVersion: event.schemaVersion,
      correlationId: event.correlationId,
      occurredAt: event.occurredAt,
      expiresAt: event.expiresAt,
      createdAt: adminFieldValue.serverTimestamp(),
    });
  }
}
