import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyFundRadarAccount,
  FundRadarError,
  reconcileFundRadarEntries,
  removeFundRadarFollow,
  setFundRadarNotifications,
  startFundRadarFollow,
  type FundRadarAccount,
  type FundRadarEntry,
  type FundRadarObservation,
} from "../src/lib/fund-radar/FundRadar";
import {
  createFundRadarObservation,
  detectFundRadarUpdates,
  latestFundRadarDividend,
} from "../src/lib/fund-radar/FundRadarObservation";
import type { ProductPlan } from "../src/lib/productPlans";
import type { PublicFundData } from "../src/types/regulatory";

const NOW = "2026-08-17T12:00:00.000Z";

function observation(seed: string): FundRadarObservation {
  const fingerprint = seed.repeat(64).slice(0, 64);
  return Object.freeze({
    fingerprint,
    dividendFingerprint: fingerprint,
    timelineFingerprints: Object.freeze([]),
    qualityFingerprint: fingerprint,
    signalFingerprint: fingerprint,
  });
}

function follow(
  account: FundRadarAccount,
  ticker: string,
  plan: ProductPlan,
  walletTickers: ReadonlySet<string> = new Set(),
  index = 0,
) {
  return startFundRadarFollow({
    account,
    ticker,
    plan,
    walletTickers,
    observation: observation(String((index % 9) + 1)),
    now: new Date(Date.parse(NOW) + index * 1_000).toISOString(),
  });
}

function accountWith(count: number, plan: ProductPlan): FundRadarAccount {
  let account = emptyFundRadarAccount();
  for (let index = 0; index < count; index += 1) {
    account = follow(account, `AAAA${index + 1}`, plan, new Set(), index).account;
  }
  return account;
}

function rejectsCode(action: () => unknown, code: string) {
  assert.throws(action, (error) => error instanceof FundRadarError && error.code === code);
}

test("Free permite 0→1 e bloqueia 1→2 no limite inclusivo", () => {
  const first = follow(emptyFundRadarAccount(), "MXRF11", "free");
  assert.equal(first.created, true);
  assert.equal(first.account.entries.filter((entry) => entry.status === "active").length, 1);
  rejectsCode(() => follow(first.account, "TGAR11", "free"), "FUND_RADAR_LIMIT_REACHED");
});

test("Premium permite 9→10 e bloqueia 10→11", () => {
  const nine = accountWith(9, "premium");
  const tenth = follow(nine, "ZZZZ10", "premium", new Set(), 10);
  assert.equal(tenth.account.entries.filter((entry) => entry.status === "active").length, 10);
  rejectsCode(() => follow(tenth.account, "ZZZZ11", "premium"), "FUND_RADAR_LIMIT_REACHED");
});

test("repetir o mesmo ticker é idempotente e ticker inválido falha", () => {
  const first = follow(emptyFundRadarAccount(), "MXRF11", "free");
  const replay = follow(first.account, "mxrf11", "free");
  assert.equal(replay.created, false);
  assert.equal(replay.account.entries.length, 1);
  rejectsCode(() => follow(first.account, "INVALIDO", "free"), "FUND_RADAR_INVALID_TICKER");
});

test("fundo presente na carteira não pode iniciar acompanhamento", () => {
  rejectsCode(
    () => follow(emptyFundRadarAccount(), "MXRF11", "free", new Set(["MXRF11"])),
    "FUND_RADAR_FUND_IN_PORTFOLIO",
  );
});

test("compra, downgrade e upgrade reconciliam estados sem apagar registros", () => {
  const premium = accountWith(3, "premium");
  const purchased = reconcileFundRadarEntries({
    entries: premium.entries,
    plan: "premium",
    walletTickers: new Set(["AAAA1"]),
    now: NOW,
  });
  assert.equal(purchased.find((entry) => entry.ticker === "AAAA1")?.status, "in_portfolio");
  assert.equal(purchased.filter((entry) => entry.status === "active").length, 2);

  const downgraded = reconcileFundRadarEntries({ entries: purchased, plan: "free", walletTickers: new Set(["AAAA1"]), now: NOW });
  assert.equal(downgraded.filter((entry) => entry.status === "active").length, 1);
  assert.equal(downgraded.filter((entry) => entry.status === "paused_by_plan").length, 1);
  assert.equal(downgraded.length, 3);

  const upgraded = reconcileFundRadarEntries({ entries: downgraded, plan: "premium", walletTickers: new Set(), now: NOW });
  assert.equal(upgraded.filter((entry) => entry.status === "active").length, 3);
  assert.equal(upgraded.filter((entry) => entry.status === "removed").length, 0);
});

