import test from "node:test";
import assert from "node:assert/strict";
import { RegulatoryCache } from "../services/regulatory/RegulatoryCache.ts";
import { RegulatoryDataService } from "../services/regulatory/RegulatoryDataService.ts";
import type { RegulatoryRepository } from "../services/regulatory/RegulatoryRepository.ts";
import type { RawFundDocument, RegulatoryFundView } from "../services/regulatory/RegulatoryTypes.ts";

class FakeRepository implements RegulatoryRepository {
  calls = 0;

  constructor(private readonly documents: Record<string, RawFundDocument | null>) {}

  async getFundDocument(ticker: string) {
    this.calls += 1;
    return this.documents[ticker] ?? null;
  }
}

function publishedFund(status = "published"): RawFundDocument {
  return {
    code: "MXRF11",
    name: "Maxi Renda",
    regulatoryData: {
      source: "CVM",
      status,
      ticker: "MXRF11",
      sourceRunId: "run-1",
      quality: { coverage: 100, qaScore: 100, conflictCount: 0, documents: 2 },
      monthlyHistory: [
        { referenceDate: "2026-05-01", netWorth: 100, vpCota: 10 },
        { referenceDate: "2026-05-01", netWorth: 100, vpCota: 10, numberShareholders: 200 },
        { referenceDate: "2026-04-01", netWorth: 90, vpCota: 9.5, numberShareholders: 190 },
      ],
      documents: [
        { documentType: "RELAT GERENCIAL", deliveryDate: "2026-06-01", documentUrl: "https://example.com/doc-1" },
        { documentType: "RELAT GERENCIAL", deliveryDate: "2026-06-01", documentUrl: "https://example.com/doc-1" },
      ],
      publication: { proposalHash: "hash-v1" },
    },
  };
}

test("returns only published data, normalizes duplicates and exposes a stable data version", async () => {
  const repository = new FakeRepository({ MXRF11: publishedFund() });
  const service = new RegulatoryDataService({
    repository,
    cache: new RegulatoryCache<RegulatoryFundView | null>(60_000),
  });

  const result = await service.getReportInput("mxrf11");

  assert.equal(result.reportAvailable, true);
  assert.equal(result.fund?.regulatoryData?.monthlyHistory.length, 2);
  assert.equal(result.fund?.regulatoryData?.documents.length, 1);
  assert.equal(result.fund?.regulatoryData?.latestSnapshot?.numberShareholders, 200);
  assert.equal(result.fund?.regulatoryData?.dataVersion, "hash-v1");
});

test("uses cache and supports explicit invalidation", async () => {
  const repository = new FakeRepository({ MXRF11: publishedFund() });
  const service = new RegulatoryDataService({
    repository,
    cache: new RegulatoryCache<RegulatoryFundView | null>(60_000),
  });

  const first = await service.getFund("MXRF11");
  const second = await service.getFund("MXRF11");
  assert.equal(first.cache.hit, false);
  assert.equal(second.cache.hit, true);
  assert.equal(repository.calls, 1);

  service.invalidate("MXRF11");
  const third = await service.getFund("MXRF11");
  assert.equal(third.cache.hit, false);
  assert.equal(repository.calls, 2);
});

test("does not expose regulatory data that is not published", async () => {
  const repository = new FakeRepository({ MXRF11: publishedFund("human_review_required") });
  const service = new RegulatoryDataService({ repository });

  const result = await service.getReportInput("MXRF11");
  assert.equal(result.reportAvailable, false);
  assert.equal(result.reason, "regulatory_data_not_published");
  assert.equal(result.insights, null);
});

test("rejects invalid ticker before accessing the repository", async () => {
  const repository = new FakeRepository({});
  const service = new RegulatoryDataService({ repository });

  await assert.rejects(() => service.getFund(""), /Ticker obrigatório ou inválido/);
  assert.equal(repository.calls, 0);
});
