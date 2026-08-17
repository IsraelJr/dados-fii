import { adminDb } from "@/lib/firebaseAdmin";
import { FirestorePortfolioHistoryRepository } from "./FirestorePortfolioHistoryRepository";
import { FirestorePortfolioIntelligenceSourceRepositoryCore } from "./FirestorePortfolioIntelligenceSourceRepositoryCore";

export class FirestorePortfolioIntelligenceSourceRepository
extends FirestorePortfolioIntelligenceSourceRepositoryCore {
  constructor() {
    super({
      db: adminDb,
      history: new FirestorePortfolioHistoryRepository(),
    });
  }
}
