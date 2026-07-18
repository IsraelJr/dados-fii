import { adminDb } from "@/lib/firebaseAdmin";
import type { VerifiedDividendNotice } from "@/types/riskLabDividendStress";

const VERIFIED_COLLECTION = "RiskLabVerifiedDividendNotices";
const SUPPORTED_TICKERS = new Set(["MCCI11", "RBRY11"]);

export class FirestoreVerifiedDividendNoticeStore {
  async listByTicker(ticker: string): Promise<VerifiedDividendNotice[]> {
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!SUPPORTED_TICKERS.has(normalizedTicker)) {
      throw new Error(`Ticker não suportado para cobertura: ${normalizedTicker}`);
    }

    const snapshot = await adminDb
      .collection(VERIFIED_COLLECTION)
      .where("ticker", "==", normalizedTicker)
      .get();

    return snapshot.docs
      .map((document) => document.data() as VerifiedDividendNotice)
      .sort((left, right) => left.competenceMonth.localeCompare(right.competenceMonth));
  }
}

export const verifiedDividendNoticeStore = new FirestoreVerifiedDividendNoticeStore();
