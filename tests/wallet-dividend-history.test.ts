import assert from "node:assert/strict";
import test from "node:test";
import { buildWalletDividendHistory } from "../src/lib/walletDividendHistory";

test("wallet quick numbers include July in the best month and annual total", () => {
  const history = buildWalletDividendHistory([
    {
      ticker: "AAA11",
      quotas: 10,
      data: {
        earnings2026: {
          January: { earnings: "R$ 0,50" },
          July: { earnings: "R$ 0,80" },
        },
      },
    },
    {
      ticker: "BBB11",
      quotas: 5,
      data: {
        earnings2026: {
          January: { earnings: "R$ 0,20" },
          July: { earnings: "R$ 0,40" },
        },
      },
    },
  ], 2026, 6);

  assert.equal(history.best?.month, "July");
  assert.equal(history.best?.value, 10);
  assert.equal(history.total, 16);
  assert.equal(history.visibleMonths.length, 2);
});

test("wallet quick numbers ignore future months after the selected reference month", () => {
  const history = buildWalletDividendHistory([{
    ticker: "AAA11",
    quotas: 10,
    data: { earnings2026: { July: { earnings: 1 }, August: { earnings: 100 } } },
  }], 2026, 6);

  assert.equal(history.best?.month, "July");
  assert.equal(history.total, 10);
});
