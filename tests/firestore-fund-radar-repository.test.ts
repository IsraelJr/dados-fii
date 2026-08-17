import assert from "node:assert/strict";
import test from "node:test";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ProductPlan } from "../src/lib/productPlans";
import type { FundRadarObservation, FundRadarUpdate } from "../src/lib/fund-radar/FundRadar";
import { FirestoreFundRadarRepositoryCore } from "../src/server/repositories/FirestoreFundRadarRepositoryCore";

const EMULATOR_AVAILABLE = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const NOW = "2026-08-17T12:00:00.000Z";

function observation(seed: string): FundRadarObservation {
  const fingerprint = seed.repeat(64).slice(0, 64);
  return Object.freeze({ fingerprint, dividendFingerprint: fingerprint, timelineFingerprints: Object.freeze([]), qualityFingerprint: fingerprint, signalFingerprint: fingerprint });
}

function update(seed: string): FundRadarUpdate {
  return Object.freeze({
    fingerprint: seed.repeat(64).slice(0, 64),
    ticker: "MXRF11",
    kind: "dividend",
    title: "Rendimento atualizado",
    whatChanged: "Nova competência.",
    whyItMatters: "Merece conferência.",
    source: "Dados FII",
    asOf: NOW,
    missingData: Object.freeze([]),
    createdAt: NOW,
    delivery: Object.freeze({ status: "pending", attemptCount: 0, leaseUntil: null, sentAt: null }),
  });
}