test("remoção é idempotente, libera limite e preferência não exige excluir", () => {
  const first = follow(emptyFundRadarAccount(), "MXRF11", "free").account;
  const muted = setFundRadarNotifications({ account: first, ticker: "MXRF11", enabled: false, plan: "free", walletTickers: new Set(), now: NOW });
  assert.equal(muted.entries[0]?.notificationsEnabled, false);
  const removed = removeFundRadarFollow({ account: muted, ticker: "MXRF11", plan: "free", walletTickers: new Set(), now: NOW });
  assert.equal(removed.removed, true);
  assert.equal(removed.account.entries[0]?.status, "removed");
  const repeated = removeFundRadarFollow({ account: removed.account, ticker: "MXRF11", plan: "free", walletTickers: new Set(), now: NOW });
  assert.equal(repeated.removed, false);
  assert.equal(follow(repeated.account, "TGAR11", "free").created, true);
});

function fund(overrides: Record<string, unknown> = {}): PublicFundData {
  return {
    code: "MXRF11",
    ticker: "MXRF11",
    fundKind: "FII",
    regulatoryMeta: {
      schemaVersion: 1,
      currentVersion: 1,
      cache: "miss",
      sources: [{ provider: "Dados FII", kind: "regulatory", fetchedAt: NOW }],
      validation: {
        valid: true,
        status: "valid",
        issues: [],
        assessment: {
          status: "valid",
          valid: true,
          confidence: 100,
          reasons: [],
          missingFields: [],
          invalidFields: [],
          freshness: { status: "current", asOf: NOW, ageDays: 0, maxAgeDays: 30 },
        },
      },
    },
    ...overrides,
  } as PublicFundData;
}

test("rendimento conhecido igual a zero permanece zero e ausência permanece null", () => {
  assert.deepEqual(latestFundRadarDividend(fund({
    earnings2026: { August: { earnings: 0, payment_date: "14/08/2026" } },
  })), {
    competence: "2026-08",
    amount: 0,
    paymentDate: "14/08/2026",
    source: "Dados regulatórios e históricos do Dados FII",
  });
  assert.equal(latestFundRadarDividend(fund()), null);
});

test("observação inalterada não alerta; evento novo gera uma atualização deduplicável", () => {
  const beforeFund = fund({ earnings2026: { July: { earnings: 0.09, payment_date: "07/07/2026" } } });
  const afterFund = fund({ earnings2026: {
    July: { earnings: 0.09, payment_date: "07/07/2026" },
    August: { earnings: 0.1, payment_date: "14/08/2026" },
  } });
  const before = createFundRadarObservation(beforeFund, null);
  assert.equal(detectFundRadarUpdates({ ticker: "MXRF11", previous: before, current: before, fund: beforeFund, timeline: null, now: NOW }).length, 0);
  const after = createFundRadarObservation(afterFund, null);
  const first = detectFundRadarUpdates({ ticker: "MXRF11", previous: before, current: after, fund: afterFund, timeline: null, now: NOW });
  const replay = detectFundRadarUpdates({ ticker: "MXRF11", previous: before, current: after, fund: afterFund, timeline: null, now: NOW });
  assert.equal(first.filter((item) => item.kind === "dividend").length, 1);
  assert.deepEqual(first.map((item) => item.fingerprint), replay.map((item) => item.fingerprint));
  assert.doesNotMatch(JSON.stringify(first), /\b(?:compre|venda|recomendamos|preço-alvo)\b/i);
});

test("mesma notícia normalizada por identidade e cron concorrente preservam fingerprint", () => {
  const timeline = {
    ticker: "MXRF11",
    generatedAt: NOW,
    items: [{ id: "evt-1", ticker: "MXRF11", type: "material_fact" as const, title: "Fato relevante", occurredAt: NOW, source: "CVM", metadata: {} }],
    total: 1,
    counts: { document: 0, event: 0, material_fact: 1, assembly: 0, regulation: 0 },
    appliedTypes: ["material_fact" as const],
    nextCursor: null,
    sources: ["CVM"],
  };
  const current = createFundRadarObservation(fund(), timeline);
  const again = createFundRadarObservation(fund(), { ...timeline, generatedAt: "2026-08-17T13:00:00.000Z" });
  assert.equal(current.fingerprint, again.fingerprint);
  assert.deepEqual(current.timelineFingerprints, again.timelineFingerprints);
});
