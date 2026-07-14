import { adminDb } from "@/lib/firebaseAdmin";
import { RegulatoryRepositoryError } from "./RegulatoryErrors";
import type { RawFundDocument } from "./RegulatoryTypes";

export interface RegulatoryRepository {
  getFundDocument(ticker: string): Promise<RawFundDocument | null>;
}

export class FirestoreRegulatoryRepository implements RegulatoryRepository {
  async getFundDocument(ticker: string) {
    try {
      const snapshot = await adminDb.collection("Fiis").doc(ticker).get();
      return snapshot.exists ? (snapshot.data() || {}) as RawFundDocument : null;
    } catch (error: any) {
      throw new RegulatoryRepositoryError(error?.message || "Falha ao consultar Fiis no Firestore.");
    }
  }
}
