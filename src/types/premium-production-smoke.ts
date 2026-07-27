export type PremiumProductionSmokeEvidence = {
  schemaVersion: 1;
  evidenceVersion: "premium-production-smoke-v1";
  status: "passed" | "failed";
  releaseCommit: string;
  deploymentUrl: string;
  workflowRunId: string;
  workflowRunAttempt: string;
  ticker: string;
  startedAt: string;
  completedAt: string;
  checks: Array<{
    id: string;
    status: "passed" | "failed";
    metadata: Record<string, string | number | boolean | null>;
  }>;
  auditEventId: string | null;
  auditCorrelationId: string | null;
  peerSnapshotHash: string | null;
  blocker: string | null;
  evidenceHash: string;
};
