import assert from "node:assert/strict";
import test from "node:test";
import { buildWalletMonthlyDividendTotals } from "../src/lib/walletDividendTotals";

test("monthly database dividends make July the largest month and enter the annual total", () => {
  const totals = buildWalletMonthlyDividendTotals([
    { quotas: 10, data: { earnings2026: { January: { earnings: "R$ 0,50" }, July: { earnings: "R$ 0,80" } } } },
    { quotas: 5, data: { earnings2026: { January: { earnings: "R$ 0,20" }, July: { earnings: "R$ 0,40" } } } },
  ], new Date(2026, 6, 18));

  const currentYear = totals.filter((item) => item.monthKey.startsWith("2026-"));
  const largest = [...currentYear].sort((left, right) => right.value - left.value)[0];
  const annualTotal = currentYear.reduce((sum, item) => sum + item.value, 0);

  assert.deepEqual(largest, { monthKey: "2026-07", value: 10 });
  assert.equal(annualTotal, 16);
});

test("future months are not included before their reference month", () => {
  const totals = buildWalletMonthlyDividendTotals([
    { quotas: 10, data: { earnings2026: { July: { earnings: 1 }, August: { earnings: 100 } } } },
  ], new Date(2026, 6, 18));

  assert.deepEqual(totals.filter((item) => item.monthKey.startsWith("2026-")), [{ monthKey: "2026-07", value: 10 }]);
});
