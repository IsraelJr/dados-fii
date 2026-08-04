import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";
import {
  calculatePremiumDiscountPercent,
  deriveFiiRiskData,
  plausiblePvpValue,
} from "../src/lib/fiiDerivedData";
import {
  assessFundDataQuality,
  validCnpj,
  validateRegulatoryFund,
} from "../src/lib/regulatory/RegulatoryValidator";
import { canonicalFrom } from "../src/lib/regulatory/RegulatoryNormalizer";
import type { RegulatoryFund } from "../src/types/regulatory";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function recentDividendHistory(monthlyValue: number, priceAtDateWith = 90) {
  const result: Record<string, Record<string, unknown>> = {};
  const now = new Date();
  for (let offset = 0; offset < 12; offset += 1) {
    const paymentDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const dateWith = new Date(Date.UTC(paymentDate.getUTCFullYear(), paymentDate.getUTCMonth(), 0));
    const yearKey = `earnings${paymentDate.getUTCFullYear()}`;
    result[yearKey] ||= {};
    result[yearKey][MONTHS[paymentDate.getUTCMonth()]] = {
      earnings: monthlyValue,
      payment_date: `${String(paymentDate.getUTCDate()).padStart(2, "0")}/${String(paymentDate.getUTCMonth() + 1).padStart(2, "0")}/${paymentDate.getUTCFullYear()}`,
      date_with: `${String(dateWith.getUTCDate()).padStart(2, "0")}/${String(dateWith.getUTCMonth() + 1).padStart(2, "0")}/${dateWith.getUTCFullYear()}`,
      price_date_with: priceAtDateWith,
    };
  }
  return result;
}

test("[REG-DEF-04] DY canônico usa dividendos de 12 meses e preço atual, nunca o campo legado", () => {
  const result = deriveFiiRiskData({
    price: 100,
    vpCota: 80,
    dividendYield: 99,
    ...recentDividendHistory(1),
  });

  assert.equal(result.canonicalDividendMetrics.dy12mCurrentPrice.value, 12);
  assert.equal(result.canonicalDividendMetrics.distributionOnNav12m.value, 15);
  assert.equal(result.canonicalDividendMetrics.lastDividendYieldAtBaseDate.value, 1.11);
  assert.equal(result.dividendYield, 12);
  assert.equal(result.dividendYield12m, 12);
  assert.equal(result.canonicalDividendMetrics.legacyConflict.detected, true);
});

test("[REG-DEF-05] ausência de cotação invalida todos os derivados dependentes de preço", () => {
  const result = deriveFiiRiskData({
    price: "-",
    dividendYield: 11.5,
    pvp: 0.9,
    ...recentDividendHistory(1),
  });

  assert.equal(result.dividendYield, null);
  assert.equal(result.pvp, undefined);
  assert.equal(result.canonicalDividendMetrics.dy12mCurrentPrice.value, null);
  assert.equal(result.canonicalDividendMetrics.dy12mCurrentPrice.reason, "missing_current_price");
});

test("[REG-DEF-03-A] BODB11 com dados financeiros ausentes nunca recebe status válido", () => {
  const fund = canonicalFrom("BODB11", {
    code: "BODB11",
    name: "BODB Fundo",
    type: "FII",
    cnpj: "11.222.333/0001-81",
  });
  const assessment = assessFundDataQuality(fund, fund.raw);
  assert.equal(assessment.status, "partial");
  assert.equal(assessment.valid, false);
  assert.ok(assessment.missingFields.includes("price"));
  assert.ok(assessment.missingFields.includes("netWorth"));
});

test("[REG-DEF-03-B] RJDA11 com escala, sinal e consistência inválidos é reprovado", () => {
  const fund = canonicalFrom("RJDA11", {
    code: "RJDA11",
    name: "RJDA Fundo",
    type: "FII",
    cnpj: "11.222.333/0001-81",
    price: 100,
    vpCota: 0.01,
    pvp: 0.001,
    netWorth: -1,
    numberShares: 0,
    numberCotistas: -4,
  });
  const assessment = assessFundDataQuality(fund, fund.raw);
  assert.equal(assessment.status, "invalid");
  assert.equal(assessment.valid, false);
  assert.ok(assessment.invalidFields.includes("netWorth"));
  assert.ok(assessment.invalidFields.includes("numberShares"));
  assert.ok(assessment.invalidFields.includes("pvp"));
});

