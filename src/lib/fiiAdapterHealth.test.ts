import test from "node:test";
import assert from "node:assert/strict";
import { buildAdapterHealth } from "./fiiAdapterHealth.ts";

test("marks adapter healthy with successful recent runs", () => {
  const result = buildAdapterHealth([
    { adapterId: "cvm-fii-v2", fundType: "FII", ticker: "MXRF11", status: "completed", requestedAt: "2026-07-01T00:00:00Z", finishedAt: "2026-07-01T00:00:10Z", parserVersion: 2, manualQa: { score: 100, validation: { minimumCoverage: 100 } } },
    { adapterId: "cvm-fii-v2", fundType: "FII", ticker: "TGAR11", status: "completed", requestedAt: "2026-06-01T00:00:00Z", finishedAt: "2026-06-01T00:00:20Z", parserVersion: 2, manualQa: { score: 100, validation: { minimumCoverage: 100 } } },
  ]);

  assert.equal(result[0].status, "healthy");
  assert.equal(result[0].successRate, 100);
  assert.equal(result[0].averageDurationMs, 15000);
});

test("marks adapter degraded after consecutive failures", () => {
  const result = buildAdapterHealth([
    { adapterId: "cvm-fiagro-v2", status: "failed", requestedAt: "2026-07-02T00:00:00Z", error: "schema" },
    { adapterId: "cvm-fiagro-v2", status: "failed", requestedAt: "2026-07-01T00:00:00Z", error: "schema" },
    { adapterId: "cvm-fiagro-v2", status: "completed", requestedAt: "2026-06-01T00:00:00Z" },
  ]);

  assert.equal(result[0].status, "degraded");
  assert.equal(result[0].consecutiveFailures, 2);
});
