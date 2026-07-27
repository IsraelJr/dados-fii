import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import {
  ObservabilityService,
  type ObservabilityEventInput,
  type ObservabilitySink,
  type ObservabilityWriteOptions,
} from "@/lib/observability/ObservabilityService";

export {
  ObservabilityPersistenceError,
  ObservabilityService,
} from "@/lib/observability/ObservabilityService";
export type {
  ObservabilityEventInput,
  ObservabilitySink,
  ObservabilityWriteOptions,
} from "@/lib/observability/ObservabilityService";

const OBSERVABILITY_COLLECTION = "AppObservabilityEvents";

class FirestoreObservabilitySink implements ObservabilitySink {
  async append(event: Record<string, unknown>) {
    await adminDb.collection(OBSERVABILITY_COLLECTION).add({
      ...event,
      createdAt: adminFieldValue.serverTimestamp(),
    });
  }
}

export const observabilityService = new ObservabilityService(new FirestoreObservabilitySink());

export function logObservabilityEvent(
  input: ObservabilityEventInput,
  options?: ObservabilityWriteOptions,
) {
  return observabilityService.record(input, options);
}

export const OBSERVABILITY_COLLECTION_NAME = OBSERVABILITY_COLLECTION;
