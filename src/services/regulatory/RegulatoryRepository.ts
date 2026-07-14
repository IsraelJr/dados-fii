import { adminDb } from "../../lib/firebaseAdmin.ts";
import { RegulatoryRepositoryError } from "./RegulatoryErrors.ts";
import type { RegulatoryRepository } from "./RegulatoryRepositoryContract.ts";
import type { RawFundDocument } from "./RegulatoryTypes.ts";

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
