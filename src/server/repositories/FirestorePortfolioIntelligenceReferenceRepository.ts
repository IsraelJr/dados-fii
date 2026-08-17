import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { FirestorePortfolioIntelligenceReferenceRepositoryCore } from "./FirestorePortfolioIntelligenceReferenceRepositoryCore";

export class FirestorePortfolioIntelligenceReferenceRepository
extends FirestorePortfolioIntelligenceReferenceRepositoryCore {
  constructor() {
    super({ db: adminDb, fieldValue: adminFieldValue });
  }
}
