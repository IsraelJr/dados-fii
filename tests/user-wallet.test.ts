import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { extractUserWallet } from "../src/lib/userWallet.ts";

test("extracts current and legacy wallet containers", () => {
  assert.deepEqual(extractUserWallet({ wallet: [{ ticker: "tgar11", quotas: 10 }] }), [{ ticker: "TGAR11", quotas: 10 }]);
  assert.deepEqual(extractUserWallet({ carteira: { fiis: { VGIA11: { totalCotas: "25" } } } }), [{ ticker: "VGIA11", quotas: 25 }]);
  assert.deepEqual(extractUserWallet({ holdings: [{ assetTicker: "MXRF11", units: "30" }] }), [{ ticker: "MXRF11", quotas: 30 }]);
});

test("extracts top-level iOS ticker maps without treating metadata as positions", () => {
  const result = extractUserWallet({
    email: "user@example.com",
    version: 2,
    TGAR11: 12,
    KNCA11: { quantidade: "8" },
  });
  assert.deepEqual(result, [{ ticker: "KNCA11", quotas: 8 }, { ticker: "TGAR11", quotas: 12 }]);
});
