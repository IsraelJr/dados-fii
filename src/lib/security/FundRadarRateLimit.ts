import { createHash } from "node:crypto";
import { FundRadarRateLimitError } from "@/lib/fund-radar/FundRadarRateLimitError";
import { distributedRateLimitRepository } from "@/lib/security/DistributedRateLimitRepository";

function key(ownerId: string) {
  const owner = String(ownerId || "").trim();
  if (!owner || owner.length > 512) throw new FundRadarRateLimitError("FUND_RADAR_RATE_LIMIT_UNAVAILABLE", 503);
  return createHash("sha256").update("fund-radar-mutation:v1\0", "utf8").update(owner, "utf8").digest("hex");
}

export async function consumeFundRadarRateLimit(ownerId: string) {
  let decision: Awaited<ReturnType<typeof distributedRateLimitRepository.consume>>;
  try {
    decision = await distributedRateLimitRepository.consume(key(ownerId), { limit: 30, windowMs: 10 * 60_000 });
  } catch (error) {
    if (error instanceof FundRadarRateLimitError) throw error;
    throw new FundRadarRateLimitError("FUND_RADAR_RATE_LIMIT_UNAVAILABLE", 503);
  }
  if (!decision.allowed) throw new FundRadarRateLimitError("FUND_RADAR_RATE_LIMITED", 429, decision.retryAfter);
}
