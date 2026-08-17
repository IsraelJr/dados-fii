import assert from "node:assert/strict";
import test from "node:test";
import {
  flushPortfolioHistoryOperations,
  PORTFOLIO_HISTORY_PERSISTED_EVENT,
  reconcilePortfolioHistoryQueueAfterFlush,
  type PortfolioHistoryFlushEvent,
  type PortfolioHistoryFlushEntry,
  type PortfolioHistoryFlushMethod,
} from "../src/lib/portfolio/PortfolioHistoryFlush";

test("publica uma vez, sem payload, somente após POST, PATCH e DELETE remotos concluírem", async () => {
  const persisted = new Set(["2026-02", "2026-03"]);
  const operations: Array<Readonly<{ method: PortfolioHistoryFlushMethod; body: Readonly<Record<string, unknown>> }>> = [];
  const tracked: PortfolioHistoryFlushEvent[] = [];
  const publishedArguments: unknown[][] = [];

  const changed = await flushPortfolioHistoryOperations({
    upserts: [
      { competence: "2026-01", dividends: 47 },
      { competence: "2026-02", dividends: 450.03 },
    ],
    deletes: ["2026-03", "2026-04"],
    isPersisted: (competence) => persisted.has(competence),
    refreshPersisted: async () => undefined,
    request: async (method, body) => { operations.push({ method, body }); },
    markPersisted: (competence) => persisted.add(competence),
    markDeleted: (competence) => persisted.delete(competence),
    track: (event) => tracked.push(event),
    onPersisted: (...args: unknown[]) => { publishedArguments.push(args); },
  });

  assert.equal(changed, true);
  assert.deepEqual(operations, [
    { method: "POST", body: { year: 2026, month: 1, dividends: 47 } },
    { method: "PATCH", body: { competence: "2026-02", dividends: 450.03 } },
    { method: "DELETE", body: { competence: "2026-03" } },
  ]);
  assert.deepEqual(tracked, ["history_month_added", "history_month_updated", "history_month_deleted"]);
  assert.deepEqual(publishedArguments, [[]]);
  assert.equal(PORTFOLIO_HISTORY_PERSISTED_EVENT, "dados-fii-portfolio-history-persisted");
});

test("reconciliação remove só operações capturadas e preserva novas alterações concorrentes", () => {
  const entryA = { competence: "2026-01", dividends: 47 } as const;
  const entryB = { competence: "2026-02", dividends: 450.03 } as const;
  const captured = { upserts: { "2026-01": entryA }, deletes: ["2026-03"] } as const;
  assert.deepEqual(reconcilePortfolioHistoryQueueAfterFlush({
    upserts: { "2026-01": entryA, "2026-02": entryB },
    deletes: ["2026-03", "2026-04"],
  }, captured), {
    upserts: { "2026-02": entryB },
    deletes: ["2026-04"],
  });
});

test("reedição da mesma competência durante request em voo permanece na fila", () => {
  const capturedEntry: PortfolioHistoryFlushEntry = { competence: "2026-02", dividends: 450.03 };
  const editedEntry: PortfolioHistoryFlushEntry = { competence: "2026-02", dividends: 451 };
  assert.deepEqual(reconcilePortfolioHistoryQueueAfterFlush({
    upserts: { "2026-02": editedEntry },
    deletes: [],
  }, {
    upserts: { "2026-02": capturedEntry },
    deletes: [],
  }), {
    upserts: { "2026-02": editedEntry },
    deletes: [],
  });
});

test("falha remota preserva fail-closed e nunca publica refresh", async () => {
  const persisted = new Set<string>();
  let requests = 0;
  let refreshes = 0;

  await assert.rejects(() => flushPortfolioHistoryOperations({
    upserts: [
      { competence: "2026-01", dividends: 47 },
      { competence: "2026-02", dividends: 450.03 },
    ],
    deletes: [],
    isPersisted: (competence) => persisted.has(competence),
    refreshPersisted: async () => undefined,
    request: async () => {
      requests += 1;
      if (requests === 2) throw new Error("remote write failed");
    },
    markPersisted: (competence) => persisted.add(competence),
    markDeleted: (competence) => persisted.delete(competence),
    track: () => undefined,
    onPersisted: () => { refreshes += 1; },
  }), /remote write failed/);

  assert.equal(requests, 2);
  assert.equal(refreshes, 0);
});

