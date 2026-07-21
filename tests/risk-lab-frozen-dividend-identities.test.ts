import assert from "node:assert/strict";
import test from "node:test";
import { RiskLabCohortIdentityService } from "../src/lib/risk-lab/RiskLabCohortIdentityService";

const NOW = new Date("2026-07-21T20:00:00-03:00");

test("resolve automaticamente as seis identidades oficiais sem entrada do proprietário", async () => {
  let index = 0;
  const service = new RiskLabCohortIdentityService({
    resolveFund: async () => ({ cnpj: String(++index).padStart(14, "0") }),
  });
  const identities = await service.list(NOW);
  assert.equal(identities.length, 6);
  assert.equal(new Set(identities.map((item) => item.ticker)).size, 6);
  assert.equal(identities.every((item) => /^\d{14}$/.test(item.cnpj)), true);
  assert.equal(identities.filter((item) => item.untilDate === "2026-07-21").length, 2);
});

test("falha fechada quando o catálogo não fornece CNPJ válido", async () => {
  const service = new RiskLabCohortIdentityService({ resolveFund: async () => ({ cnpj: "123" }) });
  await assert.rejects(() => service.list(NOW), /CNPJ inválido/);
});
