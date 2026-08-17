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
const FIXED_AS_OF = "2026-08-10";
const FIXED_AS_OF_DATE = new Date("2026-08-10T12:00:00-03:00");

function recentDividendHistory(
  monthlyValue: number,
  asOf = FIXED_AS_OF_DATE,
  priceAtDateWith = 90,
) {
  const result: Record<string, Record<string, unknown>> = {};
  for (let offset = 0; offset < 12; offset += 1) {
    const paymentDate = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - offset, 1));
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
  }, { asOf: FIXED_AS_OF });

  assert.equal(result.canonicalDividendMetrics.dy12mCurrentPrice.value, 12);
  assert.equal(result.canonicalDividendMetrics.distributionOnNav12m.value, 15);
  assert.equal(result.canonicalDividendMetrics.lastDividendYieldAtBaseDate.value, 1.11);
  assert.equal(result.dividendYield, 12);
  assert.equal(result.dividendYield12m, 12);
  assert.equal(result.canonicalDividendMetrics.legacyConflict.detected, true);
});

test("[REG-DEF-04-A] data-base é obrigatória e torna a regra determinística", () => {
  assert.throws(
    () => (deriveFiiRiskData as unknown as (data: unknown) => unknown)({}),
    /asOf is required/,
  );

  const input = { price: 100, ...recentDividendHistory(1) };
  const first = deriveFiiRiskData(input, { asOf: FIXED_AS_OF });
  const second = deriveFiiRiskData(input, { asOf: FIXED_AS_OF });
  assert.deepEqual(first, second);
});

test("[REG-DEF-04-B] datas civis impossíveis são rejeitadas sem rollover", () => {
  const result = deriveFiiRiskData({
    earnings2026: {
      February: { earnings: 1, payment_date: "31/02/2026", date_with: "31/02/2026" },
      April: { earnings: 2, payment_date: "31/04/2026", date_with: "31/04/2026" },
      June: { earnings: 3, payment_date: "30/06/2026", date_with: "29/06/2026" },
    },
  }, { asOf: "2026-06-30" });

  assert.equal(result.dividends.monthsPaidLast12, 1);
  assert.equal(result.dividends.total12m, 3);
  assert.equal(result.dividends.lastDividendMonth, "June");
});

test("[REG-DEF-04-C] 29 de fevereiro só é aceito em ano bissexto", () => {
  const commonYear = deriveFiiRiskData({
    earnings2027: {
      February: { earnings: 1, payment_date: "29/02/2027", date_with: "28/02/2027" },
    },
  }, { asOf: "2027-03-01" });
  const leapYear = deriveFiiRiskData({
    earnings2028: {
      February: { earnings: 1, payment_date: "29/02/2028", date_with: "28/02/2028" },
    },
  }, { asOf: "2028-02-29" });

  assert.equal(commonYear.dividends.monthsPaidLast12, undefined);
  assert.equal(commonYear.dividends.lastDividend, 1);
  assert.equal(commonYear.dividends.lastDividendDate, undefined);
  assert.equal(commonYear.canonicalDividendMetrics.lastDividendYieldAtBaseDate.asOf, "2027-02-28");
  assert.equal(leapYear.dividends.monthsPaidLast12, 1);
});

test("[REG-DEF-04-C2] anos seculares só são bissextos quando divisíveis por 400", () => {
  const result = deriveFiiRiskData({
    earnings1900: {
      February: { earnings: 1, payment_date: "29/02/1900" },
    },
    earnings2000: {
      February: { earnings: 2, payment_date: "29/02/2000" },
    },
  }, { asOf: "2000-02-29" });

  assert.equal(result.dividends.monthsPaidLast12, 1);
  assert.equal(result.dividends.total12m, 2);
  assert.equal(result.dividends.lastDividendDate, "29/02/2000");
});

test("[REG-DEF-04-D] evento no mesmo dia respeita o calendário de São Paulo", () => {
  const input = {
    earnings2026: {
      August: { earnings: 1, payment_date: "10/08/2026", date_with: "07/08/2026" },
    },
  };

  const beforeDay = deriveFiiRiskData(input, { asOf: new Date("2026-08-10T02:59:59.999Z") });
  const atDay = deriveFiiRiskData(input, { asOf: new Date("2026-08-10T03:00:00.000Z") });
  assert.equal(beforeDay.dividends.monthsPaidLast12, undefined);
  assert.equal(atDay.dividends.monthsPaidLast12, 1);
});

