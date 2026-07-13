import test from "node:test";
import assert from "node:assert/strict";
import { hashStablePayload } from "./fiiPublicationSafety.ts";
import { validatePostPublication } from "./fiiPostPublicationValidation.ts";

test("passes when the official publication matches hashes and metadata", () => {
  const runId = "run-1";
  const proposalHash = "abc123";
  const regulatoryData = {
    ticker: "KNCA11",
    status: "published",
    latestSnapshot: { referenceDate: "2026-05-01" },
    monthlyHistory: [
      { referenceDate: "2026-04-01" },
      { referenceDate: "2026-05-01" },
    ],
    documents: [{ documentUrl: "https://example.com/a.pdf" }],
    quality: { qaScore: 100, conflictCount: 0 },
    publication: { runId, proposalHash },
  };
  const officialDocument = { code: "KNCA11", regulatoryData };
  const publication = {
    status: "published",
    publishedDocumentHash: hashStablePayload(officialDocument),
    publishedRegulatoryDataHash: hashStablePayload(regulatoryData),
  };

  const result = validatePostPublication({
    runId,
    ticker: "KNCA11",
    proposalHash,
    publication,
    officialDocumentExists: true,
    officialDocument,
  });

  assert.equal(result.passed, true);
  assert.equal(result.score, 100);
  assert.equal(result.counts.monthlySnapshots, 2);
  assert.equal(result.counts.documents, 1);
});

test("fails when the official document changed after publication", () => {
  const regulatoryData = {
    ticker: "KNCA11",
    latestSnapshot: { referenceDate: "2026-05-01" },
    monthlyHistory: [{ referenceDate: "2026-05-01" }],
    quality: { qaScore: 100, conflictCount: 0 },
    publication: { runId: "run-1", proposalHash: "abc123" },
  };
  const officialDocument = { code: "KNCA11", regulatoryData, price: 99 };
  const result = validatePostPublication({
    runId: "run-1",
    ticker: "KNCA11",
    proposalHash: "abc123",
    publication: {
      status: "published",
      publishedDocumentHash: hashStablePayload({ code: "KNCA11", regulatoryData }),
      publishedRegulatoryDataHash: hashStablePayload(regulatoryData),
    },
    officialDocumentExists: true,
    officialDocument,
  });

  assert.equal(result.passed, false);
  assert.ok(result.failures.some((item) => item.id === "document-hash"));
});
