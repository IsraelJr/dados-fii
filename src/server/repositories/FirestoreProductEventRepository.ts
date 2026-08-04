import { createHash } from "node:crypto";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import type { ProductEvent } from "@/lib/product/ProductEvent";

const COLLECTION = "ProductEvents";

function subjectHash(ownerId: string) {
  return createHash("sha256").update(ownerId, "utf8").digest("hex");
}

export class FirestoreProductEventRepository {
  async append(ownerId: string, event: ProductEvent): Promise<void> {
    await adminDb.collection(COLLECTION).add({
      subjectHash: subjectHash(ownerId),
      name: event.name,
      schemaVersion: event.schemaVersion,
      occurredAt: event.occurredAt,
      createdAt: adminFieldValue.serverTimestamp(),
    });
  }
}
