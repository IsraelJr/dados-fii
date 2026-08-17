import { adminDb } from "@/lib/firebaseAdmin";
import { FirestoreFundRadarRepositoryCore } from "./FirestoreFundRadarRepositoryCore";

export class FirestoreFundRadarRepository extends FirestoreFundRadarRepositoryCore {
  constructor() {
    super({ db: adminDb });
  }
}
