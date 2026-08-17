import assert from "node:assert/strict";
import test from "node:test";
import { FundRadarBatchProcessor } from "../src/lib/fund-radar/FundRadarBatchProcessor";
import type { FundRadarRepository } from "../src/lib/fund-radar/FundRadarRepository";
import type { FundRadarUpdate } from "../src/lib/fund-radar/FundRadar";

const NOW = "2026-08-17T12:00:00.000Z";

function update(seed: string): FundRadarUpdate {
  return Object.freeze({
    fingerprint: seed.repeat(64).slice(0, 64),
    ticker: "MXRF11",
    kind: "dividend",
    title: "Rendimento atualizado em MXRF11",
    whatChanged: "Nova competência identificada.",
    whyItMatters: "O evento merece conferência na fonte.",
    source: "Dados FII",
    asOf: NOW,
    missingData: Object.freeze([]),
    createdAt: NOW,
    delivery: Object.freeze({ status: "pending", attemptCount: 0, leaseUntil: null, sentAt: null }),
  });
}

function setup(options: { updates?: FundRadarUpdate[]; email?: string | null; send?: boolean } = {}) {
  let pending = [...(options.updates || [])];
  const sent: FundRadarUpdate[][] = [];
  const completions: Array<{ fingerprints: readonly string[]; sent: boolean }> = [];
  const repository = {
    async claimPendingEmailUpdates() {
      const claimed = pending;
      pending = [];
      return claimed;
    },
    async completeEmailDelivery(input: { fingerprints: readonly string[]; sent: boolean }) {
      completions.push(input);
    },
  } as unknown as FundRadarRepository;
  const processor = new FundRadarBatchProcessor(
    { async list() { return [{ ownerId: "owner-1", email: options.email === undefined ? "qa@example.invalid" : options.email, plan: "free" as const }]; } },
    repository,
    { async refresh() { return { processed: 1, createdUpdates: options.updates || [] }; } },
    { async send(_email, updates) { sent.push([...updates]); return options.send !== false; } },
    () => new Date(NOW),
  );
  return { processor, sent, completions };
}

test("cron sem mudança não cria notificação nem e-mail", async () => {
  const { processor, sent } = setup();
  const result = await processor.run();
  assert.equal(result.processedFunds, 1);
  assert.equal(result.updates, 0);
  assert.equal(result.emailsSent, 0);
  assert.equal(sent.length, 0);
});

test("evento novo gera um digest e conclui entrega", async () => {
  const item = update("a");
  const { processor, sent, completions } = setup({ updates: [item] });
  const result = await processor.run();
  assert.equal(result.updates, 1);
  assert.equal(result.emailsSent, 1);
  assert.deepEqual(sent[0]?.map((entry) => entry.fingerprint), [item.fingerprint]);
  assert.deepEqual(completions.map(({ fingerprints, sent }) => ({ fingerprints, sent })), [{ fingerprints: [item.fingerprint], sent: true }]);
});

test("duas execuções concorrentes reivindicam o evento uma única vez", async () => {
  const item = update("b");
  const { processor, sent } = setup({ updates: [item] });
  await Promise.all([processor.run(), processor.run()]);
  assert.equal(sent.length, 1);
});

test("e-mail ausente não vaza identidade e devolve atualização à fila", async () => {
  const item = update("c");
  const { processor, sent, completions } = setup({ updates: [item], email: null });
  const result = await processor.run();
  assert.equal(sent.length, 0);
  assert.equal(result.skippedEmail, 1);
  assert.deepEqual(completions.map(({ fingerprints, sent }) => ({ fingerprints, sent })), [{ fingerprints: [item.fingerprint], sent: false }]);
});

test("evento materialmente alterado possui fingerprint próprio e pode gerar nova entrega", async () => {
  const first = setup({ updates: [update("d")] });
  const second = setup({ updates: [update("e")] });
  await first.processor.run();
  await second.processor.run();
  assert.notEqual(first.sent[0]?.[0]?.fingerprint, second.sent[0]?.[0]?.fingerprint);
});
