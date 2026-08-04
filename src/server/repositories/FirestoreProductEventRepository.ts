import { createHash } from "node:crypto";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import type { ProductEvent } from "@/lib/product/ProductEvent";

const COLLECTION = "ProductEvents";

function subjectHash(subjectId: string) {
  return createHash("sha256").update(subjectId, "utf8").digest("hex");
}

export class FirestoreProductEventRepository {
  async append(subjectId: string, event: ProductEvent): Promise<void> {
    await adminDb.collection(COLLECTION).add({
      subjectHash: subjectHash(subjectId),
      name: event.name,
      schemaVersion: event.schemaVersion,
      occurredAt: event.occurredAt,
      createdAt: adminFieldValue.serverTimestamp(),
    });
  }
}
