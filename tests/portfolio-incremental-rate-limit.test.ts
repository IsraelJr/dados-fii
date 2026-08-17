import assert from "node:assert/strict";
import test from "node:test";
import {
  PortfolioIncrementalRateLimit,
  PortfolioIncrementalRateLimitError,
  type PortfolioIncrementalRateLimitRepository,
} from "../src/lib/security/PortfolioIncrementalRateLimit";

type Call = Readonly<{ key: string; limit: number; windowMs: number }>;

function request(ip = "203.0.113.20") {
  return new Request("https://preview.example.test/api/portfolio/incremental-analysis/explanation", {
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
  });
}

test("rate limit persiste somente chave SHA-256 opaca e limites controlados", async () => {
  const calls: Call[] = [];
  const repository: PortfolioIncrementalRateLimitRepository = {
    async consume(key, options) {
      calls.push({ key, ...options });
      return { allowed: true, retryAfter: 0 };
    },
  };
  const limiter = new PortfolioIncrementalRateLimit(repository, { limit: 12, windowMs: 600_000 });
  const owner = "qa-user@example.test";
  const ip = "203.0.113.20";
  await limiter.consume(owner, request(ip));

  assert.equal(calls.length, 1);
  assert.match(calls[0].key, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(calls[0].key, /qa-user|example|203\.0\.113\.20/);
  assert.deepEqual({ limit: calls[0].limit, windowMs: calls[0].windowMs }, {
    limit: 12,
    windowMs: 600_000,
  });
});

test("rate limit é estável por usuário e trocar headers de rede não renova a cota", async () => {
  const keys: string[] = [];
  const repository: PortfolioIncrementalRateLimitRepository = {
    async consume(key) {
      keys.push(key);
      return { allowed: true, retryAfter: 0 };
    },
  };
  const limiter = new PortfolioIncrementalRateLimit(repository);
  await limiter.consume("owner-a", request("203.0.113.20"));
  await limiter.consume("owner-a", request("203.0.113.20"));
  await limiter.consume("owner-a", request("203.0.113.21"));
  await limiter.consume("owner-b", request("203.0.113.20"));
  assert.equal(keys[0], keys[1]);
  assert.equal(keys[0], keys[2]);
  assert.notEqual(keys[0], keys[3]);
});

test("rate limit distribuído falha fechado quando indisponível", async () => {
  const limiter = new PortfolioIncrementalRateLimit({
    async consume() {
      throw new Error("backend unavailable");
    },
  });
  await assert.rejects(
    limiter.consume("owner-a", request()),
    (error: unknown) => error instanceof PortfolioIncrementalRateLimitError
      && error.code === "PORTFOLIO_INCREMENTAL_RATE_LIMIT_UNAVAILABLE"
      && error.status === 503,
  );
});

test("rate limit rejeita excesso com retryAfter sem ampliar tentativas", async () => {
  const limiter = new PortfolioIncrementalRateLimit({
    async consume() {
      return { allowed: false, retryAfter: 37 };
    },
  });
  await assert.rejects(
    limiter.consume("owner-a", request()),
    (error: unknown) => error instanceof PortfolioIncrementalRateLimitError
      && error.code === "PORTFOLIO_INCREMENTAL_RATE_LIMITED"
      && error.status === 429
      && error.retryAfter === 37,
  );
});
