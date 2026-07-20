import type { RiskLabCohortBacktestEvidence } from "@/types/riskLabCohortBacktest";

const RUN_COLLECTION = "RiskLabCohortBacktestRuns";
const ATTEMPT_COLLECTION = "RiskLabCohortBacktestAttempts";
const AUDIT_COLLECTION = "RiskLabCohortBacktestAudit";
const LOCK_COLLECTION = "RiskLabCohortBacktestLocks";
const LOCK_TTL_MS = 8 * 60_000;
export const COHORT_LOCK_STALE_AFTER_MS = 7 * 60_000;

function safeDocument<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertRunId(value: string) {
  if (!/^risk-lab-3-5-[a-z0-9-]{8,80}$/.test(value)) {
    throw new Error("Identificador do backtest da coorte inválido.");
  }
}

function assertAttemptId(value: string) {
  if (!/^risk-lab-3-5-attempt-\d{14}-[a-f0-9-]{8,36}$/.test(value)) {
    throw new Error("Identificador imutável da tentativa inválido.");
  }
}

export interface CohortBacktestLockState {
  owner?: string;
  acquiredAt?: string;
  expiresAt?: string;
}

export function isCohortBacktestLockActive(
  current: CohortBacktestLockState | undefined,
  nowMs = Date.now(),
) {
  if (!current?.expiresAt || !current.acquiredAt) return false;
  const expiresAt = Date.parse(current.expiresAt);
  const acquiredAt = Date.parse(current.acquiredAt);
  if (!Number.isFinite(expiresAt) || !Number.isFinite(acquiredAt)) return false;
  return expiresAt > nowMs && acquiredAt > nowMs - COHORT_LOCK_STALE_AFTER_MS;
}

async function database() {
  const { adminDb } = await import("@/lib/firebaseAdmin");
  return adminDb;
}

export class RiskLabCohortBacktestStore {
  async get(runId: string): Promise<RiskLabCohortBacktestEvidence | null> {
    assertRunId(runId);
    const db = await database();
    const snapshot = await db.collection(RUN_COLLECTION).doc(runId).get();
    return snapshot.exists ? snapshot.data() as RiskLabCohortBacktestEvidence : null;
  }

  async latest(): Promise<RiskLabCohortBacktestEvidence | null> {
    const db = await database();
    const snapshot = await db.collection(RUN_COLLECTION).doc("latest").get();
    return snapshot.exists ? snapshot.data() as RiskLabCohortBacktestEvidence : null;
  }

  async acquireLock(runId: string, owner: string): Promise<boolean> {
    assertRunId(runId);
    const db = await database();
    const reference = db.collection(LOCK_COLLECTION).doc(runId);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = snapshot.data() as CohortBacktestLockState | undefined;
      const nowMs = Date.now();
      const active = isCohortBacktestLockActive(current, nowMs);
      if (active && current?.owner !== owner) return false;
      transaction.set(reference, {
        runId,
        owner,
        acquiredAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(nowMs + LOCK_TTL_MS).toISOString(),
        recoveredStaleOwner: current?.owner && !active ? current.owner : null,
      }, { merge: false });
      return true;
    });
  }

  async releaseLock(runId: string, owner: string): Promise<void> {
    assertRunId(runId);
    const db = await database();
    const reference = db.collection(LOCK_COLLECTION).doc(runId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists || snapshot.data()?.owner !== owner) return;
      transaction.delete(reference);
    });
  }

  async save(evidence: RiskLabCohortBacktestEvidence): Promise<RiskLabCohortBacktestEvidence> {
    assertRunId(evidence.runId);
    const db = await database();
    const safeEvidence = safeDocument(evidence);
    const batch = db.batch();

    batch.set(db.collection(RUN_COLLECTION).doc(evidence.runId), safeEvidence, { merge: false });
    batch.set(db.collection(RUN_COLLECTION).doc("latest"), safeEvidence, { merge: false });

    if (evidence.status !== "running" && evidence.attemptId) {
      assertAttemptId(evidence.attemptId);
      batch.create(db.collection(ATTEMPT_COLLECTION).doc(evidence.attemptId), safeEvidence);
    }

    batch.create(db.collection(AUDIT_COLLECTION).doc(), {
      action: "cohort-backtest",
      sprint: "3.5",
      runId: evidence.runId,
      attemptId: evidence.attemptId || null,
      supersedesRunId: evidence.supersedesRunId || null,
      previousEvidenceHash: evidence.previousEvidenceHash || null,
      methodologyVersion: evidence.methodologyVersion || "1.0.0",
      status: evidence.status,
      releaseCommit: evidence.releaseCommit,
      evidenceHash: evidence.evidenceHash,
      caseCount: evidence.cases.length,
      conclusiveCases: evidence.metrics.conclusiveCases,
      falsePositives: evidence.metrics.falsePositives,
      falseNegatives: evidence.metrics.falseNegatives,
      inconclusiveCases: evidence.metrics.inconclusiveCases,
      coveragePercent: evidence.metrics.coveragePercent,
      blockerCount: evidence.blockers.length,
      sourceExecutionAllowed: evidence.sourceExecutionAllowed,
      executionAllowed: evidence.executionAllowed,
      performanceReviewRequired: evidence.performanceReviewRequired || false,
      at: evidence.completedAt || evidence.startedAt,
      externalEffects: {
        premiumIntegrated: false,
        notificationsSent: false,
      },
    });
    await batch.commit();
    return safeEvidence;
  }
}

export const riskLabCohortBacktestStore = new RiskLabCohortBacktestStore();
