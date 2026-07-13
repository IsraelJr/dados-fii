import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRegulatoryDataProposal,
  diffRegulatoryData,
} from "./fiiPrePublication.ts";

test("builds an isolated regulatoryData proposal without legacy fields", () => {
  const proposal = buildRegulatoryDataProposal({
    ticker: "KNCA11",
    cnpj: "41745701000137",
    fundType: "FIAGRO",
    adapterId: "cvm-fiagro-v2",
    parserVersion: 2,
    runId: "run-1",
    year: 2026,
    generatedAt: "2026-07-13T00:15:01.075Z",
    monthly: [{
      referenceDate: "2026-05-01",
      cnpj: "41745701000137",
      fundName: "KINEA CRÉDITO AGRO FIAGRO-IMOBILIÁRIO",
      netWorth: 2176651191.41,
      sharesOutstanding: 21599919,
      numberShareholders: 91213,
      vpCota: 100.77,
      source: { files: ["inf_mensal_fiagro_202605.csv"] },
    }],
    documents: [{
      documentType: "RELAT GERENCIAL",
      deliveryDate: "2026-07-10",
      documentUrl: "https://fnet.bmfbovespa.com.br/doc.pdf",
      source: { url: "https://dados.cvm.gov.br/catalog.csv" },
    }],
  });

  assert.equal(proposal.ticker, "KNCA11");
  assert.equal(proposal.latestSnapshot?.vpCota, 100.77);
  assert.equal(proposal.monthlyHistory.length, 1);
  assert.equal(proposal.documents.length, 1);
  assert.equal(proposal.quality.qaScore, 100);
  assert.equal("price" in proposal, false);
  assert.equal("earnings2026" in proposal, false);
});

test("diff reports only changed regulatory paths", () => {
  const diff = diffRegulatoryData(
    { source: "CVM", latestSnapshot: { vpCota: 9.53 } },
    { source: "CVM", latestSnapshot: { vpCota: 9.69 }, status: "human_review_required" }
  );

  assert.deepEqual(diff.map((item) => [item.path, item.changeType]), [
    ["latestSnapshot.vpCota", "changed"],
    ["status", "added"],
  ]);
});

test("array histories are compared as atomic reviewed payloads", () => {
  const diff = diffRegulatoryData(
    { monthlyHistory: [{ referenceDate: "2026-04-01" }] },
    { monthlyHistory: [{ referenceDate: "2026-05-01" }] }
  );

  assert.equal(diff.length, 1);
  assert.equal(diff[0].path, "monthlyHistory");
  assert.equal(diff[0].changeType, "changed");
});

test("null existing regulatory data does not create a fake root removal", () => {
  const diff = diffRegulatoryData(null, {
    source: "CVM",
    ticker: "KNCA11",
  });

  assert.deepEqual(diff.map((item) => [item.path, item.changeType]), [
    ["source", "added"],
    ["ticker", "added"],
  ]);
  assert.equal(diff.some((item) => item.path === "$root"), false);
});
