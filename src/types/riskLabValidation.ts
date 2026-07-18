import type { RiskFamily } from "./riskLab";

export type ValidationCaseRole =
  | "severe_deterioration"
  | "healthy_control"
  | "reversible_stress";

export type ValidationEventStatus =
  | "pending_primary_source"
  | "primary_source_verified";

export interface ValidationDateRange {
  start: string;
  end: string | null;
}

export interface ValidationBombDefinition {
  type: string;
  definition: string;
  eventDate: string | null;
  status: ValidationEventStatus;
  primarySourceUrl: string | null;
}

export interface ValidationStressDefinition {
  definition: string;
  stressStart: string | null;
  stressEnd: string | null;
  recoveryDate: string | null;
  status: ValidationEventStatus;
  primarySourceUrls: string[];
}

export interface OutOfSampleValidationCase {
  ticker: string;
  family: RiskFamily;
  role: ValidationCaseRole;
  analysisWindow: ValidationDateRange;
  hypothesis: string;
  bomb: ValidationBombDefinition | null;
  stress: ValidationStressDefinition | null;
  healthyControlCriterion: string | null;
  dataExtractionStarted: boolean;
}

export interface OutOfSampleCohortMetadata {
  id: string;
  version: string;
  rulesetVersion: string;
  status: "pre_registered_pending_primary_verification" | "ready_for_execution";
  registeredAt: string;
  family: RiskFamily;
  executionAllowed: boolean;
  blockReason: string | null;
  selectionPolicy: string;
  prohibitedActions: string[];
}

export interface OutOfSampleCohort {
  metadata: OutOfSampleCohortMetadata;
  cases: OutOfSampleValidationCase[];
}
