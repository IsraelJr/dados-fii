import type {
  AutomaticAnalysisReadiness,
  AutomaticValidationStatus,
} from "./riskLabAutomatic";

export type RiskLabProductionSmokeStatus = "running" | "passed" | "failed";
export type RiskLabProductionSmokeCheckStatus = "passed" | "failed";

export interface RiskLabProductionSmokeCheck {
  id: string;
  status: RiskLabProductionSmokeCheckStatus;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface RiskLabProductionSmokeCase {
  caseId: string;
  ticker: string;
  mode: "live" | "deterministic";
  status: AutomaticValidationStatus | "rejected";
  analysisReadiness: AutomaticAnalysisReadiness | null;
  scanId: string | null;
  sourceCount: number;
  documentCount: number;
  monthlyStatus: "ready" | "incomplete" | "blocked" | null;
  detectorExecuted: boolean;
  classificationFinal: boolean;
  persisted: boolean;
  audited: boolean;
  premiumIntegrated: false;
  notificationsSent: false;
  message: string;
}

export interface RiskLabProductionSmokeEvidence {
  schemaVersion: 1;
  sprint: "3.4";
  runId: string;
  status: RiskLabProductionSmokeStatus;
  releaseCommit: string | null;
  deploymentUrl: string | null;
  environment: string | null;
  startedAt: string;
  completedAt: string | null;
  checks: RiskLabProductionSmokeCheck[];
  cases: RiskLabProductionSmokeCase[];
  blockers: string[];
  evidenceHash: string | null;
}

export interface PublicRiskLabProductionSmokeEvidence extends RiskLabProductionSmokeEvidence {
  evidenceUrl: "/api/system/risk-lab-production-smoke";
}
