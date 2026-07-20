import type { RiskLabCohortBacktestEvidence } from "@/types/riskLabCohortBacktest";

const RUN_COLLECTION = "RiskLabCohortBacktestRuns";
const AUDIT_COLLECTION = "RiskLabCohortBacktestAudit";
const LOCK_COLLECTION = "RiskLabCohortBacktestLocks";
const LOCK_TTL_MS = 30 * 60_000;

function safeDocument<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertRunId(value: string) {
  if (!/^risk-lab-3-5-[a-z0-9-]{8,80}$/.test(value)) {
    throw new Error("Identificador do backtest da coorte inválido.");
  }
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
      const current = snapshot.data() as { owner?: string; expiresAt?: string } | undefined;
      const active = Boolean(current?.expiresAt && Date.parse(current.expiresAt) > Date.now());
      if (active && current?.owner !== owner) return false;
      transaction.set(reference, {
        runId,
        owner,
        acquiredAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
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
    batch.create(db.collection(AUDIT_COLLECTION).doc(), {
      action: "cohort-backtest",
      sprint: "3.5",
      runId: evidence.runId,
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
      executionAllowed: evidence.executionAllowed,
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
