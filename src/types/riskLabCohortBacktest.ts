import type {
  AutomaticCreditEventScreenStatus,
  AutomaticValidationStatus,
} from "./riskLabAutomatic";
import type { DividendStressStatus } from "./riskLabDividendStress";
import type { ValidationCaseRole } from "./riskLabValidation";

export type CohortBacktestOutcome =
  | "true_positive"
  | "true_negative"
  | "false_positive"
  | "false_negative"
  | "inconclusive";

export type CohortBacktestStatus = "running" | "passed" | "failed";
export type CohortBacktestCheckStatus = "passed" | "failed";
export type CohortPrimaryVerificationStatus = "verified" | "blocked";

export interface CohortPrimaryEvidence {
  observationId: string;
  kind: "dividend_notice" | "credit_event" | "source_coverage";
  documentId: string;
  knownAt: string;
  sourceUrl: string;
  excerpt: string;
  page: number;
  sourceHash: string;
  sourceVersion: string;
  protocolHash: string | null;
  protocolVersion: number | null;
}

export interface CohortStructuredBlocker {
  code: string;
  stage: "catalog" | "source" | "dividend-series" | "credit-screen" | "ground-truth" | "detector" | "methodology";
  message: string;
  sourceUrl: string | null;
  year: number | null;
}

export interface CohortGroundTruth {
  status: CohortPrimaryVerificationStatus;
  eventAt: string | null;
  stressAt: string | null;
  recoveryAt: string | null;
  sourceCoveragePercent: number;
  dividendObservationCount: number;
  longestContiguousSequence: number;
  verificationHash: string;
  evidence: CohortPrimaryEvidence[];
  blockers: CohortStructuredBlocker[];
}

export interface CohortBacktestCaseResult {
  ticker: string;
  role: ValidationCaseRole;
  status: AutomaticValidationStatus;
  outcome: CohortBacktestOutcome;
  detectorStatus: DividendStressStatus | null;
  creditScreenStatus: AutomaticCreditEventScreenStatus;
  firstSignalAt?: string | null;
  leadTimeDays: number | null;
  sourceCoveragePercent: number;
  primaryEvidenceComplete: boolean;
  lookAheadDetected: boolean;
  evidence: CohortPrimaryEvidence[];
  blockers: string[];
  structuredBlockers?: CohortStructuredBlocker[];
  groundTruth?: CohortGroundTruth;
  premiumIntegrated: false;
  notificationsSent: false;
}

export interface CohortBacktestMetrics {
  totalCases: number;
  conclusiveCases: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  inconclusiveCases: number;
  coveragePercent: number;
  averageLeadTimeDays: number | null;
  minimumLeadTimeDays: number | null;
  maximumLeadTimeDays: number | null;
}

export interface CohortBacktestCheck {
  id: string;
  status: CohortBacktestCheckStatus;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface RiskLabCohortBacktestEvidence {
  schemaVersion: 1 | 2;
  sprint: "3.5";
  runId: string;
  attemptId?: string;
  supersedesRunId?: string | null;
  previousEvidenceHash?: string | null;
  methodologyVersion?: "2.0.0";
  status: CohortBacktestStatus;
  releaseCommit: string | null;
  deploymentUrl: string | null;
  environment: string | null;
  rulesetVersion: "0.1.0";
  cohortId: "risk-lab-credit-oos-v0.1";
  cohortVersion: "0.1.0";
  cohortIdentityHash: string;
  sourceExecutionAllowed: boolean;
  executionAllowed: boolean;
  performanceReviewRequired?: boolean;
  startedAt: string;
  completedAt: string | null;
  cases: CohortBacktestCaseResult[];
  metrics: CohortBacktestMetrics;
  checks: CohortBacktestCheck[];
  blockers: string[];
  structuredBlockers?: CohortStructuredBlocker[];
  premiumIntegrated: false;
  notificationsSent: false;
  evidenceHash: string | null;
}

export interface PublicRiskLabCohortBacktestEvidence extends RiskLabCohortBacktestEvidence {
  evidenceUrl: "/api/system/risk-lab-cohort-backtest";
}
