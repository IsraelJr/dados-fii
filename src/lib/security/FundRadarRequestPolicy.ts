import { FundRadarError, normalizeFundRadarTicker } from "@/lib/fund-radar/FundRadar";

export class FundRadarRequestError extends Error {
  readonly code: "FUND_RADAR_INVALID_CONTENT_TYPE" | "FUND_RADAR_PAYLOAD_TOO_LARGE" | "FUND_RADAR_INVALID_JSON" | "FUND_RADAR_INVALID_PAYLOAD";
  readonly status: 400 | 413 | 415;

  constructor(code: FundRadarRequestError["code"], status: FundRadarRequestError["status"]) {
    super(code);
    this.name = "FundRadarRequestError";
    this.code = code;
    this.status = status;
  }
}

async function objectBody(request: Request, expectedKeys: readonly string[]) {
  if (String(request.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new FundRadarRequestError("FUND_RADAR_INVALID_CONTENT_TYPE", 415);
  }
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > 1_024) throw new FundRadarRequestError("FUND_RADAR_PAYLOAD_TOO_LARGE", 413);
  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > 1_024) throw new FundRadarRequestError("FUND_RADAR_PAYLOAD_TOO_LARGE", 413);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new FundRadarRequestError("FUND_RADAR_INVALID_JSON", 400);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FundRadarRequestError("FUND_RADAR_INVALID_PAYLOAD", 400);
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new FundRadarRequestError("FUND_RADAR_INVALID_PAYLOAD", 400);
  }
  return value as Record<string, unknown>;
}

export async function readFundRadarFollowIntent(request: Request) {
  const value = await objectBody(request, ["ticker"]);
  try {
    return Object.freeze({ ticker: normalizeFundRadarTicker(value.ticker) });
  } catch (error) {
    if (error instanceof FundRadarError) throw new FundRadarRequestError("FUND_RADAR_INVALID_PAYLOAD", 400);
    throw error;
  }
}

export async function readFundRadarNotificationIntent(request: Request) {
  const value = await objectBody(request, ["notificationsEnabled", "ticker"]);
  if (typeof value.notificationsEnabled !== "boolean") throw new FundRadarRequestError("FUND_RADAR_INVALID_PAYLOAD", 400);
  try {
    return Object.freeze({ ticker: normalizeFundRadarTicker(value.ticker), notificationsEnabled: value.notificationsEnabled });
  } catch (error) {
    if (error instanceof FundRadarError) throw new FundRadarRequestError("FUND_RADAR_INVALID_PAYLOAD", 400);
    throw error;
  }
}
