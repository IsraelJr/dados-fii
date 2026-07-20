import { adminDb } from "@/lib/firebaseAdmin";
import type {
  RiskLabAutomaticScan,
  RiskLabAutomaticScanRepository,
} from "@/types/riskLabAutomatic";

const SCAN_COLLECTION = "RiskLabAutomaticScans";
const AUDIT_COLLECTION = "RiskLabAutomaticScanAudit";

function safeDocument<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertScanId(value: string) {
  if (!/^[A-Z]{4}11_[a-f0-9]{20}$/.test(value)) {
    throw new Error("Identificador de pesquisa automática inválido.");
  }
}

export interface RiskLabAutomaticScanAudit {
  action: "automatic-scan";
  scanId: string;
  ticker: string;
  status: RiskLabAutomaticScan["status"];
  analysisReadiness: RiskLabAutomaticScan["analysisReadiness"];
  actor: string;
  at: string;
  sourceCount: number;
  documentCount: number;
  detectorExecuted: boolean;
  classificationFinal: boolean;
  premiumIntegrated: false;
  notificationsSent: false;
}

export class FirestoreRiskLabAutomaticScanStore implements RiskLabAutomaticScanRepository {
  async save(scan: RiskLabAutomaticScan): Promise<RiskLabAutomaticScan> {
    assertScanId(scan.id);
    const safeScan = safeDocument(scan);
    const reference = adminDb.collection(SCAN_COLLECTION).doc(scan.id);

    return adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists) return existing.data() as RiskLabAutomaticScan;

      transaction.create(reference, safeScan);
      transaction.create(adminDb.collection(AUDIT_COLLECTION).doc(), safeDocument<RiskLabAutomaticScanAudit>({
        action: "automatic-scan",
        scanId: safeScan.id,
        ticker: safeScan.ticker,
        status: safeScan.status,
        analysisReadiness: safeScan.analysisReadiness,
        actor: safeScan.requestedBy,
        at: safeScan.completedAt,
        sourceCount: safeScan.sources.length,
        documentCount: safeScan.documents.length,
        detectorExecuted: Boolean(safeScan.monthlySeries?.detectorExecuted),
        classificationFinal: Boolean(safeScan.monthlySeries?.classificationFinal),
        premiumIntegrated: false,
        notificationsSent: false,
      }));
      return safeScan;
    });
  }

  async latest(ticker: string): Promise<RiskLabAutomaticScan | null> {
    const normalized = String(ticker || "").trim().toUpperCase();
    if (!/^[A-Z]{4}11$/.test(normalized)) return null;
    const snapshot = await adminDb
      .collection(SCAN_COLLECTION)
      .where("ticker", "==", normalized)
      .limit(50)
      .get();

    return snapshot.docs
      .map((document) => document.data() as RiskLabAutomaticScan)
      .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))[0] || null;
  }

  async auditForScan(scanId: string): Promise<RiskLabAutomaticScanAudit[]> {
    assertScanId(scanId);
    const snapshot = await adminDb
      .collection(AUDIT_COLLECTION)
      .where("scanId", "==", scanId)
      .limit(10)
      .get();
    return snapshot.docs.map((document) => document.data() as RiskLabAutomaticScanAudit);
  }
}

export const riskLabAutomaticScanStore = new FirestoreRiskLabAutomaticScanStore();
