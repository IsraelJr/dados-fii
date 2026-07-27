import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("src/lib/regulatoryDataService.ts", "utf8");
const repository = readFileSync("src/lib/regulatory/RegulatoryRepository.ts", "utf8");
const repositoryTypes = readFileSync("src/lib/regulatory/RegulatoryTypes.ts", "utf8");
const route = readFileSync("src/app/api/fii/[ticker]/report/premium/route.ts", "utf8");
const cron = readFileSync("src/app/api/cron/premium-peer-snapshot/route.ts", "utf8");

test("[REG-DEF-18] requisição Premium lê snapshot materializado e não varre o catálogo", () => {
  const method = service.slice(service.indexOf("async getPremiumReport"), service.indexOf("async getObservability"));
  assert.match(method, /getPremiumPeerSnapshot/);
  assert.doesNotMatch(method, /listFunds\(/);
  assert.match(method, /PREMIUM_PEER_SNAPSHOT_UNAVAILABLE/);
  assert.match(`${repository}\n${repositoryTypes}`, /RegulatoryPremiumPeerSnapshots/);
  assert.match(cron, /requireCron/);
});

test("resposta Premium somente é emitida com recibo persistido", () => {
  const method = service.slice(service.indexOf("async getPremiumReport"), service.indexOf("async getObservability"));
  assert.match(method, /await this\.repository\.recordAuditEvent/);
  assert.match(method, /auditReceipt/);
  assert.match(route, /X-Audit-Event-Id/);
  assert.match(route, /X-Correlation-Id/);
});
