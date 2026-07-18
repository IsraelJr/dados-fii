import type { DividendStressWindow, VerifiedDividendNotice } from "./riskLabDividendStress";
import type { DividendSeriesReadiness } from "./riskLabSeriesReadiness";

export const DIVIDEND_STRESS_RULESET_VERSION = "dividend-stress-v0.1.0";

export type DividendStressRunTicker = "MCCI11" | "RBRY11";

export interface DividendStressRunExternalEffects {
  alertsCreated: false;
  notificationsSent: false;
  premiumUpdated: false;
}

export interface DividendStressRun {
  id: string;
  ticker: DividendStressRunTicker;
  rulesetVersion: string;
  inputHash: string;
  observationIds: string[];
  competenceMonths: string[];
  executedAt: string;
  executedBy: string;
  manualConfirmation: true;
  classificationFinal: false;
  limitations: ["material_credit_events_not_reviewed"];
  result: DividendStressWindow;
  readiness: DividendSeriesReadiness;
  externalEffects: DividendStressRunExternalEffects;
}

export interface DividendStressRunStatus {
  enabled: boolean;
  ticker: DividendStressRunTicker;
  readiness: DividendSeriesReadiness;
  latestRun: DividendStressRun | null;
}

export interface DividendStressRunResult {
  run: DividendStressRun;
  created: boolean;
}

export interface VerifiedDividendNoticeReader {
  listByTicker(ticker: string): Promise<VerifiedDividendNotice[]>;
}

export interface DividendStressRunRepository {
  getById(id: string): Promise<DividendStressRun | null>;
  save(run: DividendStressRun): Promise<DividendStressRun>;
  listLatestByTicker(ticker: DividendStressRunTicker, limit?: number): Promise<DividendStressRun[]>;
}
