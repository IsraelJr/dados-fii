export type RateLimitState = {
  count: number;
  resetsAt: number;
};

export function nextRateLimitState(
  current: RateLimitState | null,
  now: number,
  limit: number,
  windowMs: number,
) {
  const active = current
    && Number.isInteger(current.count)
    && current.count >= 0
    && Number.isFinite(current.resetsAt)
    && current.resetsAt > now;
  const state: RateLimitState = active
    ? { count: current.count + 1, resetsAt: current.resetsAt }
    : { count: 1, resetsAt: now + windowMs };
  return {
    state,
    allowed: state.count <= limit,
    remaining: Math.max(0, limit - state.count),
    retryAfter: Math.max(1, Math.ceil((state.resetsAt - now) / 1_000)),
  };
}
