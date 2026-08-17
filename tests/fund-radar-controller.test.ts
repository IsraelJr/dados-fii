import assert from "node:assert/strict";
import test from "node:test";
import type { FundRadarService } from "../src/lib/fund-radar/FundRadarService";
import type { FundRadarSubject } from "../src/lib/fund-radar/FundRadarRepository";
import { FundRadarIdentityError } from "../src/lib/fund-radar/FundRadarIdentity";
import { createFundRadarHandlers, type FundRadarTelemetryEvent } from "../src/server/controllers/FundRadarControllerCore";

const SUBJECT: FundRadarSubject = Object.freeze({ ownerId: "owner-server-side", plan: "free" });

function request(method: string, body?: unknown, origin = "https://preview.example.test") {
  return new Request("https://preview.example.test/api/fund-radar", {
    method,
    headers: {
      origin,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function setup(options: { enabled?: boolean; auth?: boolean } = {}) {
  const calls: Array<{ operation: string; subject?: FundRadarSubject; value?: unknown }> = [];
  const telemetry: FundRadarTelemetryEvent[] = [];
  const service = {
    async list(subject: FundRadarSubject) {
      calls.push({ operation: "list", subject });
      return { plan: subject.plan, planLabel: "Grátis", limit: 1, activeCount: 0, funds: [], updates: [] };
    },
    async follow(subject: FundRadarSubject, ticker: unknown) {
      calls.push({ operation: "follow", subject, value: ticker });
      return { created: true, fund: { ticker }, limit: 1, activeCount: 1 };
    },
    async remove(subject: FundRadarSubject, ticker: unknown) {
      calls.push({ operation: "remove", subject, value: ticker });
      return { removed: true, ticker, limit: 1, activeCount: 0 };
    },
    async setNotifications(subject: FundRadarSubject, ticker: unknown, enabled: boolean) {
      calls.push({ operation: "notifications", subject, value: { ticker, enabled } });
      return { ticker, notificationsEnabled: enabled, activeCount: 1 };
    },
    async refresh(subject: FundRadarSubject) {
      calls.push({ operation: "refresh", subject });
      return { processed: 1, createdUpdates: [] };
    },
  } as unknown as Pick<FundRadarService, "list" | "follow" | "remove" | "setNotifications" | "refresh">;
  const handlers = createFundRadarHandlers({
    enabled: () => options.enabled !== false,
    sameOrigin: (incoming) => incoming.headers.get("origin") === new URL(incoming.url).origin,
    async resolveSubject() {
      if (options.auth === false) throw new FundRadarIdentityError("FUND_RADAR_AUTH_REQUIRED", 401);
      return SUBJECT;
    },
    async consumeRateLimit(ownerId) {
      calls.push({ operation: "rate", value: ownerId });
    },
    service,
    async telemetry(event) {
      telemetry.push(event);
    },
  });
  return { handlers, calls, telemetry };
}

test("feature flag desligada falha fechado antes de autenticação ou serviço", async () => {
  const { handlers, calls } = setup({ enabled: false });
  const response = await handlers.GET(request("GET"));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "FUND_RADAR_DISABLED");
  assert.equal(calls.length, 0);
});

test("autenticação e origem são obrigatórias", async () => {
  const unauthorized = setup({ auth: false });
  assert.equal((await unauthorized.handlers.GET(request("GET"))).status, 401);
  const forbidden = setup();
  assert.equal((await forbidden.handlers.POST(request("POST", { ticker: "MXRF11" }, "https://evil.example"))).status, 403);
  assert.equal(forbidden.calls.length, 0);
});

test("plano e entitlement enviados pelo cliente são rejeitados pela allowlist", async () => {
  const { handlers, calls } = setup();
  const response = await handlers.POST(request("POST", { ticker: "MXRF11", plan: "super_premium", isVip: true }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "FUND_RADAR_INVALID_PAYLOAD");
  assert.deepEqual(calls.map((call) => call.operation), ["rate"]);
});

test("follow usa plano resolvido no servidor, aplica rate limit e gera telemetria agregada", async () => {
  const { handlers, calls, telemetry } = setup();
  const response = await handlers.POST(request("POST", { ticker: "mxrf11" }));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).fund.ticker, "MXRF11");
  assert.deepEqual(calls.map((call) => call.operation), ["rate", "follow"]);
  assert.equal(calls[1]?.subject?.plan, "free");
  assert.deepEqual(telemetry, ["radar_follow_started"]);
});

test("GET, preferência, remoção idempotente e refresh usam contratos separados", async () => {
  const { handlers, calls, telemetry } = setup();
  assert.equal((await handlers.GET(request("GET"))).status, 200);
  assert.equal((await handlers.PATCH(request("PATCH", { ticker: "MXRF11", notificationsEnabled: false }))).status, 200);
  assert.equal((await handlers.DELETE(request("DELETE", { ticker: "MXRF11" }))).status, 200);
  assert.equal((await handlers.REFRESH(request("POST"))).status, 200);
  assert.deepEqual(calls.map((call) => call.operation), ["list", "rate", "notifications", "rate", "remove", "rate", "refresh"]);
  assert.deepEqual(telemetry, ["radar_follow_removed"]);
});

test("payload vazio, conteúdo incorreto e campos extras falham sem chamar serviço", async () => {
  const { handlers, calls } = setup();
  const contentType = await handlers.POST(new Request("https://preview.example.test/api/fund-radar", {
    method: "POST",
    headers: { origin: "https://preview.example.test", "content-type": "text/plain" },
    body: "MXRF11",
  }));
  assert.equal(contentType.status, 415);
  const invalid = await handlers.PATCH(request("PATCH", { ticker: "MXRF11", notificationsEnabled: false, ownerId: "attacker" }));
  assert.equal(invalid.status, 400);
  assert.deepEqual(calls.map((call) => call.operation), ["rate", "rate"]);
});
