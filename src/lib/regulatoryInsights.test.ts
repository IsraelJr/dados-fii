import test from "node:test";
import assert from "node:assert/strict";
import { FII_GOLD_DATASET, GOLD_DATASET_TICKERS } from "./fiiGoldDataset.ts";
import { buildRegulatoryInsights } from "./regulatoryInsights.ts";

test("gold dataset keeps all four validated reference funds", () => {
  assert.deepEqual([...GOLD_DATASET_TICKERS].sort(), ["KNCA11", "MXRF11", "TGAR11", "VGIA11"].sort());
  for (const fixture of Object.values(FII_GOLD_DATASET)) {
    assert.equal(fixture.qaScore, 100);
    assert.equal(fixture.minimumCoverage, 100);
    assert.equal(fixture.conflictCount, 0);
  }
});

test("VGIA11 flags the material increase in outstanding shares", () => {
  const fixture = FII_GOLD_DATASET.VGIA11;
  const result = buildRegulatoryInsights({
    ticker: fixture.ticker,
    monthlyHistory: fixture.monthly,
    quality: { coverage: fixture.minimumCoverage, conflictCount: fixture.conflictCount, qaScore: fixture.qaScore },
  });

  assert.equal(result.facts.monthsAnalyzed, 5);
  assert.ok((result.facts.sharesChangePct || 0) > 20);
  assert.ok(result.insights.some((item) => item.code === "SHARE_ISSUANCE_CHANGE"));
  assert.equal(result.scores.dataQuality, 100);
});

test("MXRF11 identifies shareholder growth with broadly stable VP per share", () => {
  const fixture = FII_GOLD_DATASET.MXRF11;
  const result = buildRegulatoryInsights({
    ticker: fixture.ticker,
    monthlyHistory: fixture.monthly,
    quality: { coverage: 100, conflictCount: 0, qaScore: 100 },
  });

  assert.ok((result.facts.shareholdersChangePct || 0) > 5);
  assert.ok(Math.abs(result.facts.vpCotaChangePct || 0) < 2);
  assert.match(result.freeReport.headline, /cotistas em alta/i);
});

test("KNCA11 preserves zero delinquency as a positive fact", () => {
  const fixture = FII_GOLD_DATASET.KNCA11;
  const result = buildRegulatoryInsights({
    ticker: fixture.ticker,
    monthlyHistory: fixture.monthly,
    quality: { coverage: 100, conflictCount: 0, qaScore: 100 },
  });

  const delinquency = result.insights.find((item) => item.code === "DELINQUENCY_STATUS");
  assert.equal(result.facts.latestDelinquentCreditValue, 0);
  assert.equal(delinquency?.severity, "positive");
  assert.equal(result.scores.dataQuality, 100);
});

test("structural TGAR11 fixture does not invent missing financial history", () => {
  const fixture = FII_GOLD_DATASET.TGAR11;
  const result = buildRegulatoryInsights({
    ticker: fixture.ticker,
    monthlyHistory: fixture.monthly,
    quality: { coverage: 100, conflictCount: 0, qaScore: 100 },
  });

  assert.equal(result.facts.monthsAnalyzed, 0);
  assert.equal(result.facts.latestNetWorth, null);
  assert.ok(result.insights.some((item) => item.code === "INSUFFICIENT_HISTORY"));
});
