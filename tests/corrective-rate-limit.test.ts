import assert from "node:assert/strict";
import test from "node:test";
import { nextRateLimitState } from "../src/lib/security/RateLimitPolicy";

test("rate limit distribuído bloqueia no limite e reinicia somente após a janela", () => {
  const now = Date.parse("2026-07-27T12:00:00.000Z");
  const first = nextRateLimitState(null, now, 2, 60_000);
  assert.deepEqual(first, {
    state: { count: 1, resetsAt: now + 60_000 },
    allowed: true,
    remaining: 1,
    retryAfter: 60,
  });
  const second = nextRateLimitState(first.state, now + 1_000, 2, 60_000);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
  const blocked = nextRateLimitState(second.state, now + 2_000, 2, 60_000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 58);
  const reset = nextRateLimitState(blocked.state, now + 60_000, 2, 60_000);
  assert.equal(reset.allowed, true);
  assert.equal(reset.state.count, 1);
  assert.equal(reset.state.resetsAt, now + 120_000);
});
