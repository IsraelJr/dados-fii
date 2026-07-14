import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native strip-types runner requires the explicit .ts suffix.
import { RegulatoryTimeline } from "../src/lib/regulatory/RegulatoryTimeline.ts";

const now = "2026-07-14T12:00:00.000Z";

test("timeline consolidates all five canonical regulatory categories", () => {
  const timeline = new RegulatoryTimeline().build({
    ticker: "TGAR11",
    generatedAt: now,
    records: [
      { id: "doc", data: { type: "document", title: "Informe mensal", date: "10/07/2026", url: "https://example.com/informe" } },
      { id: "fact", data: { type: "fato relevante", title: "Fato relevante", occurredAt: "2026-07-11T10:00:00Z" } },
      { id: "assembly", data: { type: "assembleia", title: "AGE", occurredAt: "2026-07-12T10:00:00Z" } },
      { id: "regulation", data: { type: "regulamento", title: "Novo regulamento", occurredAt: "2026-07-13T10:00:00Z" } },
    ],
    overlay: { events: [{ title: "Atualização cadastral", date: "09/07/2026" }] },
    auditEvents: [],
  });
  assert.equal(timeline.items.length, 5);
  assert.deepEqual(timeline.counts, { document: 1, event: 1, material_fact: 1, assembly: 1, regulation: 1 });
  assert.equal(timeline.items[0].type, "regulation");
  assert.equal(timeline.generatedAt, now);
});

test("timeline includes audited publication and rollback without exposing unsafe URLs", () => {
  const timeline = new RegulatoryTimeline().build({
    ticker: "VGIA11",
    records: [{ id: "unsafe", data: { type: "document", title: "Documento", date: now, url: "javascript:alert(1)" } }],
    overlay: null,
    auditEvents: [
      { id: "p1", action: "publish", ticker: "VGIA11", createdAt: now, metadata: { versionId: "v000001" } },
      { id: "r1", action: "rollback", ticker: "VGIA11", createdAt: "2026-07-13T12:00:00Z", metadata: { versionId: "v000002" } },
    ],
  });
  assert.equal(timeline.counts.event, 2);
  assert.equal(timeline.items.find((item) => item.id === "unsafe")?.url, null);
  assert.ok(timeline.items.some((item) => item.title === "Publicação regulatória"));
  assert.ok(timeline.items.some((item) => item.title === "Rollback regulatório"));
});

test("timeline filters categories and paginates with an opaque cursor", () => {
  const engine = new RegulatoryTimeline();
  const input = {
    ticker: "MXRF11",
    overlay: null,
    auditEvents: [],
    records: Array.from({ length: 5 }, (_, index) => ({ id: `doc-${index}`, data: { type: "document", title: `Documento ${index}`, occurredAt: `2026-07-${String(index + 1).padStart(2, "0")}T12:00:00Z` } })),
    types: ["document" as const],
    limit: 2,
  };
  const first = engine.build(input);
  assert.equal(first.items.length, 2);
  assert.ok(first.nextCursor);
  const second = engine.build({ ...input, cursor: first.nextCursor });
  assert.equal(second.items.length, 2);
  assert.notEqual(second.items[0].id, first.items[0].id);
  const third = engine.build({ ...input, cursor: second.nextCursor });
  assert.equal(third.items.length, 1);
  assert.equal(third.nextCursor, null);
});
