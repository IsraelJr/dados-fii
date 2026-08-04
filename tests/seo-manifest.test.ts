import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Native strip-types requires explicit extension.
import { buildFundSeoManifest } from "../src/lib/seo/FundSeoManifest.ts";
// @ts-expect-error Native strip-types requires explicit extension.
import type { FundSeoEligibilityInput } from "../src/lib/seo/SeoEligibilityEvaluator.ts";

const explanation = "O fundo possui uma estratégia própria cuja geração de renda depende dos ativos, contratos e indexadores descritos nesta página. A revisão acompanha dividendos, riscos específicos, qualidade dos dados e os indicadores capazes de alterar a tese.";

function validInput(ticker: string): FundSeoEligibilityInput {
  return {
    ticker,
    catalog: {
      identity: {
        cnpj: ticker === "KNCR11" ? "11111111000191" : ticker === "BTLG11" ? "22222222000192" : "33333333000193",
        legalName: `FUNDO ${ticker}`,
        kind: "FII",
      },
      classification: {
        sector: ticker === "BTLG11" ? "Logística" : "Papel",
        segment: ticker === "BTLG11" ? "Galpões logísticos" : "Recebíveis",
        strategy: "Estratégia específica",
      },
      lifecycle: {
        status: "active",
        b3Listed: true,
        canceledAt: null,
      },
      provenance: {
        sourceIds: ["b3-instruments", "cvm-registration"],
        referenceDate: "2026-08-01",
        generatedAt: "2026-08-02T12:00:00Z",
      },
      dataQuality: {
        basicComplete: true,
        essentialComplete: true,
        warnings: [],
      },
    },
    market: { price: 100, asOf: "2026-08-04T12:00:00Z", plausible: true },
    dividend: {
      value: 1,
      competence: "2026-07",
      source: "Comunicado de rendimentos",
      asOf: "2026-08-01T10:00:00Z",
      plausible: true,
    },
    valuation: { pvp: 0.95, navPerShare: 105, asOf: "2026-07-31", plausible: true },
    editorial: {
      explanation: `${explanation} ${ticker}.`,
      unique: true,
      reviewedAt: "2026-08-03T09:00:00Z",
      sourceLabel: "Revisão editorial Dados FII",
    },
    technical: {
      canonicalPath: `/fii/${ticker}`,
      httpStatus: 200,
      privateDataDetected: false,
    },
  };
}

test("manifest is deterministic, sorted and counts only approved funds", () => {
  const candidates = [
    { input: validInput("KNCR11"), contentFingerprint: "kncr-content" },
    { input: validInput("BTLG11"), contentFingerprint: "btlg-content" },
  ];

  const first = buildFundSeoManifest(candidates, "2026-08-04T15:00:00Z");
  const second = buildFundSeoManifest(candidates, "2026-08-04T15:00:00Z");

  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.total, 2);
  assert.equal(first.indexableTotal, 2);
  assert.deepEqual(first.entries.map((entry) => entry.ticker), ["BTLG11", "KNCR11"]);
  assert.deepEqual(first.entries.map((entry) => entry.canonicalPath), ["/fii/BTLG11", "/fii/KNCR11"]);
});

test("duplicate editorial fingerprints block every affected page", () => {
  const manifest = buildFundSeoManifest([
    { input: validInput("KNCR11"), contentFingerprint: "same-template" },
    { input: validInput("BTLG11"), contentFingerprint: " SAME-TEMPLATE " },
    { input: validInput("MXRF11"), contentFingerprint: "mxrf-specific" },
  ], "2026-08-04T15:00:00Z");

  const duplicated = manifest.entries.filter((entry) => ["BTLG11", "KNCR11"].includes(entry.ticker));
  assert.equal(manifest.indexableTotal, 1);
  for (const entry of duplicated) {
    assert.equal(entry.decision, "noindex");
    assert.equal(entry.indexable, false);
    assert.ok(entry.blockers.includes("DUPLICATE_EDITORIAL_CONTENT"));
  }
  assert.equal(manifest.entries.find((entry) => entry.ticker === "MXRF11")?.indexable, true);
});

test("not-found decision has precedence over duplicate content detection", () => {
  const invalid = validInput("MXRF11");
  invalid.ticker = "INVALID";
  invalid.technical!.canonicalPath = "/fii/INVALID";

  const manifest = buildFundSeoManifest([
    { input: invalid, contentFingerprint: "duplicate" },
    { input: validInput("KNCR11"), contentFingerprint: "duplicate" },
  ], "2026-08-04T15:00:00Z");

  const invalidEntry = manifest.entries.find((entry) => entry.ticker === "");
  assert.equal(invalidEntry?.decision, "not-found");
  assert.ok(invalidEntry?.blockers.includes("INVALID_TICKER"));
});

test("manifest rejects an invalid generation timestamp", () => {
  assert.throws(
    () => buildFundSeoManifest([], "not-a-date"),
    /INVALID_SEO_MANIFEST_GENERATED_AT/,
  );
});
