import assert from "node:assert/strict";
import test from "node:test";
import {
  COHORT_LOCK_STALE_AFTER_MS,
  isCohortBacktestLockActive,
} from "../src/lib/risk-lab/RiskLabCohortBacktestStore";

const NOW = Date.parse("2026-07-20T23:00:00.000Z");

test("lock recente permanece ativo durante uma execução válida", () => {
  const active = isCohortBacktestLockActive({
    owner: "worker-a",
    acquiredAt: new Date(NOW - 2 * 60_000).toISOString(),
    expiresAt: new Date(NOW + 6 * 60_000).toISOString(),
  }, NOW);
  assert.equal(active, true);
});

test("lock mais antigo que a janela da função é considerado órfão", () => {
  const active = isCohortBacktestLockActive({
    owner: "worker-timeout",
    acquiredAt: new Date(NOW - COHORT_LOCK_STALE_AFTER_MS - 1).toISOString(),
    expiresAt: new Date(NOW + 20 * 60_000).toISOString(),
  }, NOW);
  assert.equal(active, false);
});

test("lock expirado ou corrompido nunca bloqueia uma retomada", () => {
  assert.equal(isCohortBacktestLockActive({
    owner: "expired",
    acquiredAt: new Date(NOW - 60_000).toISOString(),
    expiresAt: new Date(NOW - 1).toISOString(),
  }, NOW), false);
  assert.equal(isCohortBacktestLockActive({
    owner: "invalid",
    acquiredAt: "invalid",
    expiresAt: "invalid",
  }, NOW), false);
  assert.equal(isCohortBacktestLockActive(undefined, NOW), false);
});
