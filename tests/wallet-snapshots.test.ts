import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { legacyWalletSnapshots, mergeWalletSnapshots } from "../src/lib/walletHistory.ts";

test("legacy wallet history includes the union of patrimony and dividend months", () => {
  const snapshots = legacyWalletSnapshots({
    patrimony: { 2025: { April: "R$ 10.000,00", June: 12_000 } },
    earnings: { 2025: { April: "R$ 100,00", May: "R$ 110,00", Junho: "R$ 120,00" } },
  });
  assert.deepEqual(snapshots.map((item) => item.monthKey), ["2025-04", "2025-05", "2025-06"]);
  assert.equal(snapshots[1].totalValue, 0);
  assert.equal(snapshots[1].estimatedDividendIncome, 110);
});

test("persisted snapshots do not hide other legacy months", () => {
  const legacy = legacyWalletSnapshots({
    patrimony: { 2025: { April: 10_000, May: 11_000, June: 12_000 } },
    earnings: { 2025: { April: 100, May: 110, June: 120 } },
  });
  const merged = mergeWalletSnapshots(legacy, [{
    monthKey: "2025-06",
    totalValue: 12_500,
    estimatedDividendIncome: 0,
    source: "monthly_job",
  }]);
  assert.deepEqual(merged.map((item) => item.monthKey), ["2025-04", "2025-05", "2025-06"]);
  assert.equal(merged[2].totalValue, 12_500);
  assert.equal(merged[2].estimatedDividendIncome, 120);
  assert.equal(merged[2].source, "monthly_job");
});
