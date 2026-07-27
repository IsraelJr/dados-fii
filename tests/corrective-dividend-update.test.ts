import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import type { DividendUpdateRepository } from "@/lib/dividends/DividendUpdateRepository";
import type {
  DividendUpdateContext,
  DividendUpdateResult,
} from "@/lib/dividends/DividendUpdateTypes";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
  project_id: "corrective-dividend-test",
  client_email: "test@corrective-dividend-test.iam.gserviceaccount.com",
  private_key: privateKey,
});
const { DividendUpdateService } = await import(
  "@/lib/dividends/DividendUpdateService"
);

const context: DividendUpdateContext = {
  actor: "admin:test-uid",
  origin: "admin",
  correlationId: "corrective-dividend-update",
  idempotencyKey: "corrective-dividend-key-0001",
};

function repository(
  overrides: Partial<DividendUpdateRepository>,
): DividendUpdateRepository {
  return {
    getCompletedRun: async () => null,
    acquireLock: async () => ({
      owner: "00000000-0000-4000-8000-000000000001",
      release: async () => undefined,
    }),
    getFund: async () => null,
    recordOutcome: async () => undefined,
    apply: async () => ({ changed: false, dataHash: "0".repeat(64) }),
    ...overrides,
  } as DividendUpdateRepository;
}

test("[REG-DEF-06] reprocessamento usa o resultado persistido sem rede nem nova escrita", async () => {
  const completed: DividendUpdateResult = {
    status: "completed",
    ticker: "TGAR11",
    year: 2026,
    fetchedMonths: ["July"],
    currentMonth: "July",
    currentMonthIncluded: true,
    indicatorsUpdated: true,
    changed: true,
    dataHash: "a".repeat(64),
    replayed: true,
  };
  let lockCalls = 0;
  let fetchCalls = 0;
  const service = new DividendUpdateService(
    repository({
      getCompletedRun: async () => completed,
      acquireLock: async () => {
        lockCalls += 1;
        throw new Error("o lock não deveria ser adquirido");
      },
    }),
    (async () => {
      fetchCalls += 1;
      throw new Error("a rede não deveria ser acessada");
    }) as typeof fetch,
  );

  assert.deepEqual(await service.update("TGAR11", context), completed);
  assert.equal(lockCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("fundo inexistente registra resultado auditável e libera o lock", async () => {
  const outcomes: unknown[] = [];
  let released = 0;
  const service = new DividendUpdateService(
    repository({
      acquireLock: async () => ({
        owner: "00000000-0000-4000-8000-000000000002",
        release: async () => {
          released += 1;
        },
      }),
      recordOutcome: async (ticker, operationContext, outcome) => {
        outcomes.push({ ticker, operationContext, outcome });
      },
    }),
  );

  const result = await service.update("ZZZZ11", context);
  assert.deepEqual(result, {
    status: "not_found",
    ticker: "ZZZZ11",
    replayed: false,
  });
  assert.equal(released, 1);
  assert.deepEqual(outcomes, [{
    ticker: "ZZZZ11",
    operationContext: context,
    outcome: {
      status: "not_found",
      result,
    },
  }]);
});
