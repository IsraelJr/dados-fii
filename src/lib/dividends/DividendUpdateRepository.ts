import { createHash, randomUUID } from "node:crypto";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import {
  DIVIDEND_UPDATE_RULE_VERSION,
  type DividendUpdateCompletedResult,
  type DividendUpdateContext,
  type DividendUpdateResult,
} from "@/lib/dividends/DividendUpdateTypes";

export class DividendUpdateConflictError extends Error {
  constructor(message = "Já existe uma atualização deste fundo em andamento.") {
    super(message);
    this.name = "DividendUpdateConflictError";
  }
}

export class DividendUpdateRepository {
  private operationReference(idempotencyKey: string) {
    const operationId = createHash("sha256").update(idempotencyKey, "utf8").digest("hex");
    return adminDb.collection("DividendUpdateAudit").doc(operationId);
  }

  async getCompletedRun(
    ticker: string,
    context: DividendUpdateContext,
  ): Promise<DividendUpdateResult | null> {
    const snapshot = await this.operationReference(context.idempotencyKey).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data() || {};
    if (data.ticker !== ticker) {
      throw new DividendUpdateConflictError(
        "A chave de idempotência já foi usada em outra operação.",
      );
    }
    if (data.status !== "completed" && data.status !== "not_found") return null;
    const result = data.result as DividendUpdateResult | undefined;
    if (!result || result.ticker !== ticker || result.status !== data.status) return null;
    return { ...result, replayed: true };
  }

  async recordOutcome(
    ticker: string,
    context: DividendUpdateContext,
    outcome: {
      status: "not_found" | "failed";
      result?: DividendUpdateResult;
      failureCode?: string;
    },
  ) {
    const reference = this.operationReference(context.idempotencyKey);
    await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(reference);
      const data = current.data() || {};
      if (current.exists && data.ticker !== ticker) {
        throw new DividendUpdateConflictError(
          "A chave de idempotência já foi usada em outra operação.",
        );
      }
      if (data.status === "completed") return;
      transaction.set(reference, {
        ticker,
        actor: context.actor,
        origin: context.origin,
        correlationId: context.correlationId,
        keyHash: reference.id,
        ruleVersion: DIVIDEND_UPDATE_RULE_VERSION,
        status: outcome.status,
        quantityProcessed: 0,
        result: outcome.result || null,
        failureCode: outcome.failureCode || null,
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: false });
    });
  }

  async getFund(ticker: string) {
    const direct = await adminDb.collection("Fiis").doc(ticker).get();
    if (direct.exists) return { ref: direct.ref, data: direct.data() || {} };
    const query = await adminDb.collection("Fiis").where("code", "==", ticker).limit(1).get();
    if (query.empty) return null;
    return { ref: query.docs[0].ref, data: query.docs[0].data() || {} };
  }

  async acquireLock(ticker: string) {
    const owner = randomUUID();
    const reference = adminDb.collection("Parameters").doc("DividendUpdateLocks").collection("locks").doc(ticker);
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const data = snapshot.data() || {};
      const expiresAt = typeof data.expiresAt?.toDate === "function" ? data.expiresAt.toDate() : new Date(data.expiresAt || 0);
      if (snapshot.exists && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now()) {
        throw new DividendUpdateConflictError();
      }
      transaction.set(reference, {
        ticker,
        owner,
        acquiredAt: adminFieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      });
    });
    return {
      owner,
      release: async () => {
        await adminDb.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(reference);
          if (snapshot.data()?.owner === owner) transaction.delete(reference);
        });
      },
    };
  }

  async apply(
    ticker: string,
    reference: FirebaseFirestore.DocumentReference,
    previous: Record<string, unknown>,
    patch: Record<string, unknown>,
    sourceUrl: string,
    context: DividendUpdateContext,
    result: Omit<DividendUpdateCompletedResult, "changed" | "dataHash" | "replayed">,
  ) {
    const dataHash = createHash("sha256").update(JSON.stringify(patch), "utf8").digest("hex");
    const backupReference = adminDb.collection("Fiis_Backup").doc(`${ticker}_${dataHash.slice(0, 24)}`);
    const operationReference = this.operationReference(context.idempotencyKey);
    let changed = false;
    await adminDb.runTransaction(async (transaction) => {
      const operation = await transaction.get(operationReference);
      const operationData = operation.data() || {};
      if (operation.exists && operationData.ticker !== ticker) {
        throw new DividendUpdateConflictError(
          "A chave de idempotência já foi usada em outra operação.",
        );
      }
      if (operationData.status === "completed") return;
      const current = await transaction.get(reference);
      const currentData = current.data() || previous;
      if (currentData.dividendUpdateHash !== dataHash) {
        transaction.set(backupReference, {
          ...currentData,
          backup_date: adminFieldValue.serverTimestamp(),
          backup_reason: "automatic-dividend-update",
          sourceUrl,
          dataHash,
        }, { merge: false });
        transaction.set(reference, {
          ...patch,
          dividendUpdateHash: dataHash,
          dividendUpdateSource: sourceUrl,
          dividendUpdateRuleVersion: DIVIDEND_UPDATE_RULE_VERSION,
          modified_in: adminFieldValue.serverTimestamp(),
        }, { merge: true });
        changed = true;
      }
      transaction.set(operationReference, {
        ticker,
        actor: context.actor,
        origin: context.origin,
        correlationId: context.correlationId,
        keyHash: operationReference.id,
        ruleVersion: DIVIDEND_UPDATE_RULE_VERSION,
        sourceUrl,
        status: "completed",
        quantityProcessed: 1,
        result: {
          ...result,
          changed,
          dataHash,
          replayed: false,
        },
        updatedAt: adminFieldValue.serverTimestamp(),
      }, { merge: false });
    });
    return { changed, dataHash };
  }
}

export const dividendUpdateRepository = new DividendUpdateRepository();
