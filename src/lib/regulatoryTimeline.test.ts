import test from "node:test";
import assert from "node:assert/strict";
import { FII_GOLD_DATASET } from "./fiiGoldDataset.ts";
import { buildRegulatoryTimeline } from "./regulatoryTimeline.ts";

test("timeline creates one monthly event per validated competence", () => {
  const fixture = FII_GOLD_DATASET.KNCA11;
  const timeline = buildRegulatoryTimeline({
    ticker: fixture.ticker,
    monthlyHistory: fixture.monthly,
    documents: [
      {
        documentType: "RELAT GERENCIAL",
        deliveryDate: "2026-07-10",
        documentUrl: "https://fnet.bmfbovespa.com.br/documento",
      },
    ],
  });

  assert.equal(timeline.counts.monthlySnapshots, 5);
  assert.equal(timeline.counts.officialDocuments, 1);
  assert.equal(timeline.events[0].date, "2026-07-10");
});

test("timeline detects VGIA11 material capital change", () => {
  const fixture = FII_GOLD_DATASET.VGIA11;
  const timeline = buildRegulatoryTimeline({
    ticker: fixture.ticker,
    monthlyHistory: fixture.monthly,
  });

  const capitalChange = timeline.events.find((event) => event.kind === "capital_change");
  assert.ok(capitalChange);
  assert.ok(Number(capitalChange?.metadata.sharesChangePct) > 20);
  assert.equal(capitalChange?.severity, "attention");
});

test("timeline classifies relevant official documents", () => {
  const timeline = buildRegulatoryTimeline({
    ticker: "MXRF11",
    documents: [
      { documentType: "FATO RELEV", deliveryDate: "2026-07-01" },
      { documentType: "RELAT GERENCIAL", deliveryDate: "2026-06-24" },
    ],
  });

  assert.equal(timeline.counts.officialDocuments, 2);
  assert.equal(timeline.events[0].title, "Fato relevante publicado");
  assert.equal(timeline.events[0].severity, "attention");
});
