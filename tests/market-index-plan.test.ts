import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Native strip-types requires explicit extension.
import { confirmedDailyLiquidity, hasTrustedLiquidityProvenance, mergeDividendYear, needsStatusInvestEnrichment, parseStatusInvestDividends, parseStatusInvestMarketIndicators } from "../src/lib/market/StatusInvestParser.ts";
// @ts-expect-error Native strip-types requires explicit extension.
import { ifixMembership, parseIfixComposition } from "../src/lib/indexes/IfixComposition.ts";
// @ts-expect-error Native strip-types requires explicit extension.
import { paidPlanFromRecord, productPlanLabel } from "../src/lib/productPlans.ts";

test("StatusInvest parser separates 30-day window from monetary liquidity", () => {
  const text = "VGIA11 Liquidez média diária Média dos últimos 30 dias R$ 1.599.186,55 Rendimento 11/06/2026 18/06/2026 0,13 Cotação base R$ 9,77 Tipo Rendimento Data Base 11/06/2026 Data Pagamento 18/06/2026";
  const market = parseStatusInvestMarketIndicators(text, "https://statusinvest.com.br/fiagros/vgia11", "2026-07-15");
  const dividends = parseStatusInvestDividends(text, 2026);
  assert.equal(market.dailyLiquidity, 1_599_186.55);
  assert.equal(market.dailyLiquidityWindowDays, 30);
  assert.equal(dividends.June.price_date_with, "R$ 9,77");
  assert.equal(dividends.June.earnings, "R$ 0,13");
});

test("dividend merge preserves a valid historical data-com price", () => {
  const merged = mergeDividendYear({ June: { payment_date: "18/06/2026", date_with: "11/06/2026", earnings: "R$ 0,12", price_date_with: "R$ 9,77" } }, {
    June: { payment_date: "18/06/2026", date_with: "11/06/2026", earnings: "R$ 0,13" },
  });
  assert.equal(merged.June.price_date_with, "R$ 9,77");
  assert.equal(merged.June.earnings, "R$ 0,13");
});

test("daily job reprocesses filled months when liquidity or data-com price is invalid", () => {
  assert.equal(needsStatusInvestEnrichment({ dailyLiquidity: 30, earnings2026: { July: { payment_date: "17/07/2026", date_with: "10/07/2026", earnings: "R$ 0,13" } } }, 2026, "July"), true);
  assert.equal(needsStatusInvestEnrichment({
    dailyLiquidity: 1_599_186.55,
    dailyLiquidityUnit: "BRL/day",
    marketDataSource: "StatusInvest",
    marketDataUpdatedAt: "2026-07-16T09:00:00.000Z",
    marketData: { dailyLiquidity: 1_599_186.55, dailyLiquidityUnit: "BRL/day", source: "StatusInvest", updatedAt: "2026-07-16T09:00:00.000Z" },
    earnings2026: { July: { payment_date: "17/07/2026", date_with: "10/07/2026", earnings: "R$ 0,13", price_date_with: "R$ 9,81" } },
  }, 2026, "July"), false);
});

test("low liquidity is accepted only when value, unit, source and date were internalized together", () => {
  const confirmed = {
    dailyLiquidity: 500,
    dailyLiquidityUnit: "BRL/day",
    marketDataSource: "StatusInvest",
    marketDataUpdatedAt: "2026-07-16T09:00:00.000Z",
    marketData: { dailyLiquidity: 500, dailyLiquidityUnit: "BRL/day", source: "StatusInvest", updatedAt: "2026-07-16T09:00:00.000Z" },
    earnings2026: { July: { payment_date: "17/07/2026", date_with: "10/07/2026", earnings: "R$ 0,13", price_date_with: "R$ 9,81" } },
  };
  assert.equal(hasTrustedLiquidityProvenance(confirmed), true);
  assert.equal(confirmedDailyLiquidity(confirmed), 500);
  assert.equal(needsStatusInvestEnrichment(confirmed, 2026, "July"), false);
  assert.equal(confirmedDailyLiquidity({ dailyLiquidity: 30 }), null);
});

test("IFIX composition produces explicit yes, no and not-applicable states", () => {
  const composition = parseIfixComposition({ header: { date: "15/07/26" }, page: { totalRecords: 2 }, results: [
    { cod: "MXRF11", asset: "MAXI RENDA", part: "3,550" },
    { cod: "HGLG11", asset: "CSHG LOG", part: "2,100" },
  ] }, "2026-07-15T12:00:00.000Z");
  assert.equal(ifixMembership("MXRF11", "FII", composition).status, "member");
  assert.equal(ifixMembership("VGIA11", "FII", composition).status, "not_member");
  assert.equal(ifixMembership("VGIA11", "FIAGRO", composition).status, "not_applicable");
});

test("commercial plan is independent from the admin role", () => {
  assert.equal(paidPlanFromRecord({ isPremium: true }), "premium");
  assert.equal(paidPlanFromRecord({ plan: "vip", subscriptionStatus: "active" }), "super_premium");
  assert.equal(paidPlanFromRecord({ isVIP: true }), "super_premium");
  assert.equal(paidPlanFromRecord({ plan: "pro" }), "super_premium");
  assert.equal(productPlanLabel("super_premium"), "Super Premium");
  assert.equal(productPlanLabel("free"), "Grátis");
});
