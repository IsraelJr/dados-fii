import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Native strip-types requires explicit extension.
import { evaluateFundSeoEligibility, type FundSeoEligibilityInput } from "../src/lib/seo/SeoEligibilityEvaluator.ts";

const explanation = "Este fundo gera renda por uma combinação específica de ativos, contratos e indexadores. A análise acompanha a origem dos dividendos, os riscos próprios da estratégia e os indicadores que podem alterar a sustentabilidade dos pagamentos.";

function validInput(ticker = "MXRF11"): FundSeoEligibilityInput {
  return {
    ticker,
    catalog: {
      identity: {
        cnpj: "12345678000190",
        legalName: "FUNDO DE INVESTIMENTO IMOBILIÁRIO TESTE",
        kind: "FII",
      },
      classification: {
        sector: "Papel",
        segment: "Recebíveis",
        strategy: "Crédito imobiliário",
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
    market: {
      price: 10.25,
      asOf: "2026-08-04T12:00:00Z",
      plausible: true,
    },
    dividend: {
      value: 0.10,
      competence: "2026-07",
      source: "Comunicado de rendimentos",
      asOf: "2026-08-01T10:00:00Z",
      plausible: true,
    },
    valuation: {
      pvp: 0.98,
      navPerShare: 10.46,
      asOf: "2026-07-31",
      plausible: true,
    },
    editorial: {
      explanation,
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

test("fully qualified fund is indexable with the maximum score", () => {
  const result = evaluateFundSeoEligibility(validInput());

  assert.equal(result.decision, "index");
  assert.equal(result.score, 100);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.lastModified, "2026-08-04T12:00:00.000Z");
});

test("invalid, inactive and unlisted funds fail as not found", () => {
  const invalidTicker = evaluateFundSeoEligibility(validInput("INVALID"));
  assert.equal(invalidTicker.decision, "not-found");
  assert.ok(invalidTicker.blockers.includes("INVALID_TICKER"));

  const inactive = validInput();
  inactive.catalog!.lifecycle = { status: "inactive", b3Listed: true, canceledAt: "2026-07-01" };
  const inactiveResult = evaluateFundSeoEligibility(inactive);
  assert.equal(inactiveResult.decision, "not-found");
  assert.ok(inactiveResult.blockers.includes("INACTIVE_FUND"));

  const unlisted = validInput();
  unlisted.catalog!.lifecycle = { status: "active", b3Listed: false, canceledAt: null };
  const unlistedResult = evaluateFundSeoEligibility(unlisted);
  assert.equal(unlistedResult.decision, "not-found");
  assert.ok(unlistedResult.blockers.includes("NOT_LISTED_ON_B3"));
});

test("fund under identity review remains available but noindex", () => {
  const input = validInput();
  input.catalog!.lifecycle = { status: "under_review", b3Listed: true, canceledAt: null };

  const result = evaluateFundSeoEligibility(input);

  assert.equal(result.decision, "noindex");
  assert.ok(result.blockers.includes("IDENTITY_UNDER_REVIEW"));
});

test("valuation may be explicitly unavailable without blocking indexing", () => {
  const input = validInput();
  input.valuation = {
    pvp: null,
    navPerShare: null,
    asOf: "2026-07-31",
    explicitlyUnavailable: true,
    plausible: null,
  };

  const result = evaluateFundSeoEligibility(input);

  assert.equal(result.decision, "index");
  assert.equal(result.score, 100);
  assert.ok(result.warnings.includes("VALUATION_EXPLICITLY_UNAVAILABLE"));
});

test("absolute blockers cannot be compensated by a high score", () => {
  const privateInput = validInput();
  privateInput.technical!.privateDataDetected = true;
  const privateResult = evaluateFundSeoEligibility(privateInput);
  assert.equal(privateResult.decision, "noindex");
  assert.ok(privateResult.score >= 98);
  assert.ok(privateResult.blockers.includes("PRIVATE_DATA_DETECTED"));

  const implausibleInput = validInput();
  implausibleInput.market!.plausible = false;
  const implausibleResult = evaluateFundSeoEligibility(implausibleInput);
  assert.equal(implausibleResult.decision, "noindex");
  assert.ok(implausibleResult.blockers.includes("IMPLAUSIBLE_PRICE"));
});

test("catalog and editorial quality gates remain mandatory", () => {
  const input = validInput();
  input.catalog!.dataQuality!.basicComplete = false;
  input.editorial!.unique = false;
  input.editorial!.explanation = "Texto genérico.";

  const result = evaluateFundSeoEligibility(input);

  assert.equal(result.decision, "noindex");
  assert.ok(result.blockers.includes("INCOMPLETE_BASIC_CATALOG"));
  assert.ok(result.blockers.includes("NON_UNIQUE_EDITORIAL_CONTENT"));
  assert.ok(result.blockers.includes("INSUFFICIENT_EDITORIAL_EXPLANATION"));
  assert.ok(result.blockers.includes("SCORE_BELOW_MINIMUM"));
});