test("[REG-DEF-04-E] pagamento futuro isolado não vira último dividendo por fallback", () => {
  const result = deriveFiiRiskData({
    earnings2026: {
      September: { earnings: 1.2, payment_date: "10/09/2026" },
    },
  }, { asOf: FIXED_AS_OF });

  assert.equal(result.dividends.lastDividend, undefined);
  assert.equal(result.dividends.monthsPaidLast12, undefined);
  assert.equal(result.dividends.total12m, undefined);
});

test("[REG-DEF-04-F] anúncio, referência ou data-com preservam evento conhecido sem antecipar caixa", () => {
  for (const knownDateField of ["announcement_date", "reference_date", "date_with"] as const) {
    const result = deriveFiiRiskData({
      earnings2026: {
        September: {
          earnings: 1.2,
          payment_date: "10/09/2026",
          [knownDateField]: "05/08/2026",
        },
      },
    }, { asOf: FIXED_AS_OF });

    assert.equal(result.dividends.lastDividend, 1.2);
    assert.equal(result.dividends.lastDividendDate, "10/09/2026");
    assert.equal(result.dividends.monthsPaidLast12, undefined);
    assert.equal(result.dividends.total12m, undefined);
  }
});

test("[REG-DEF-04-F1] anúncio e referência ISO com offset são fatos conhecidos determinísticos", () => {
  for (const [knownDateField, knownDate] of [
    ["announcedAt", "2026-08-05T12:00:00-03:00"],
    ["referenceDate", "2026-08-05T15:00:00Z"],
  ] as const) {
    const result = deriveFiiRiskData({
      earnings2026: {
        September: {
          earnings: 1.2,
          payment_date: "10/09/2026",
          [knownDateField]: knownDate,
        },
      },
    }, { asOf: FIXED_AS_OF });

    assert.equal(result.dividends.lastDividend, 1.2);
    assert.equal(result.canonicalDividendMetrics.lastDividendYieldAtBaseDate.asOf, "2026-08-05");
    assert.equal(result.dividends.total12m, undefined);
  }
});

test("[REG-DEF-04-F2] fallback de competência não seleciona mês futuro", () => {
  const result = deriveFiiRiskData({
    earnings2026: {
      July: { earnings: 1 },
      September: { earnings: 9 },
    },
  }, { asOf: FIXED_AS_OF });

  assert.equal(result.dividends.lastDividend, 1);
  assert.equal(result.dividends.lastDividendMonth, "July");
  assert.equal(result.dividends.monthsPaidLast12, undefined);
});

test("[REG-DEF-04-F3] data inválida não vaza e competência passada sustenta somente conhecimento", () => {
  const result = deriveFiiRiskData({
    earnings2026: {
      February: { earnings: 1, payment_date: "31/02/2026" },
    },
  }, { asOf: FIXED_AS_OF });

  assert.equal(result.dividends.lastDividend, 1);
  assert.equal(result.dividends.lastDividendDate, undefined);
  assert.equal(result.canonicalDividendMetrics.lastDividendYieldAtBaseDate.asOf, "2026-02-28");
  assert.equal(result.dividends.monthsPaidLast12, undefined);
});

test("[REG-DEF-04-G] dias 1 a 14 não alteram resultado antes do próximo pagamento", () => {
  const input = {
    earnings2026: {
      July: { earnings: 1, payment_date: "15/07/2026", date_with: "10/07/2026" },
      August: { earnings: 2, payment_date: "15/08/2026", date_with: "10/08/2026" },
    },
  };

  const firstDay = deriveFiiRiskData(input, { asOf: "2026-08-01" });
  const fourteenthDay = deriveFiiRiskData(input, { asOf: "2026-08-14" });
  const paymentDay = deriveFiiRiskData(input, { asOf: "2026-08-15" });
  assert.equal(firstDay.dividends.total12m, 1);
  assert.equal(fourteenthDay.dividends.total12m, 1);
  assert.equal(paymentDay.dividends.total12m, 3);
});

