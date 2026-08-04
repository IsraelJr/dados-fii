import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { FirestorePortfolioHistoryRepositoryCore } from "./FirestorePortfolioHistoryRepositoryCore";

export class FirestorePortfolioHistoryRepository extends FirestorePortfolioHistoryRepositoryCore {
  constructor() {
    super({ db: adminDb, fieldValue: adminFieldValue });
  }
}
