import assert from "node:assert/strict";
import test from "node:test";
import {
  pseudonymousLogId,
  sanitizeForLog,
} from "../src/lib/observability/SafeLogger";
import {
  ObservabilityPersistenceError,
  ObservabilityService,
} from "../src/lib/observability/ObservabilityService";

test("[REG-DEF-16] sanitização remove e-mail, bearer, JWT e campos sensíveis", () => {
  const sanitized = sanitizeForLog({
    actor: "admin@example.com",
    authorization: "Bearer super-secret",
    nested: {
      token: "abc",
      message: "Falha para person@example.com com eyJhbGciOiJIUzI1NiJ9.payload.signature e token=segredo-bruto",
    },
  }) as Record<string, unknown>;
  const serialized = JSON.stringify(sanitized);
  assert.doesNotMatch(serialized, /admin@example|person@example|super-secret|eyJhbGci|segredo-bruto/);
  assert.match(serialized, /redacted/);
});

test("identificador de log é estável e não expõe o valor original", () => {
  const first = pseudonymousLogId("firebase-user-123");
  assert.equal(first, pseudonymousLogId("firebase-user-123"));
  assert.match(first, /^[a-f0-9]{16}$/);
  assert.doesNotMatch(first, /firebase|user/);
});

test("falha não crítica é contada e falha crítica reprova a operação", async () => {
  const service = new ObservabilityService({
    async append() {
      throw new Error("token=segredo@example.com");
    },
  });
  const nonCritical = await service.record({
    type: "system",
    ok: false,
    correlationId: "corrective-observability",
    error: "Bearer segredo",
  });
  assert.equal(nonCritical.persisted, false);
  assert.deepEqual(service.metrics(), { persistedEvents: 0, lostEvents: 1 });
  await assert.rejects(
    service.record({
      type: "portfolio_notifications",
      ok: true,
      correlationId: "corrective-observability",
    }, { required: true }),
    ObservabilityPersistenceError,
  );
  assert.deepEqual(service.metrics(), { persistedEvents: 0, lostEvents: 2 });
});

test("evento persistido mantém correlação e dados sanitizados", async () => {
  const events: Record<string, unknown>[] = [];
  const service = new ObservabilityService({
    async append(event) {
      events.push(event);
    },
  });
  const result = await service.record({
    type: "fii_lookup",
    ok: true,
    ticker: "tgar11",
    correlationId: "corrective-correlation-123",
    metadata: { email: "investidor@example.com", source: "CVM" },
  });
  assert.equal(result.persisted, true);
  assert.equal(events[0].correlationId, "corrective-correlation-123");
  assert.deepEqual(events[0].metadata, { email: "[redacted]", source: "CVM" });
  assert.deepEqual(service.metrics(), { persistedEvents: 1, lostEvents: 0 });
});
