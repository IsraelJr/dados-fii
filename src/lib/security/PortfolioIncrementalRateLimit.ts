import { createHash } from "node:crypto";

export type PortfolioIncrementalRateLimitDecision = Readonly<{
  allowed: boolean;
  retryAfter: number;
}>;

export interface PortfolioIncrementalRateLimitRepository {
  consume(
    key: string,
    options: Readonly<{ limit: number; windowMs: number }>,
  ): Promise<PortfolioIncrementalRateLimitDecision>;
}

export class PortfolioIncrementalRateLimitError extends Error {
  readonly code:
    | "PORTFOLIO_INCREMENTAL_RATE_LIMITED"
    | "PORTFOLIO_INCREMENTAL_RATE_LIMIT_UNAVAILABLE";
  readonly status: 429 | 503;
  readonly retryAfter: number | null;

  constructor(
    code: PortfolioIncrementalRateLimitError["code"],
    status: PortfolioIncrementalRateLimitError["status"],
    retryAfter: number | null = null,
  ) {
    super(code);
    this.name = "PortfolioIncrementalRateLimitError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function normalizedOwner(value: string) {
  const owner = value.trim();
  if (!owner || owner.length > 512) {
    throw new PortfolioIncrementalRateLimitError(
      "PORTFOLIO_INCREMENTAL_RATE_LIMIT_UNAVAILABLE",
      503,
    );
  }
  return owner;
}

function opaqueKey(ownerId: string) {
  return createHash("sha256")
    .update("portfolio-incremental-explanation:v1", "utf8")
    .update("\u0000", "utf8")
    .update(normalizedOwner(ownerId), "utf8")
    .digest("hex");
}

export class PortfolioIncrementalRateLimit {
  private readonly repository: PortfolioIncrementalRateLimitRepository;
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(
    repository: PortfolioIncrementalRateLimitRepository,
    options: Readonly<{ limit?: number; windowMs?: number }> = {},
  ) {
    this.repository = repository;
    this.limit = Math.min(Math.max(options.limit ?? 12, 1), 50);
    this.windowMs = Math.min(Math.max(options.windowMs ?? 10 * 60_000, 1_000), 60 * 60_000);
  }

  async consume(ownerId: string, _request: Request) {
    let decision: PortfolioIncrementalRateLimitDecision;
    try {
      decision = await this.repository.consume(opaqueKey(ownerId), {
        limit: this.limit,
        windowMs: this.windowMs,
      });
    } catch {
      throw new PortfolioIncrementalRateLimitError(
        "PORTFOLIO_INCREMENTAL_RATE_LIMIT_UNAVAILABLE",
        503,
      );
    }
    if (!decision.allowed) {
      throw new PortfolioIncrementalRateLimitError(
        "PORTFOLIO_INCREMENTAL_RATE_LIMITED",
        429,
        Number.isFinite(decision.retryAfter) ? Math.max(0, decision.retryAfter) : 0,
      );
    }
  }
}
