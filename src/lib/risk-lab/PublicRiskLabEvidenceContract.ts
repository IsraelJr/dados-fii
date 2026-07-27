import type { PublicRiskLabCohortBacktestEvidence } from "@/types/riskLabCohortBacktest";

export type PublicEvidenceDecision =
  | { statusCode: 404; status: "not-found"; ok: false }
  | { statusCode: 409; status: "release-mismatch" | "superseded"; ok: false }
  | { statusCode: 202; status: "running"; ok: false }
  | { statusCode: 422; status: "failed"; ok: false }
  | { statusCode: 200; status: "passed"; ok: true };

export function decidePublicEvidenceStatus(
  evidence: PublicRiskLabCohortBacktestEvidence | null,
  activeRelease: string | null,
  expectedRunId: string,
  requestedRelease: string | null,
): PublicEvidenceDecision {
  if (!evidence) return { statusCode: 404, status: "not-found", ok: false };
  if (
    !activeRelease
    || evidence.releaseCommit !== activeRelease
    || (requestedRelease !== null && requestedRelease !== activeRelease)
  ) {
    return { statusCode: 409, status: "release-mismatch", ok: false };
  }
  if (evidence.runId !== expectedRunId || evidence.methodologyVersion !== "2.0.0") {
    return { statusCode: 409, status: "superseded", ok: false };
  }
  if (evidence.status === "running") return { statusCode: 202, status: "running", ok: false };
  if (evidence.status === "failed") return { statusCode: 422, status: "failed", ok: false };
  return { statusCode: 200, status: "passed", ok: true };
}
