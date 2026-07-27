import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import type { ProductEvent } from "@/lib/product/ProductEvent";

const COLLECTION = "ProductEvents";

export class FirestoreProductEventRepository {
  async append(ownerId: string, event: ProductEvent): Promise<void> {
    await adminDb.collection(COLLECTION).add({
      ownerId,
      name: event.name,
      schemaVersion: event.schemaVersion,
      occurredAt: event.occurredAt,
      createdAt: adminFieldValue.serverTimestamp(),
    });
  }
}