test("Firestore preserva isolamento, limites, concorrência e deduplicação do Radar", {
  skip: !EMULATOR_AVAILABLE,
  timeout: 90_000,
}, async (context) => {
  const app = initializeApp({ projectId: "demo-dados-fii" }, `fund-radar-${process.pid}-${Date.now()}`);
  const db = getFirestore(app);
  const repository = new FirestoreFundRadarRepositoryCore({ db });
  const owners = new Set<string>();

  function subject(label: string, plan: ProductPlan = "free") {
    const ownerId = `radar-${process.pid}-${label}`;
    owners.add(ownerId);
    return Object.freeze({ ownerId, plan });
  }

  try {
    await context.test("duas inclusões Free concorrentes mantêm no máximo um ativo", async () => {
      const owner = subject("free-concurrent");
      await db.collection("User").doc(owner.ownerId).set({ wallet: [] });
      const settled = await Promise.allSettled([
        repository.start({ subject: owner, ticker: "MXRF11", observation: observation("a"), now: NOW }),
        repository.start({ subject: owner, ticker: "TGAR11", observation: observation("b"), now: NOW }),
      ]);
      assert.equal(settled.filter((item) => item.status === "fulfilled").length, 1);
      assert.equal(settled.filter((item) => item.status === "rejected").length, 1);
      const account = await repository.reconcile(owner, NOW);
      assert.equal(account.entries.filter((item) => item.status === "active").length, 1);
    });

    await context.test("owners permanecem isolados e replay é idempotente", async () => {
      const first = subject("isolation-a");
      const second = subject("isolation-b");
      await Promise.all([
        db.collection("User").doc(first.ownerId).set({ wallet: [] }),
        db.collection("User").doc(second.ownerId).set({ wallet: [] }),
      ]);
      const created = await repository.start({ subject: first, ticker: "MXRF11", observation: observation("c"), now: NOW });
      const replay = await repository.start({ subject: first, ticker: "MXRF11", observation: observation("d"), now: NOW });
      await repository.start({ subject: second, ticker: "TGAR11", observation: observation("e"), now: NOW });
      assert.equal(created.created, true);
      assert.equal(replay.created, false);
      assert.deepEqual((await repository.reconcile(first, NOW)).entries.filter((item) => item.status !== "removed").map((item) => item.ticker), ["MXRF11"]);
      assert.deepEqual((await repository.reconcile(second, NOW)).entries.filter((item) => item.status !== "removed").map((item) => item.ticker), ["TGAR11"]);
    });

    await context.test("Premium suporta dez e rejeita o décimo primeiro", async () => {
      const owner = subject("premium-limit", "premium");
      await db.collection("User").doc(owner.ownerId).set({ wallet: [] });
      for (let index = 1; index <= 10; index += 1) {
        await repository.start({ subject: owner, ticker: `AAAA${index}`, observation: observation(String(index % 9 + 1)), now: new Date(Date.parse(NOW) + index).toISOString() });
      }
      await assert.rejects(
        repository.start({ subject: owner, ticker: "BBBB11", observation: observation("f"), now: NOW }),
        /FUND_RADAR_LIMIT_REACHED/,
      );
      assert.equal((await repository.reconcile(owner, NOW)).entries.filter((item) => item.status === "active").length, 10);
    });

    await context.test("compra reconcilia estado sem apagar histórico", async () => {
      const owner = subject("portfolio-transition");
      const user = db.collection("User").doc(owner.ownerId);
      await user.set({ wallet: [] });
      await repository.start({ subject: owner, ticker: "MXRF11", observation: observation("1"), now: NOW });
      await user.set({ wallet: [{ ticker: "MXRF11", quotas: 2 }] }, { merge: true });
      const account = await repository.reconcile(owner, "2026-08-17T13:00:00.000Z");
      assert.equal(account.entries[0]?.status, "in_portfolio");
      assert.equal(account.entries[0]?.lastProcessedFingerprint, observation("1").fingerprint);
    });

    await context.test("cron concorrente persiste um update e uma notificação", async () => {
      const owner = subject("update-dedup");
      const user = db.collection("User").doc(owner.ownerId);
      await user.set({ wallet: [] });
      await repository.start({ subject: owner, ticker: "MXRF11", observation: observation("2"), now: NOW });
      const incoming = observation("3");
      const event = update("9");
      const settled = await Promise.all([
        repository.recordObservation({ subject: owner, ticker: "MXRF11", expectedPreviousFingerprint: observation("2").fingerprint, observation: incoming, updates: [event], now: "2026-08-17T13:00:00.000Z" }),
        repository.recordObservation({ subject: owner, ticker: "MXRF11", expectedPreviousFingerprint: observation("2").fingerprint, observation: incoming, updates: [event], now: "2026-08-17T13:00:00.000Z" }),
      ]);
      assert.equal(settled.reduce((sum, item) => sum + item.createdUpdates.length, 0), 1);
      assert.equal((await repository.reconcile(owner, NOW)).updates.length, 1);
      assert.equal((await user.collection("Notifications").get()).size, 1);
    });

    await context.test("preferência desativada avança baseline sem gerar alerta", async () => {
      const owner = subject("notifications-off");
      await db.collection("User").doc(owner.ownerId).set({ wallet: [] });
      await repository.start({ subject: owner, ticker: "MXRF11", observation: observation("4"), now: NOW });
      await repository.setNotifications({ subject: owner, ticker: "MXRF11", enabled: false, now: NOW });
      const result = await repository.recordObservation({ subject: owner, ticker: "MXRF11", expectedPreviousFingerprint: observation("4").fingerprint, observation: observation("5"), updates: [update("8")], now: NOW });
      assert.equal(result.createdUpdates.length, 0);
      assert.equal(result.account.entries[0]?.lastProcessedFingerprint, observation("5").fingerprint);
    });

    await context.test("remoção repetida é idempotente e não remove outros fundos", async () => {
      const owner = subject("remove", "premium");
      await db.collection("User").doc(owner.ownerId).set({ wallet: [] });
      await repository.start({ subject: owner, ticker: "MXRF11", observation: observation("6"), now: NOW });
      await repository.start({ subject: owner, ticker: "TGAR11", observation: observation("7"), now: NOW });
      assert.equal((await repository.remove({ subject: owner, ticker: "MXRF11", now: NOW })).removed, true);
      assert.equal((await repository.remove({ subject: owner, ticker: "MXRF11", now: NOW })).removed, false);
      const account = await repository.reconcile(owner, NOW);
      assert.equal(account.entries.find((item) => item.ticker === "MXRF11")?.status, "removed");
      assert.equal(account.entries.find((item) => item.ticker === "TGAR11")?.status, "active");
    });
  } finally {
    await Promise.all([...owners].map(async (ownerId) => {
      const user = db.collection("User").doc(ownerId);
      const [radar, notifications] = await Promise.all([user.collection("FundRadar").get(), user.collection("Notifications").get()]);
      const batch = db.batch();
      radar.docs.forEach((document) => batch.delete(document.ref));
      notifications.docs.forEach((document) => batch.delete(document.ref));
      batch.delete(user);
      await batch.commit();
    }));
    await deleteApp(app);
  }
});
