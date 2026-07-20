import { adminDb } from "@/lib/firebaseAdmin";
import type { RiskLabProductionSmokeEvidence } from "@/types/riskLabProductionSmoke";

const RUN_COLLECTION = "RiskLabProductionSmokeRuns";
const AUDIT_COLLECTION = "RiskLabProductionSmokeAudit";
const LOCK_COLLECTION = "RiskLabProductionSmokeLocks";
const LOCK_TTL_MS = 10 * 60_000;

function safeDocument<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertRunId(value: string) {
  if (!/^risk-lab-3-4-[a-z0-9-]{8,80}$/.test(value)) {
    throw new Error("Identificador do smoke do Risk Lab inválido.");
  }
}

export class RiskLabProductionSmokeStore {
  async get(runId: string): Promise<RiskLabProductionSmokeEvidence | null> {
    assertRunId(runId);
    const snapshot = await adminDb.collection(RUN_COLLECTION).doc(runId).get();
    return snapshot.exists ? snapshot.data() as RiskLabProductionSmokeEvidence : null;
  }

  async latest(): Promise<RiskLabProductionSmokeEvidence | null> {
    const snapshot = await adminDb.collection(RUN_COLLECTION).doc("latest").get();
    return snapshot.exists ? snapshot.data() as RiskLabProductionSmokeEvidence : null;
  }

  async acquireLock(runId: string, owner: string): Promise<boolean> {
    assertRunId(runId);
    const reference = adminDb.collection(LOCK_COLLECTION).doc(runId);
    return adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = snapshot.data() as { owner?: string; expiresAt?: string } | undefined;
      const active = current?.expiresAt && Date.parse(current.expiresAt) > Date.now();
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
    const reference = adminDb.collection(LOCK_COLLECTION).doc(runId);
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists || snapshot.data()?.owner !== owner) return;
      transaction.delete(reference);
    });
  }

  async save(evidence: RiskLabProductionSmokeEvidence): Promise<RiskLabProductionSmokeEvidence> {
    assertRunId(evidence.runId);
    const safeEvidence = safeDocument(evidence);
    const batch = adminDb.batch();
    batch.set(adminDb.collection(RUN_COLLECTION).doc(evidence.runId), safeEvidence, { merge: false });
    batch.set(adminDb.collection(RUN_COLLECTION).doc("latest"), safeEvidence, { merge: false });
    batch.create(adminDb.collection(AUDIT_COLLECTION).doc(), {
      action: "production-smoke",
      sprint: "3.4",
      runId: evidence.runId,
      status: evidence.status,
      releaseCommit: evidence.releaseCommit,
      evidenceHash: evidence.evidenceHash,
      checkCount: evidence.checks.length,
      caseCount: evidence.cases.length,
      blockerCount: evidence.blockers.length,
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

export const riskLabProductionSmokeStore = new RiskLabProductionSmokeStore();