test("métricas canônicas nunca produzem NaN ou Infinity", () => {
  fc.assert(fc.property(
    fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    (price, monthlyDividend) => {
      const result = deriveFiiRiskData({ price, ...recentDividendHistory(monthlyDividend) });
      const value = result.canonicalDividendMetrics.dy12mCurrentPrice.value;
      return value === null || Number.isFinite(value);
    },
  ), { numRuns: 250 });
});

test("P/VP e ágio/desconto rejeitam zero, escala implausível e entradas não numéricas", () => {
  assert.equal(plausiblePvpValue("0,85"), 0.85);
  assert.equal(plausiblePvpValue(0), undefined);
  assert.equal(plausiblePvpValue(0.01), undefined);
  assert.equal(plausiblePvpValue("sem dado"), undefined);
  assert.equal(calculatePremiumDiscountPercent("R$ 90,00", "R$ 100,00"), -10);
  assert.equal(calculatePremiumDiscountPercent(0, 100), undefined);
  assert.equal(calculatePremiumDiscountPercent(100, 0), undefined);
  assert.equal(calculatePremiumDiscountPercent(1000, 1), undefined);
});

test("classificação é estrutural por categoria e valuation registra descartes incompatíveis", () => {
  const categories = [
    ["Fiagro de crédito", "Fiagro", "Fiagro"],
    ["Fundo de infraestrutura", "Infraestrutura", "FI-Infra"],
    ["Recebíveis CRI", "Papel / Crédito", "FII de Papel"],
    ["Fundo de Fundos", "Fundo de Fundos", "FoF"],
    ["Shopping e logística", "Tijolo", "FII de Tijolo"],
    ["Desenvolvimento", "Desenvolvimento", "Desenvolvimento"],
    ["Segmento especial", "Segmento especial", "FII de Tijolo"],
  ] as const;

  for (const [segment, sector, fundType] of categories) {
    const result = deriveFiiRiskData({ segment });
    assert.equal(result.sector, sector);
    assert.equal(result.fundType, fundType);
  }

  const discarded = deriveFiiRiskData({
    price: 100,
    netWorth: 1_000,
    numberShares: 10_000,
    vpCota: 500_000,
  });
  assert.deepEqual(discarded.valuationDataQuality.notes, [
    "Patrimônio líquido bruto ignorado por unidade ausente ou incompatível com cotas emitidas.",
    "VP por cota bruto ignorado por faixa incompatível.",
  ]);

  const pvpDiscarded = deriveFiiRiskData({
    price: 100,
    netWorth: 1_000_000,
    numberShares: 10_000,
    pvp: 2,
  });
  assert.deepEqual(pvpDiscarded.valuationDataQuality.notes, [
    "P/VP informado ignorado por incompatibilidade com preço e VP por cota.",
  ]);

  const pvpOutOfRange = deriveFiiRiskData({ pvp: 20 });
  assert.deepEqual(pvpOutOfRange.valuationDataQuality.notes, [
    "P/VP bruto ignorado por faixa incompatível.",
  ]);

  const marketCapDiscarded = deriveFiiRiskData({ marketCap: 500 });
  assert.deepEqual(marketCapDiscarded.valuationDataQuality.notes, [
    "Valor de mercado bruto ignorado por unidade ausente ou incompatível com cotas emitidas.",
  ]);
});

function regulatoryFund(overrides: Partial<RegulatoryFund> = {}): RegulatoryFund {
  return {
    schemaVersion: 1,
    ticker: "TGAR11",
    kind: "FII",
    name: "TG Ativo Real",
    corporateName: "TG Ativo Real Fundo de Investimento Imobiliário",
    cnpj: "11.222.333/0001-81",
    segment: "Híbrido",
    status: "active",
    currentVersion: 1,
    sources: [{ provider: "CVM", kind: "regulatory", fetchedAt: "27/07/2026" }],
    raw: {},
    ...overrides,
  };
}

