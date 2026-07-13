import test from "node:test";
import assert from "node:assert/strict";
import { mergeRegulatoryHistory } from "./regulatoryHistoryMerge.ts";

test("merges multiple years without duplicating competencies", () => {
  const result = mergeRegulatoryHistory({
    existingMonthly: [
      { referenceDate: "2025-12-01", netWorth: 100 },
      { referenceDate: "2026-01-01", netWorth: 110 },
    ],
    incomingMonthly: [
      { referenceDate: "2026-01-01", netWorth: 111, vpCota: 10 },
      { referenceDate: "2026-02-01", netWorth: 120 },
    ],
  });

  assert.deepEqual(result.monthlyHistory.map((item) => item.referenceDate), [
    "2025-12-01",
    "2026-01-01",
    "2026-02-01",
  ]);
  assert.equal(result.monthlyHistory[1].netWorth, 111);
  assert.equal(result.monthlyHistory[1].vpCota, 10);
  assert.deepEqual(result.years, [2025, 2026]);
  assert.equal(result.latestSnapshot?.referenceDate, "2026-02-01");
});

test("deduplicates official documents by URL", () => {
  const result = mergeRegulatoryHistory({
    existingDocuments: [
      { documentUrl: "https://official/doc-1", deliveryDate: "2026-01-10", documentType: "RELAT GERENCIAL" },
    ],
    incomingDocuments: [
      { documentUrl: "https://official/doc-1", deliveryDate: "2026-01-10", documentType: "RELAT GERENCIAL", sourceUrl: "https://cvm/catalog" },
      { documentUrl: "https://official/doc-2", deliveryDate: "2026-02-10", documentType: "FATO RELEV" },
    ],
  });

  assert.equal(result.documents.length, 2);
  assert.equal(result.documents[0].sourceUrl, "https://cvm/catalog");
  assert.equal(result.stats.mergedDocuments, 2);
});

test("is idempotent when the same batch is merged twice", () => {
  const first = mergeRegulatoryHistory({
    incomingMonthly: [{ referenceDate: "2026-01-01", netWorth: 100 }],
    incomingDocuments: [{ documentUrl: "https://official/doc-1", deliveryDate: "2026-01-10" }],
  });
  const second = mergeRegulatoryHistory({
    existingMonthly: first.monthlyHistory,
    incomingMonthly: first.monthlyHistory,
    existingDocuments: first.documents,
    incomingDocuments: first.documents,
  });

  assert.equal(second.monthlyHistory.length, 1);
  assert.equal(second.documents.length, 1);
});
