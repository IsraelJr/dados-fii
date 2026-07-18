import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import type { RiskLabReport, RiskLabReportSummary } from "@/types/riskLabProduction";

const REPORTS_COLLECTION = "RiskLabReports";
const STATUS_COLLECTION = "RiskLabStatus";
const LOCKS_COLLECTION = "RiskLabLocks";
const AUDIT_COLLECTION = "RiskLabAudit";

function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, withoutUndefined(item)]),
  );
}

export function riskLabReportSummary(report: RiskLabReport): RiskLabReportSummary {
  return {
    id: report.id,
    ticker: report.ticker,
    generatedAt: report.generatedAt,
    generatedBy: report.generatedBy,
    prudentialAlert: report.assessment.prudentialAlert,
    deteriorationAlert: report.assessment.deteriorationAlert,
    confidence: report.assessment.confidence,
    datasetVersion: report.dataset.version,
    ruleSetVersion: report.ruleSet.version,
  };
}

export interface RiskLabRepositoryPort {
  acquireLock(ticker: string, owner: string, ttlMs?: number): Promise<void>;
  releaseLock(ticker: string, owner: string): Promise<void>;
  saveReport(report: RiskLabReport): Promise<RiskLabReport>;
  recordFailure(ticker: string, actor: string, message: string): Promise<void>;
  getLatest(ticker: string): Promise<RiskLabReport | null>;
  listRecent(limit?: number): Promise<RiskLabReportSummary[]>;
}

export class RiskLabRepository implements RiskLabRepositoryPort {
  async acquireLock(ticker: string, owner: string, ttlMs = 30_000) {
    const ref = adminDb.collection(LOCKS_COLLECTION).doc(ticker);
    const now = Date.now();
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.data() as { owner?: string; expiresAtMs?: number } | undefined;
      if (snapshot.exists && Number(current?.expiresAtMs || 0) > now) {
        throw new Error("Já existe uma execução do Risk Lab em andamento para este fundo.");
      }
      transaction.set(ref, {
        ticker,
        owner,
        acquiredAt: new Date(now).toISOString(),
        expiresAtMs: now + ttlMs,
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: false });
    });
  }

  async releaseLock(ticker: string, owner: string) {
    const ref = adminDb.collection(LOCKS_COLLECTION).doc(ticker);
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return;
      const currentOwner = String(snapshot.data()?.owner || "");
      if (currentOwner === owner) transaction.delete(ref);
    });
  }

  async saveReport(report: RiskLabReport) {
    const reportRef = adminDb.collection(REPORTS_COLLECTION).doc(report.id);
    const statusRef = adminDb.collection(STATUS_COLLECTION).doc(report.ticker);
    const auditRef = adminDb.collection(AUDIT_COLLECTION).doc();
    const summary = riskLabReportSummary(report);
    const payload = withoutUndefined(report) as RiskLabReport;
    const batch = adminDb.batch();
    batch.create(reportRef, {
      ...payload,
      persistedAt: adminFieldValue.serverTimestamp(),
      immutable: true,
    });
    batch.set(statusRef, {
      ticker: report.ticker,
      latestReportId: report.id,
      latestReport: payload,
      latestSummary: summary,
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: false });
    batch.create(auditRef, {
      action: "risk-lab-report-generated",
      actor: report.generatedBy,
      ticker: report.ticker,
      reportId: report.id,
      datasetId: report.dataset.id,
      datasetHash: report.dataset.contentHash,
      approvalHash: report.dataset.approvalHash,
      ruleSetHash: report.ruleSet.contentHash,
      prudentialAlert: report.assessment.prudentialAlert,
      deteriorationAlert: report.assessment.deteriorationAlert,
      premiumIntegrated: false,
      notificationsSent: false,
      occurredAt: report.generatedAt,
      createdAt: adminFieldValue.serverTimestamp(),
    });
    await batch.commit();
    return report;
  }

  async recordFailure(ticker: string, actor: string, message: string) {
    await adminDb.collection(AUDIT_COLLECTION).doc().set({
      action: "risk-lab-report-failed",
      actor,
      ticker,
      message: message.slice(0, 1_000),
      occurredAt: new Date().toISOString(),
      createdAt: adminFieldValue.serverTimestamp(),
    }, { merge: false });
  }

  async getLatest(ticker: string) {
    const snapshot = await adminDb.collection(STATUS_COLLECTION).doc(ticker).get();
    if (!snapshot.exists) return null;
    const report = snapshot.data()?.latestReport;
    return report && typeof report === "object" ? report as RiskLabReport : null;
  }

  async listRecent(limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 25);
    const snapshot = await adminDb.collection(REPORTS_COLLECTION)
      .orderBy("generatedAt", "desc")
      .limit(safeLimit)
      .get();
    return snapshot.docs.map((doc) => riskLabReportSummary(doc.data() as RiskLabReport));
  }
}
