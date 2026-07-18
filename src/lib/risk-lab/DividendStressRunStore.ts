import { adminDb } from "@/lib/firebaseAdmin";
import type {
  DividendStressRun,
  DividendStressRunRepository,
  DividendStressRunTicker,
} from "@/types/riskLabDividendStressRun";

const RUN_COLLECTION = "RiskLabDividendStressRuns";
const AUDIT_COLLECTION = "RiskLabDividendStressRunAudit";

function assertRunId(value: string) {
  if (!/^(MCCI11|RBRY11)_dividend-stress-v\d+\.\d+\.\d+_[a-f0-9]{24}$/.test(value)) {
    throw new Error("Identificador de execução de estresse inválido.");
  }
}

export class FirestoreDividendStressRunStore implements DividendStressRunRepository {
  async getById(id: string): Promise<DividendStressRun | null> {
    assertRunId(id);
    const snapshot = await adminDb.collection(RUN_COLLECTION).doc(id).get();
    return snapshot.exists ? snapshot.data() as DividendStressRun : null;
  }

  async save(run: DividendStressRun): Promise<DividendStressRun> {
    assertRunId(run.id);
    const reference = adminDb.collection(RUN_COLLECTION).doc(run.id);

    return adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists) return existing.data() as DividendStressRun;

      transaction.create(reference, run);
      transaction.create(adminDb.collection(AUDIT_COLLECTION).doc(), {
        action: "execute",
        runId: run.id,
        ticker: run.ticker,
        rulesetVersion: run.rulesetVersion,
        inputHash: run.inputHash,
        actor: run.executedBy,
        at: run.executedAt,
        observationIds: run.observationIds,
        externalEffects: run.externalEffects,
        classificationFinal: run.classificationFinal,
      });
      return run;
    });
  }

  async listLatestByTicker(ticker: DividendStressRunTicker, limit = 10): Promise<DividendStressRun[]> {
    const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
    const snapshot = await adminDb
      .collection(RUN_COLLECTION)
      .where("ticker", "==", ticker)
      .limit(50)
      .get();

    return snapshot.docs
      .map((document) => document.data() as DividendStressRun)
      .sort((left, right) => Date.parse(right.executedAt) - Date.parse(left.executedAt))
      .slice(0, safeLimit);
  }
}

export const dividendStressRunStore = new FirestoreDividendStressRunStore();