test("[REG-DEF-04-H] virada de ano não antecipa pagamento de janeiro", () => {
  const input = {
    earnings2027: {
      January: { earnings: 1, payment_date: "01/01/2027", date_with: "20/12/2026" },
    },
  };

  const december = deriveFiiRiskData(input, { asOf: "2026-12-31" });
  const january = deriveFiiRiskData(input, { asOf: "2027-01-01" });
  assert.equal(december.dividends.monthsPaidLast12, undefined);
  assert.equal(december.dividends.lastDividend, 1);
  assert.equal(january.dividends.monthsPaidLast12, 1);
});

test("[REG-DEF-04-I] asOf fixo independe do timezone do processo", () => {
  const originalTimeZone = process.env.TZ;
  const input = {
    earnings2026: {
      August: { earnings: 1, payment_date: "10/08/2026", date_with: "07/08/2026" },
    },
  };

  try {
    const results = ["UTC", "America/Sao_Paulo", "Pacific/Kiritimati"].map((timeZone) => {
      process.env.TZ = timeZone;
      return deriveFiiRiskData(input, { asOf: new Date("2026-08-10T03:00:00.000Z") });
    });
    assert.deepEqual(results[0], results[1]);
    assert.deepEqual(results[1], results[2]);
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});

test("[REG-DEF-04-I2] timestamp asOf sem offset é rejeitado em qualquer timezone", () => {
  const originalTimeZone = process.env.TZ;
  try {
    for (const timeZone of ["UTC", "America/Sao_Paulo", "Pacific/Kiritimati"]) {
      process.env.TZ = timeZone;
      assert.throws(
        () => deriveFiiRiskData({}, { asOf: "2026-08-10T00:00:00" }),
        /timezone offset/,
      );
    }
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});

test("[REG-DEF-04-I3] limite inferior da janela de 12 meses é explícito", () => {
  const result = deriveFiiRiskData({
    earnings2025: {
      July: { earnings: 9, payment_date: "09/08/2025" },
      August: { earnings: 1, payment_date: "10/08/2025" },
    },
  }, { asOf: FIXED_AS_OF });

  assert.equal(result.dividends.monthsPaidLast12, 1);
  assert.equal(result.dividends.total12m, 1);
});

test("[REG-DEF-05] ausência de cotação invalida todos os derivados dependentes de preço", () => {
  const result = deriveFiiRiskData({
    price: "-",
    dividendYield: 11.5,
    pvp: 0.9,
    ...recentDividendHistory(1),
  }, { asOf: FIXED_AS_OF });

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
      const result = deriveFiiRiskData(
        { price, ...recentDividendHistory(monthlyDividend) },
        { asOf: FIXED_AS_OF },
      );
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
    const result = deriveFiiRiskData({ segment }, { asOf: FIXED_AS_OF });
    assert.equal(result.sector, sector);
    assert.equal(result.fundType, fundType);
  }

  const discarded = deriveFiiRiskData({
    price: 100,
    netWorth: 1_000,
    numberShares: 10_000,
    vpCota: 500_000,
  }, { asOf: FIXED_AS_OF });
  assert.deepEqual(discarded.valuationDataQuality.notes, [
    "Patrimônio líquido bruto ignorado por unidade ausente ou incompatível com cotas emitidas.",
    "VP por cota bruto ignorado por faixa incompatível.",
  ]);

  const pvpDiscarded = deriveFiiRiskData({
    price: 100,
    netWorth: 1_000_000,
    numberShares: 10_000,
    pvp: 2,
  }, { asOf: FIXED_AS_OF });
  assert.deepEqual(pvpDiscarded.valuationDataQuality.notes, [
    "P/VP informado ignorado por incompatibilidade com preço e VP por cota.",
  ]);

  const pvpOutOfRange = deriveFiiRiskData({ pvp: 20 }, { asOf: FIXED_AS_OF });
  assert.deepEqual(pvpOutOfRange.valuationDataQuality.notes, [
    "P/VP bruto ignorado por faixa incompatível.",
  ]);

  const marketCapDiscarded = deriveFiiRiskData({ marketCap: 500 }, { asOf: FIXED_AS_OF });
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
