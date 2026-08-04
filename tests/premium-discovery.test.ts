import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import {
  createPremiumDiscoveryEvent,
  createPremiumDiscoveryRequest,
  PremiumDiscoveryService,
  PremiumDiscoveryValidationError,
  premiumDiscoveryStatus,
} from "../src/lib/premium-discovery/index.ts";
import type {
  PremiumDiscoveryEvent,
  PremiumDiscoveryRepository,
  PremiumInterestRecord,
} from "../src/lib/premium-discovery/index.ts";

class MemoryRepository implements PremiumDiscoveryRepository {
  readonly interests = new Map<string, PremiumInterestRecord>();
  readonly events: Array<{ uid: string; event: PremiumDiscoveryEvent }> = [];

  async hasInterest(uid: string) {
    return this.interests.has(uid);
  }

  async saveInterest(record: PremiumInterestRecord) {
    this.interests.set(record.subject.uid, record);
  }

  async appendEvent(uid: string, event: PremiumDiscoveryEvent) {
    this.events.push({ uid, event });
  }
}

const subject = { uid: "user_beta_123", email: "beta@example.com" };
const now = () => new Date("2026-08-04T16:00:00.000Z");
let correlation = 0;
const correlationId = () => `correlation-${String(++correlation).padStart(8, "0")}`;

test("request contract accepts only allowlisted origins and motivations", () => {
  assert.deepEqual(createPremiumDiscoveryRequest({
    origin: "portfolio_intelligence",
    motivation: "portfolio_analysis",
    ownerId: "must-be-ignored",
    patrimony: 999999,
  }), {
    origin: "portfolio_intelligence",
    motivation: "portfolio_analysis",
  });
  assert.throws(
    () => createPremiumDiscoveryRequest({ origin: "client_override", motivation: "buy_signal" }),
    PremiumDiscoveryValidationError,
  );
});

test("event contract contains correlation and retention without financial fields", () => {
  const event = createPremiumDiscoveryEvent(
    "premium_discovery_viewed",
    "portfolio_intelligence",
    "correlation-00000001",
    now(),
  );
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.retentionDays, 90);
  assert.equal(event.occurredAt, "2026-08-04T16:00:00.000Z");
  const serialized = JSON.stringify(event);
  assert.doesNotMatch(serialized, /ownerId|email|ticker|quota|dividend|patrimony|position|token|cookie/i);
});

test("eligible user can request beta without receiving access automatically", async () => {
  const repository = new MemoryRepository();
  const service = new PremiumDiscoveryService(repository, now, correlationId);

  const initial = await service.status(subject, null, "portfolio_intelligence");
  assert.equal(initial.access, "eligible");
  assert.equal(initial.hasPremiumAccess, false);
  assert.equal(initial.canRequestAccess, true);

  const requested = await service.requestAccess(subject, null, {
    origin: "portfolio_intelligence",
    motivation: "portfolio_analysis",
  });
  assert.equal(requested.access, "requested");
  assert.equal(requested.hasPremiumAccess, false);
  assert.equal(requested.interestRequested, true);
  assert.equal(repository.interests.get(subject.uid)?.motivation, "portfolio_analysis");
  assert.deepEqual(repository.events.map(({ event }) => event.name), [
    "premium_discovery_viewed",
    "premium_interest_requested",
  ]);
});

test("interest remains requested until a server entitlement is present", async () => {
  const repository = new MemoryRepository();
  const service = new PremiumDiscoveryService(repository, now, correlationId);
  await service.requestAccess(subject, null, {
    origin: "premium_page",
    motivation: "risk_lab",
  });

  const stillRequested = await service.status(subject, null, "premium_page");
  assert.equal(stillRequested.access, "requested");
  assert.equal(stillRequested.hasPremiumAccess, false);

  const beta = await service.status(subject, { access: "beta" }, "premium_page");
  assert.equal(beta.access, "beta");
  assert.equal(beta.hasPremiumAccess, true);
  assert.equal(repository.events.at(-1)?.event.name, "premium_beta_accessed");
});

test("status labels owner, premium and beta distinctly", () => {
  assert.equal(premiumDiscoveryStatus("owner").access, "owner");
  assert.equal(premiumDiscoveryStatus("premium").access, "premium");
  assert.equal(premiumDiscoveryStatus("beta").access, "beta");
  assert.equal(premiumDiscoveryStatus("eligible").canRequestAccess, true);
});
