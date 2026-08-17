export class FundRadarIdentityError extends Error {
  readonly code: "FUND_RADAR_AUTH_REQUIRED" | "FUND_RADAR_AUTH_FORBIDDEN";
  readonly status: 401 | 403;

  constructor(code: FundRadarIdentityError["code"], status: FundRadarIdentityError["status"]) {
    super(code);
    this.name = "FundRadarIdentityError";
    this.code = code;
    this.status = status;
  }
}