test("identidade regulatória valida CNPJ e registra todas as ausências relevantes", () => {
  assert.equal(validCnpj("11.222.333/0001-81"), true);
  assert.equal(validCnpj("11.111.111/1111-11"), false);
  assert.equal(validCnpj("123"), false);

  const issues = validateRegulatoryFund(regulatoryFund({
    ticker: "ABC",
    kind: "UNKNOWN",
    name: null,
    corporateName: null,
    cnpj: "11.111.111/1111-11",
    segment: null,
    sources: [],
  }));
  assert.deepEqual(
    issues.map((issue) => issue.code).sort(),
    ["invalid_cnpj", "invalid_ticker", "missing_name", "missing_segment", "missing_source", "unknown_fund_kind"].sort(),
  );

  const missingCnpj = validateRegulatoryFund(regulatoryFund({ cnpj: null }));
  assert.ok(missingCnpj.some((issue) => issue.code === "missing_cnpj"));
});

test("qualidade aceita escala pt-BR completa e distingue atual, obsoleto e indisponível", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");
  const data = {
    price: "R$ 100,00",
    netWorth: "1.000.000,00",
    vpCota: "100,00",
    numberShares: "10.000",
    numberCotistas: "1.000",
    dailyLiquidity: "R$ 1.234,50",
    pvp: "1,00",
    premiumDiscountPercent: "0",
    marketDataUpdatedAt: "27/07/2026",
    investorComposition: {
      totalAccounts: "1.000",
      individualAccounts: "990",
      legalEntityAccounts: "10",
      individualPercent: "99",
      legalEntityPercent: "1",
    },
  };
  const current = assessFundDataQuality(regulatoryFund(), data, now);
  assert.equal(current.status, "valid");
  assert.equal(current.valid, true);
  assert.equal(current.confidence, 87);
  assert.deepEqual(current.missingFields, []);
  assert.deepEqual(current.invalidFields, []);

  const stale = assessFundDataQuality(
    regulatoryFund({ sources: [{ provider: "CVM", kind: "regulatory", fetchedAt: "01/01/2025" }] }),
    { ...data, marketDataUpdatedAt: "01/01/2025" },
    now,
    30,
  );
  assert.equal(stale.status, "stale");
  assert.equal(stale.freshness.status, "stale");

  const unavailable = assessFundDataQuality(
    regulatoryFund({
      name: null,
      corporateName: null,
      cnpj: null,
      segment: null,
      sources: [],
    }),
    {},
    now,
  );
  assert.equal(unavailable.status, "unavailable");
});

test("qualidade reprova composição, percentuais, prêmio e datas futuras inconsistentes", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");
  const assessment = assessFundDataQuality(regulatoryFund(), {
    price: 100,
    netWorth: 1_000_000,
    vpCota: 100,
    numberShares: 10_000,
    numberCotistas: 1_000,
    dailyLiquidity: 1_000,
    pvp: 1,
    premiumDiscountPercent: 25,
    marketDataUpdatedAt: "30/07/2026",
    investorComposition: {
      totalAccounts: 1_000,
      individualAccounts: 700,
      legalEntityAccounts: 100,
      individualPercent: 120,
      legalEntityPercent: -1,
    },
  }, now);
  assert.equal(assessment.status, "invalid");
  assert.ok(assessment.invalidFields.includes("premiumDiscountPercent"));
  assert.ok(assessment.invalidFields.includes("investorComposition"));
  assert.ok(assessment.invalidFields.includes("investorComposition.individualPercent"));
  assert.ok(assessment.invalidFields.includes("investorComposition.legalEntityPercent"));
  assert.ok(assessment.invalidFields.includes("referenceDate"));
});

test("data impossível não é tratada como referência válida", () => {
  const result = assessFundDataQuality(
    regulatoryFund({ sources: [] }),
    {
      price: 100,
      netWorth: 1_000_000,
      vpCota: 100,
      numberShares: 10_000,
      numberCotistas: 1_000,
      dailyLiquidity: 1_000,
      marketDataUpdatedAt: "31/02/2026",
    },
    new Date("2026-07-27T12:00:00.000Z"),
  );
  assert.equal(result.freshness.status, "unknown");
  assert.equal(result.freshness.asOf, null);
});
