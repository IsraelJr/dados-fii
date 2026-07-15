import type { SystemHealth, ValidationRun } from "@/types/regulatory";

export type OperationMetric = {
  operation: string;
  requests: number;
  successes: number;
  failures: number;
  retries: number;
  totalDurationMs: number;
  averageDurationMs: number;
  maxDurationMs: number;
  lastDurationMs: number;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
};

export type SystemObservability = {
  generatedAt: string;
  uptimeSeconds: number;
  summary: {
    requests: number;
    successes: number;
    failures: number;
    retries: number;
    averageDurationMs: number;
    maxDurationMs: number;
  };
  operations: OperationMetric[];
  ingestion: {
    status: string;
    processed: number;
    valid: number;
    invalid: number;
    latestRunAt: string | null;
  };
  parser: {
    healthy: number;
    degraded: number;
    down: number;
    successRate: number;
  };
  qa: {
    healthScore: number;
    errors: number;
    warnings: number;
    status: string;
  };
  publication: {
    publications: number;
    rollbacks: number;
    failures: number;
    lastEventAt: string | null;
  };
  cache: {
    fundHitRate: number;
    marketHitRate: number;
    aiHitRate: number;
  };
  health: SystemHealth;
  latestValidation: Omit<ValidationRun, "results"> | null;
};
