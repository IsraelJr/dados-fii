import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { nextRateLimitState, type RateLimitState } from "@/lib/security/RateLimitPolicy";

export class DistributedRateLimitRepository {
  async consume(key: string, options: { limit: number; windowMs: number }) {
    const reference = adminDb.collection("SecurityRateLimits").doc(key);
    return adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const data = snapshot.data() || {};
      const resetDate = typeof data.expiresAt?.toDate === "function"
        ? data.expiresAt.toDate()
        : new Date(data.expiresAt || 0);
      const current: RateLimitState | null = snapshot.exists
        ? {
            count: Number(data.count),
            resetsAt: resetDate.getTime(),
          }
        : null;
      const decision = nextRateLimitState(
        current,
        Date.now(),
        options.limit,
        options.windowMs,
      );
      transaction.set(reference, {
        count: decision.state.count,
        expiresAt: new Date(decision.state.resetsAt),
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: false });
      return {
        allowed: decision.allowed,
        remaining: decision.remaining,
        retryAfter: decision.retryAfter,
      };
    });
  }
}

export const distributedRateLimitRepository = new DistributedRateLimitRepository();
