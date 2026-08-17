import assert from "node:assert/strict";
import test from "node:test";
import { emptyFundRadarAccount, type FundRadarEntry } from "../src/lib/fund-radar/FundRadar";
import type { FundRadarRepository } from "../src/lib/fund-radar/FundRadarRepository";
import { FundRadarService, fundRadarFundView } from "../src/lib/fund-radar/FundRadarService";
import type { PublicFundData } from "../src/types/regulatory";

const NOW = "2026-08-17T12:00:00.000Z";
const SUBJECT = Object.freeze({ ownerId: "owner-1", plan: "free" as const });

function entry(): FundRadarEntry {
  return Object.freeze({
    ticker: "MXRF11",
    status: "active",
    notificationsEnabled: true,
    createdAt: NOW,
    updatedAt: NOW,
    removedAt: null,
    lastProcessedFingerprint: null,
    lastObservation: null,
  });
}

function fund(overrides: Record<string, unknown> = {}): PublicFundData {
  return {
    code: "MXRF11",
    ticker: "MXRF11",
    fundKind: "FII",
    name: "Maxi Renda",
    segment: "Papéis",
    regulatoryMeta: {
      schemaVersion: 1,
      currentVersion: 1,
      cache: "miss",
      sources: [{ provider: "Dados FII", kind: "regulatory", fetchedAt: NOW }],
      validation: {
        valid: false,
        status: "partial",
        issues: [],
        assessment: {
          status: "partial",
          valid: false,
          confidence: 60,
          reasons: [],
          missingFields: ["vacancy"],
          invalidFields: [],
          freshness: { status: "current", asOf: NOW, ageDays: 0, maxAgeDays: 30 },
        },
      },
    },
    earnings2026: { August: { earnings: 0, payment_date: "14/08/2026" } },
    ...overrides,
  } as PublicFundData;
}

function repository() {
  let startCalls = 0;
  const implementation = {
    async reconcile() { return emptyFundRadarAccount(); },
    async start(input: Parameters<FundRadarRepository["start"]>[0]) {
      startCalls += 1;
      const next = Object.freeze({ ...entry(), lastProcessedFingerprint: input.observation.fingerprint, lastObservation: input.observation });
      return { account: Object.freeze({ ...emptyFundRadarAccount(), entries: Object.freeze([next]) }), created: true };
    },
    async remove() { return { account: emptyFundRadarAccount(), removed: false }; },
    async setNotifications() { return emptyFundRadarAccount(); },
    async recordObservation() { return { account: emptyFundRadarAccount(), createdUpdates: [] }; },
    async claimPendingEmailUpdates() { return []; },
    async completeEmailDelivery() {},
  } as FundRadarRepository;
  return { implementation, startCalls: () => startCalls };
}

test("view explicita dados insuficientes e preserva dividendo zero", () => {
  const view = fundRadarFundView(entry(), fund(), null);
  assert.equal(view.insufficientData, true);
  assert.equal(view.quality.status, "partial");
  assert.deepEqual(view.quality.missingFields, ["vacancy"]);
  assert.equal(view.lastDividend?.amount, 0);
  assert.equal(view.asOf, NOW);
  assert.equal(view.signals.riskScore, null);
});

test("ausência de fonte não vira zero nem indicador fabricado", () => {
  const view = fundRadarFundView(entry(), null, null);
  assert.equal(view.dataUnavailable, true);
  assert.equal(view.lastDividend, null);
  assert.equal(view.signals.riskScore, null);
  assert.equal(view.quality.confidence, null);
});

test("serviço rejeita fundo inexistente antes de persistir", async () => {
  const stored = repository();
  const service = new FundRadarService(stored.implementation, {
    async getByTicker() { return null; },
    async getTimeline() { return null; },
  }, () => new Date(NOW));
  await assert.rejects(service.follow(SUBJECT, "MXRF11"), /FUND_RADAR_FUND_NOT_FOUND/);
  assert.equal(stored.startCalls(), 0);
});

test("serviço rejeita fundo inativo e aceita fundo canônico ativo", async () => {
  const stored = repository();
  let current = fund({ status: "inactive" });
  const service = new FundRadarService(stored.implementation, {
    async getByTicker() { return current; },
    async getTimeline() { return null; },
  }, () => new Date(NOW));
  await assert.rejects(service.follow(SUBJECT, "MXRF11"), /FUND_RADAR_FUND_INACTIVE/);
  current = fund({ status: "active" });
  const followed = await service.follow(SUBJECT, "MXRF11");
  assert.equal(followed.created, true);
  assert.equal(followed.fund.ticker, "MXRF11");
  assert.equal(stored.startCalls(), 1);
});
