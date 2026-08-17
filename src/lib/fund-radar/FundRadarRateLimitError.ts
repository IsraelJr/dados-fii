export class FundRadarRateLimitError extends Error {
  readonly code: "FUND_RADAR_RATE_LIMITED" | "FUND_RADAR_RATE_LIMIT_UNAVAILABLE";
  readonly status: 429 | 503;
  readonly retryAfter: number | null;

  constructor(code: FundRadarRateLimitError["code"], status: FundRadarRateLimitError["status"], retryAfter: number | null = null) {
    super(code);
    this.name = "FundRadarRateLimitError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
