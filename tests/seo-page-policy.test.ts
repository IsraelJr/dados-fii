import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Native strip-types requires explicit extension.
import { buildFundSeoEligibilityInput, evaluatePublicFundSeo } from "../src/lib/seo/FundSeoPagePolicy.ts";
import type { PublicFundData } from "../src/types/regulatory.ts";

const editorial = {
  explanation: "O fundo gera renda principalmente por uma carteira de recebíveis imobiliários indexados, com resultado dependente dos spreads contratados, da adimplência dos devedores, das garantias e da evolução dos indexadores.",
  reviewedAt: "2026-08-03T09:00:00Z",
  sourceLabel: "Revisão editorial Dados FII",
  unique: true,
};

function qualifiedFund(overrides: Record<string, unknown> = {}): PublicFundData {
  return {
    code: "MXRF11",
    ticker: "MXRF11",
    fundKind: "FII",
    cnpj: "12.345.678/0001-90",
    socialReason: "FUNDO DE INVESTIMENTO IMOBILIÁRIO TESTE",
    sector: "Papel",
    segment: "Recebíveis",
    strategy: "Crédito imobiliário",
    status: "active",
    lifecycle: {
      status: "active",
      b3Listed: true,
      canceledAt: null,
    },
    catalogDataQuality: {
      basicComplete: true,
      essentialComplete: true,
      warnings: [],
    },
    catalogUpdatedAt: "2026-08-02T12:00:00Z",
    valuationReferenceDate: "2026-07-31",
    vpCota: 10.46,
    pvp: 0.98,
    price: 10.25,
    marketDataReferenceDate: "2026-08-04T12:00:00Z",
    fundDataSource: "Catálogo oficial normalizado Dados FII",
    earnings2026: {
      June: {
        earnings: 0.09,
        date_with: "30/06/2026",
        payment_date: "15/07/2026",
        source: "Comunicado de rendimentos de junho",
      },
      July: {
        earnings: "R$ 0,100",
        date_with: "31/07/2026",
        payment_date: "14/08/2026",
        source: "Comunicado de rendimentos de julho",
      },
    },
    regulatoryMeta: {
      schemaVersion: 1,
      currentVersion: 1,
      cache: "miss",
      sources: [
        { provider: "B3 — Títulos Negociáveis", kind: "regulatory", fetchedAt: "2026-08-01" },
        { provider: "CVM — Cadastro de Fundos e Classes", kind: "regulatory", fetchedAt: "2026-07-31" },
      ],
      validation: {
        valid: true,
        status: "valid",
        issues: [],
      },
    },
    ...overrides,
  } as PublicFundData;
}

test("qualified public fund becomes indexable only with approved editorial content", () => {
  const withoutEditorial = evaluatePublicFundSeo("MXRF11", qualifiedFund());
  assert.equal(withoutEditorial.decision, "noindex");
  assert.ok(withoutEditorial.blockers.includes("INSUFFICIENT_EDITORIAL_EXPLANATION"));

  const approved = evaluatePublicFundSeo("MXRF11", qualifiedFund(), editorial);
  assert.equal(approved.decision, "index");
  assert.equal(approved.score, 100);
  assert.deepEqual(approved.blockers, []);
});

test("page policy uses dividend reference date instead of a future payment date", () => {
  const input = buildFundSeoEligibilityInput("MXRF11", qualifiedFund(), editorial);

  assert.equal(input.dividend?.competence, "2026-07");
  assert.equal(input.dividend?.value, 0.1);
  assert.equal(input.dividend?.source, "Comunicado de rendimentos de julho");
  assert.equal(input.dividend?.asOf, "2026-07-31T00:00:00.000Z");
});

test("invalid Brazilian reference date does not roll over into another month", () => {
  const fund = qualifiedFund({
    earnings2026: {
      July: {
        earnings: 0.1,
        date_with: "31/02/2026",
        payment_date: "14/08/2026",
        source: "Comunicado inválido",
      },
    },
  });

  const input = buildFundSeoEligibilityInput("MXRF11", fund, editorial);
  const result = evaluatePublicFundSeo("MXRF11", fund, editorial);

  assert.equal(input.dividend?.asOf, null);
  assert.equal(result.decision, "noindex");
  assert.ok(result.blockers.includes("MISSING_DIVIDEND_DATE"));
});

test("legacy record without catalog is rendered as noindex rather than not found", () => {
  const legacy = qualifiedFund({
    catalogDataQuality: undefined,
    catalogUpdatedAt: undefined,
    fundDataSource: "Base interna Dados FII",
  });

  const result = evaluatePublicFundSeo("MXRF11", legacy, editorial);

  assert.equal(result.decision, "noindex");
  assert.ok(result.blockers.includes("MISSING_OFFICIAL_CATALOG"));
  assert.equal(result.blockers.includes("FUND_NOT_FOUND"), false);
});

test("missing or inactive public fund returns not found", () => {
  const missing = evaluatePublicFundSeo("MXRF11", null, editorial);
  assert.equal(missing.decision, "not-found");
  assert.ok(missing.blockers.includes("FUND_NOT_FOUND"));

  const inactive = evaluatePublicFundSeo("MXRF11", qualifiedFund({
    lifecycle: { status: "inactive", b3Listed: false, canceledAt: "2026-07-01" },
  }), editorial);
  assert.equal(inactive.decision, "not-found");
  assert.ok(inactive.blockers.includes("INACTIVE_FUND"));
});