test("fila vazia não produz mutação nem refresh", async () => {
  let requests = 0;
  let refreshes = 0;
  const changed = await flushPortfolioHistoryOperations({
    upserts: [],
    deletes: [],
    isPersisted: () => false,
    refreshPersisted: async () => { throw new Error("fila vazia não consulta remoto"); },
    request: async () => { requests += 1; },
    markPersisted: () => undefined,
    markDeleted: () => undefined,
    track: () => undefined,
    onPersisted: () => { refreshes += 1; },
  });

  assert.equal(changed, false);
  assert.equal(requests, 0);
  assert.equal(refreshes, 0);
});

test("resposta perdida de POST é reconciliada antes de retry ou DELETE", async () => {
  const remote = new Map<string, number | null>();
  const persisted = new Set<string>();
  const methods: PortfolioHistoryFlushMethod[] = [];
  let loseFirstResponse = true;
  const refreshPersisted = async () => {
    persisted.clear();
    for (const competence of remote.keys()) persisted.add(competence);
  };
  const request = async (method: PortfolioHistoryFlushMethod, body: Readonly<Record<string, unknown>>) => {
    methods.push(method);
    const competence = method === "POST"
      ? `${body.year}-${String(body.month).padStart(2, "0")}`
      : String(body.competence);
    if (method === "DELETE") remote.delete(competence);
    else remote.set(competence, body.dividends as number | null);
    if (method === "POST" && loseFirstResponse) {
      loseFirstResponse = false;
      throw new Error("response lost after commit");
    }
  };
  const common = {
    isPersisted: (competence: string) => persisted.has(competence),
    refreshPersisted,
    request,
    markPersisted: (competence: string) => persisted.add(competence),
    markDeleted: (competence: string) => persisted.delete(competence),
    track: () => undefined,
    onPersisted: () => undefined,
  };

  await assert.rejects(flushPortfolioHistoryOperations({
    ...common,
    upserts: [{ competence: "2026-02", dividends: 450.03 }],
    deletes: [],
  }), /response lost/);
  assert.equal(remote.get("2026-02"), 450.03);

  await flushPortfolioHistoryOperations({
    ...common,
    upserts: [],
    deletes: ["2026-02"],
  });
  assert.equal(remote.has("2026-02"), false);

  loseFirstResponse = true;
  await assert.rejects(flushPortfolioHistoryOperations({
    ...common,
    upserts: [{ competence: "2026-03", dividends: 87.06 }],
    deletes: [],
  }), /response lost/);
  await flushPortfolioHistoryOperations({
    ...common,
    upserts: [{ competence: "2026-03", dividends: 87.06 }],
    deletes: [],
  });
  assert.deepEqual(methods, ["POST", "DELETE", "POST", "PATCH"]);
  assert.equal(remote.get("2026-03"), 87.06);
});

test("resposta perdida de DELETE é confirmada no retry e publica uma única vez", async () => {
  const remote = new Set(["2026-02"]);
  const persisted = new Set(["2026-02"]);
  const methods: PortfolioHistoryFlushMethod[] = [];
  const tracked: PortfolioHistoryFlushEvent[] = [];
  let publications = 0;
  let loseResponse = true;
  const input = {
    upserts: [],
    deletes: ["2026-02"],
    isPersisted: (competence: string) => persisted.has(competence),
    refreshPersisted: async () => {
      persisted.clear();
      for (const competence of remote) persisted.add(competence);
    },
    request: async (method: PortfolioHistoryFlushMethod, body: Readonly<Record<string, unknown>>) => {
      methods.push(method);
      remote.delete(String(body.competence));
      if (loseResponse) {
        loseResponse = false;
        throw new Error("response lost after delete commit");
      }
    },
    markPersisted: (competence: string) => persisted.add(competence),
    markDeleted: (competence: string) => persisted.delete(competence),
    track: (event: PortfolioHistoryFlushEvent) => tracked.push(event),
    onPersisted: () => { publications += 1; },
  } as const;

  await assert.rejects(flushPortfolioHistoryOperations(input), /response lost/);
  assert.equal(remote.has("2026-02"), false);
  assert.equal(publications, 0);
  assert.deepEqual(tracked, []);

  assert.equal(await flushPortfolioHistoryOperations(input), true);
  assert.deepEqual(methods, ["DELETE"]);
  assert.deepEqual(tracked, ["history_month_deleted"]);
  assert.equal(publications, 1);
});
