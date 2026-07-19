import type { FundKind } from "@/types/regulatory";

export const PHASE2_CLOSURE_SCHEMA_VERSION = 1 as const;

export type Phase2ClosureStatus = "pending" | "ready" | "running" | "passed" | "blocked" | "failed";
export type Phase2ClosurePhase = "catalog-preview" | "catalog-apply" | "production-smoke" | "complete";
export type Phase2ClosureCheckStatus = "passed" | "warning" | "failed";

export type Phase2ClosureCheck = {
  id: string;
  status: Phase2ClosureCheckStatus;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type Phase2CatalogEvidence = {
  runId: string;
  sourceHash: string;
  planHash: string;
  sourceMatchPercent: number;
  basicCoveragePercent: number;
  essentialCoveragePercent: number;
  duplicateCnpjGroups: number;
  activeFunds: number;
  inactiveFunds: number;
  underReviewFunds: number;
  planned: number;
  added: number;
  updated: number;
  inactivated: number;
  reactivated: number;
  directoryTotal: number | null;
  auditGeneratedAt: string | null;
  verifiedAt: string | null;
};

export type Phase2SmokeSample = {
  ticker: string;
  kind: Exclude<FundKind, "UNKNOWN">;
  basicDataComplete: boolean;
  freeReport: boolean;
  aiInsights: boolean;
  premiumReport: boolean;
  aiModel: string | null;
  promptVersion: string | null;
  premiumReportVersion: string | null;
};

export type Phase2SmokeEvidence = {
  validationRunId: string;
  validationStatus: "completed" | "failed";
  validationHealthScore: number;
  validationProcessed: number;
  systemHealthOk: boolean;
  systemHealthScore: number;
  samples: Phase2SmokeSample[];
};

export type Phase2ClosureState = {
  schemaVersion: typeof PHASE2_CLOSURE_SCHEMA_VERSION;
  sprint: "2.12";
  status: Phase2ClosureStatus;
  phase: Phase2ClosurePhase;
  attempt: number;
  actor: string;
  releaseCommit: string | null;
  deploymentUrl: string | null;
  runId: string | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  retryAfter: string | null;
  blockers: string[];
  error: string | null;
  checks: Phase2ClosureCheck[];
  catalog: Phase2CatalogEvidence | null;
  smoke: Phase2SmokeEvidence | null;
  evidenceHash: string | null;
};

export type PublicPhase2ClosureEvidence = Omit<Phase2ClosureState, "actor" | "error" | "retryAfter"> & {
  evidenceUrl: "/api/system/phase-2-closure";
};
