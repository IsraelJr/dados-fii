import assert from "node:assert/strict";
import test from "node:test";
import {
  WalletSessionFamilyRevokedError,
  WalletSessionStore,
  type WalletSessionDatabase,
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
} from "../src/server/auth/WalletSessionStore.ts";

type StoredDocument = Record<string, unknown>;

class MemoryReference {
  readonly path: string;
  private readonly documents: Map<string, StoredDocument>;

  constructor(
    path: string,
    documents: Map<string, StoredDocument>,
  ) {
    this.path = path;
    this.documents = documents;
  }

  async get() {
    const value = this.documents.get(this.path);
    return {
      exists: Boolean(value),
      data: () => value ? structuredClone(value) : undefined,
    };
  }
}

class MemoryWalletSessionDatabase implements WalletSessionDatabase {
  readonly documents = new Map<string, StoredDocument>();
  private queue: Promise<unknown> = Promise.resolve();

  collection(name: string) {
    return {
      doc: (id: string) => new MemoryReference(`${name}/${id}`, this.documents),
    };
  }

  runTransaction<T>(callback: (transaction: any) => Promise<T>): Promise<T> {
    const operation = this.queue.then(async () => {
      const writes: Array<() => void> = [];
      const result = await callback({
        get: (reference: MemoryReference) => reference.get(),
        set: (reference: MemoryReference, value: StoredDocument, options?: { merge?: boolean }) => {
          writes.push(() => {
            const current = options?.merge ? this.documents.get(reference.path) || {} : {};
            this.documents.set(reference.path, structuredClone({ ...current, ...value }));
          });
        },
        delete: (reference: MemoryReference) => {
          writes.push(() => this.documents.delete(reference.path));
        },
      });
      writes.forEach((write) => write());
      return result;
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }
}

const EMAIL = "qa-session@example.test";
const UID = "qa-session-uid";
const AUTH_TIME = 1_786_000_000;
const NOW = new Date("2026-08-03T12:00:00.000Z");
const EXPIRES = new Date("2026-08-04T00:00:00.000Z");

function harness() {
  const database = new MemoryWalletSessionDatabase();
  return {
    database,
    store: new WalletSessionStore(database, () => NOW),
  };
}

function issue(store: WalletSessionStore, token: string, firebaseAuthTime = AUTH_TIME, expiresAt = EXPIRES) {
  return store.issueFirebaseSession({
    email: EMAIL,
    uid: UID,
    firebaseAuthTime,
    token,
    expiresAt,
    now: NOW,
  });
}

test("renovação avança a geração e logout revoga todos os tokens da família", async () => {
  const { store } = harness();
  const first = await issue(store, "token-a");
  assert.equal(first.generation, 1);
  assert.equal(await store.verify(EMAIL, "token-a", NOW.getTime()), true);

  const second = await issue(store, "token-b");
  assert.equal(second.familyId, first.familyId);
  assert.equal(second.generation, 2);
  assert.equal(await store.verify(EMAIL, "token-a", NOW.getTime()), false);
  assert.equal(await store.verify(EMAIL, "token-b", NOW.getTime()), true);

  await store.revokeFamily(EMAIL, "token-b", NOW);
  assert.equal(await store.verify(EMAIL, "token-a", NOW.getTime()), false);
  assert.equal(await store.verify(EMAIL, "token-b", NOW.getTime()), false);

  await store.revokeFamily(EMAIL, "token-b", NOW);
  assert.equal(await store.verify(EMAIL, "token-b", NOW.getTime()), false);
});

test("novo login cria família válida e token da família antiga não a revoga", async () => {
  const { store } = harness();
  await issue(store, "old-token");
  await store.revokeFamily(EMAIL, "old-token", NOW);

  await assert.rejects(
    issue(store, "old-auth-renewal"),
    WalletSessionFamilyRevokedError,
  );

  const nextAuthTime = AUTH_TIME + 60;
  await issue(store, "new-token", nextAuthTime);
  assert.equal(await store.verify(EMAIL, "new-token", NOW.getTime()), true);

  await store.revokeFamily(EMAIL, "old-token", NOW);
  assert.equal(await store.verify(EMAIL, "old-token", NOW.getTime()), false);
  assert.equal(await store.verify(EMAIL, "new-token", NOW.getTime()), true);
});

test("renovações concorrentes preservam somente a geração monotônica mais recente", async () => {
  const { store } = harness();
  await issue(store, "token-a");

  const [second, third] = await Promise.all([
    issue(store, "token-b"),
    issue(store, "token-c"),
  ]);
  assert.equal(second.generation, 2);
  assert.equal(third.generation, 3);
  assert.equal(await store.verify(EMAIL, "token-a", NOW.getTime()), false);
  assert.equal(await store.verify(EMAIL, "token-b", NOW.getTime()), false);
  assert.equal(await store.verify(EMAIL, "token-c", NOW.getTime()), true);
});

test("logout concorrente com reidratação nunca ressuscita a família", async () => {
  const { store } = harness();
  await issue(store, "token-a");

  const results = await Promise.allSettled([
    issue(store, "token-b"),
    store.revokeFamily(EMAIL, "token-a", NOW),
  ]);
  assert.equal(results.every((result) => result.status === "fulfilled"), true);
  assert.equal(await store.verify(EMAIL, "token-a", NOW.getTime()), false);
  assert.equal(await store.verify(EMAIL, "token-b", NOW.getTime()), false);

  await assert.rejects(
    issue(store, "token-after-logout"),
    WalletSessionFamilyRevokedError,
  );

  const reverse = harness();
  await issue(reverse.store, "reverse-token-a");
  const reverseResults = await Promise.allSettled([
    reverse.store.revokeFamily(EMAIL, "reverse-token-a", NOW),
    issue(reverse.store, "reverse-token-b"),
  ]);
  assert.equal(reverseResults[0].status, "fulfilled");
  assert.equal(reverseResults[1].status, "rejected");
  assert.equal(await reverse.store.verify(EMAIL, "reverse-token-a", NOW.getTime()), false);
  assert.equal(await reverse.store.verify(EMAIL, "reverse-token-b", NOW.getTime()), false);
});

test("sessão expirada e identidade divergente são rejeitadas sem ampliar entitlement", async () => {
  const { database, store } = harness();
  await issue(store, "expired-token", AUTH_TIME, new Date(NOW.getTime() - 1));
  assert.equal(await store.verify(EMAIL, "expired-token", NOW.getTime()), false);

  await issue(store, "active-token", AUTH_TIME + 1);
  assert.equal(await store.verify("other@example.test", "active-token", NOW.getTime()), false);
  assert.equal(await store.verify(EMAIL, "active-token", NOW.getTime()), true);

  const serialized = JSON.stringify(Array.from(database.documents.values()));
  assert.doesNotMatch(serialized, /isVip|isPremium|plan|entitlement/i);
});
