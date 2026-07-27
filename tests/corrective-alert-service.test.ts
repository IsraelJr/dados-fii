import assert from "node:assert/strict";
import test from "node:test";
import {
  AlertApplicationService,
  AlertConfigurationError,
  type AlertFundDirectory,
  type AlertRepository,
} from "../src/lib/alerts/AlertApplicationService";
import type { MonitoredFund, UserRecord } from "../src/lib/users/UserRepository";

function identity(plan: "free" | "premium" | "super_premium" = "free") {
  return {
    email: "investidor@example.com",
    plan,
    user: { id: "user-1", data: {}, ref: {} } as UserRecord,
  };
}

function setup(options?: { fundExists?: boolean; repositoryResult?: Awaited<ReturnType<AlertRepository["upsertMonitoredFund"]>> }) {
  const calls: Array<{ plan: string; fund: MonitoredFund; limit: number }> = [];
  const repository: AlertRepository = {
    async upsertMonitoredFund(_user, input) {
      calls.push({ plan: input.plan, fund: input.fund, limit: input.limit });
      return options?.repositoryResult || { ok: true, monitored: [input.fund], created: true };
    },
  };
  const directory: AlertFundDirectory = {
    async getByTicker() {
      return options?.fundExists === false ? null : { ticker: "TGAR11" };
    },
  };
  return { service: new AlertApplicationService(repository, directory), calls };
}

async function rejectsWith(
  action: Promise<unknown>,
  expected: { status: number; code: string },
) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof AlertConfigurationError);
    assert.equal(error.status, expected.status);
    assert.equal(error.code, expected.code);
    return true;
  });
}

test("[REG-DEF-07] plano, limites e percentuais são resolvidos no serviço, não no payload", async () => {
  const free = setup();
  const result = await free.service.configure(identity("free"), {
    fiiCode: "tgar11",
    percentUp: 19,
    percentDown: -19,
  });
  assert.equal(result.limit, 1);
  assert.deepEqual(free.calls[0], {
    plan: "free",
    fund: { fiiCode: "TGAR11", percentUp: 3, percentDown: -3 },
    limit: 1,
  });

  const paid = setup();
  await paid.service.configure(identity("premium"), {
    fiiCode: "TGAR11",
    percentUp: 7,
    percentDown: -8,
  });
  assert.deepEqual(paid.calls[0], {
    plan: "premium",
    fund: { fiiCode: "TGAR11", percentUp: 7, percentDown: -8 },
    limit: 10,
  });
});

test("ticker inexistente e limite do plano possuem erros de domínio explícitos", async () => {
  await rejectsWith(
    setup({ fundExists: false }).service.configure(identity(), { fiiCode: "ABCD11" }),
    { status: 404, code: "fund_not_found" },
  );
  await rejectsWith(
    setup({
      repositoryResult: {
        ok: false,
        code: "monitoring_limit_reached",
        monitored: [{ fiiCode: "MXRF11", percentUp: 3, percentDown: -3 }],
      },
    }).service.configure(identity(), { fiiCode: "TGAR11" }),
    { status: 422, code: "monitoring_limit_reached" },
  );
});

test("reprocessamento do mesmo alerta é idempotente", async () => {
  const current = { fiiCode: "TGAR11", percentUp: 3, percentDown: -3 };
  const { service } = setup({
    repositoryResult: { ok: true, monitored: [current], created: false },
  });
  const result = await service.configure(identity(), { fiiCode: "TGAR11" });
  assert.equal(result.created, false);
  assert.equal(result.monitoredCount, 1);
});
