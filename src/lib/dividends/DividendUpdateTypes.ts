export const DIVIDEND_UPDATE_RULE_VERSION = "dividend-update-v2";

export type DividendUpdateContext = {
  actor: string;
  origin: "admin" | "cron";
  correlationId: string;
  idempotencyKey: string;
};

export type DividendUpdateCompletedResult = {
  status: "completed";
  ticker: string;
  year: number;
  fetchedMonths: string[];
  currentMonth: string;
  currentMonthIncluded: boolean;
  indicatorsUpdated: boolean;
  changed: boolean;
  dataHash: string;
  replayed: boolean;
};

export type DividendUpdateNotFoundResult = {
  status: "not_found";
  ticker: string;
  replayed: boolean;
};

export type DividendUpdateResult =
  | DividendUpdateCompletedResult
  | DividendUpdateNotFoundResult;
