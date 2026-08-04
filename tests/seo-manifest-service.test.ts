import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Native strip-types requires explicit extension.
import { FundSeoManifestService } from "../src/lib/seo/FundSeoManifestService.ts";
import type { RegulatoryDataService } from "../src/lib/regulatoryDataService.ts";
import type { FundSeoManifestRepository } from "../src/lib/seo/FundSeoManifestRepository.ts";
import type { FundSeoManifest } from "../src/lib/seo/FundSeoManifest.ts";
import type { PublicFundData } from "../src/types/regulatory.ts";

const baseReview = {
  explanation: "O fundo gera renda por ativos e contratos específicos, com resultado dependente dos indexadores, da qualidade dos devedores, das garantias e da execução da estratégia. A análise acompanha riscos próprios e sustentabilidade dos rendimentos.",
  reviewedAt: "2026-08-04T12:00:00Z",
  sourceLabel: "Revisão editorial Dados FII",
  unique: true,
};

function qualifiedFund(ticker: string): PublicFundData {
  return {
    code: ticker,
    ticker,
    fundKind: "FII",
    cnpj: ticker === "KNCR11" ? "11.111.111/0001-91" : "22.222.222/0001-92",
    socialReason: `FUNDO DE INVESTIMENTO IMOBILIÁRIO ${ticker}`,
    sector: "Papel",
    segment: "Recebíveis",
    strategy: "Crédito imobiliário",
    status: "active",
    lifecycle: { status: "active", b3Listed: true, canceledAt: null },
    catalogDataQuality: { basicComplete: true, essentialComplete: true, warnings: [] },
    catalogUpdatedAt: "2026-08-03T12:00:00Z",
    fundDataSource: "Catálogo oficial normalizado Dados FII",
    price: 100,
    marketDataReferenceDate: "2026-08-04T12:00:00Z",
    vpCota: 105,
    pvp: 0.95,
    valuationReferenceDate: "2026-07-31",
    earnings2026: {
      July: {
        earnings: 1,
        date_with: "31/07/2026",
        source: "Comunicado de rendimentos",
      },
    },
    regulatoryMeta: {
      schemaVersion: 1,
      currentVersion: 1,
      cache: "miss",
      sources: [
        { provider: "B3", kind: "regulatory", fetchedAt: "2026-08-03" },
        { provider: "CVM", kind: "regulatory", fetchedAt: "2026-07-31" },
      ],
      validation: { valid: true, status: "valid", issues: [] },
    },
  } as PublicFundData;
}

function fakeRepository(initial: FundSeoManifest | null = null) {
  let current = initial;
  let reads = 0;
  let writes = 0;
  return {
    repository: {
      async getCurrent() {
        reads += 1;
        return current;
      },
      async saveCurrent(manifest: FundSeoManifest) {
        writes += 1;
        current = manifest;
        return { ...manifest, sizeBytes: JSON.stringify(manifest).length };
      },
    } as unknown as FundSeoManifestRepository,
    stats: () => ({ reads, writes, current }),
  };
}

test("empty editorial registry persists a fail-closed empty manifest without loading funds", async () => {
  let getManyCalls = 0;
  const dataService = {
    async getMany() {
      getManyCalls += 1;
      throw new Error("getMany should not be called for an empty registry");
    },
  } as unknown as RegulatoryDataService;
  const fake = fakeRepository();
  const service = new FundSeoManifestService(dataService, fake.repository, () => []);

  const manifest = await service.rebuild("test:seo");

  assert.equal(getManyCalls, 0);
  assert.equal(manifest.total, 0);
  assert.equal(manifest.indexableTotal, 0);
  assert.equal(fake.stats().writes, 1);
});

test("manifest rebuild loads all reviewed funds in one batch and persists only qualified pages", async () => {
  let getManyCalls = 0;
  let receivedTickers: string[] = [];
  const dataService = {
    async getMany(tickers: string[]) {
      getManyCalls += 1;
      receivedTickers = tickers;
      return {
        requested: tickers.length,
        found: 1,
        items: { KNCR11: qualifiedFund("KNCR11") },
        errors: { BTLG11: "FII não encontrado" },
        updatedAt: "2026-08-04T12:00:00Z",
      };
    },
  } as unknown as RegulatoryDataService;
  const fake = fakeRepository();
  const service = new FundSeoManifestService(dataService, fake.repository, () => [
    { ticker: "KNCR11", review: baseReview },
    { ticker: "BTLG11", review: { ...baseReview, explanation: `${baseReview.explanation} Logística.` } },
  ]);

  const manifest = await service.rebuild("test:seo");

  assert.equal(getManyCalls, 1);
  assert.deepEqual(receivedTickers, ["KNCR11", "BTLG11"]);
  assert.equal(manifest.total, 2);
  assert.equal(manifest.indexableTotal, 1);
  assert.equal(manifest.entries.find((entry) => entry.ticker === "KNCR11")?.decision, "index");
  assert.equal(manifest.entries.find((entry) => entry.ticker === "BTLG11")?.decision, "not-found");
  assert.equal(fake.stats().writes, 1);
});

test("identical editorial explanations are blocked across otherwise qualified funds", async () => {
  const dataService = {
    async getMany() {
      return {
        requested: 2,
        found: 2,
        items: {
          KNCR11: qualifiedFund("KNCR11"),
          BTLG11: qualifiedFund("BTLG11"),
        },
        errors: {},
        updatedAt: "2026-08-04T12:00:00Z",
      };
    },
  } as unknown as RegulatoryDataService;
  const fake = fakeRepository();
  const service = new FundSeoManifestService(dataService, fake.repository, () => [
    { ticker: "KNCR11", review: baseReview },
    { ticker: "BTLG11", review: baseReview },
  ]);

  const manifest = await service.rebuild("test:seo");

  assert.equal(manifest.indexableTotal, 0);
  for (const entry of manifest.entries) {
    assert.equal(entry.decision, "noindex");
    assert.ok(entry.blockers.includes("DUPLICATE_EDITORIAL_CONTENT"));
  }
});

test("current manifest is cached and force bypasses the cache", async () => {
  const manifest: FundSeoManifest = {
    schemaVersion: 1,
    generatedAt: "2026-08-04T12:00:00.000Z",
    total: 0,
    indexableTotal: 0,
    entries: [],
  };
  const fake = fakeRepository(manifest);
  const service = new FundSeoManifestService({} as RegulatoryDataService, fake.repository, () => []);

  assert.equal(await service.getCurrent(), manifest);
  assert.equal(await service.getCurrent(), manifest);
  assert.equal(fake.stats().reads, 1);
  assert.equal(await service.getCurrent({ force: true }), manifest);
  assert.equal(fake.stats().reads, 2);
});

test("rebuild rejects operations without an actor", async () => {
  const fake = fakeRepository();
  const service = new FundSeoManifestService({} as RegulatoryDataService, fake.repository, () => []);
  await assert.rejects(() => service.rebuild("  "), /Ator do manifesto SEO obrigatório/);
});
