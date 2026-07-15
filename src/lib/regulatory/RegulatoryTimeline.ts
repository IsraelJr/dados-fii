import { createHash } from "crypto";
import type { RegulatoryAuditEvent } from "../../types/regulatory";
import type {
  RegulatoryTimelineItem,
  RegulatoryTimelineResponse,
  RegulatoryTimelineType,
  TimelineRecord,
} from "../../types/timeline";
import type { RegulatoryOverlay } from "./RegulatoryTypes";

export const TIMELINE_TYPES: RegulatoryTimelineType[] = ["document", "event", "material_fact", "assembly", "regulation"];

const ARRAY_FIELDS: Array<{ keys: string[]; type?: RegulatoryTimelineType }> = [
  { keys: ["timeline", "regulatoryTimeline"] },
  { keys: ["documents", "documentos", "regulatoryDocuments"], type: "document" },
  { keys: ["events", "eventos", "regulatoryEvents"], type: "event" },
  { keys: ["materialFacts", "fatosRelevantes", "fatos_relevantes"], type: "material_fact" },
  { keys: ["assemblies", "assembleias"], type: "assembly" },
  { keys: ["regulations", "regulamentos"], type: "regulation" },
];

function text(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function valueAt(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  if (typeof value === "string") {
    const brazilian = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
    if (brazilian) {
      const [, day, month, year, hour = "12", minute = "00"] = brazilian;
      const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00-03:00`);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
  }
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function safeUrl(value: unknown) {
  const result = text(value);
  if (!result) return null;
  try {
    const url = new URL(result);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeTimelineType(value: unknown, fallback: RegulatoryTimelineType = "event"): RegulatoryTimelineType {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (/fato.*relev|material.*fact/.test(normalized)) return "material_fact";
  if (/assemble|ago|age|agm|egm/.test(normalized)) return "assembly";
  if (/regulament|regulation|estatuto|bylaw/.test(normalized)) return "regulation";
  if (/document|informe|relatorio|report|comunicado|ata/.test(normalized)) return "document";
  if (/event|evento|publica|rollback/.test(normalized)) return "event";
  return fallback;
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 20);
}

function metadata(data: Record<string, unknown>) {
  const allowed = ["category", "status", "referencePeriod", "protocol", "documentType", "eventType"];
  return Object.fromEntries(allowed.flatMap((key) => {
    const value = data[key];
    return ["string", "number", "boolean"].includes(typeof value) ? [[key, value as string | number | boolean]] : [];
  }));
}

function itemFromData(ticker: string, data: Record<string, unknown>, id?: string, forcedType?: RegulatoryTimelineType, fallbackSource = "Base regulatória Dados FII"): RegulatoryTimelineItem | null {
  const type = normalizeTimelineType(valueAt(data, ["type", "kind", "category", "documentType", "eventType"]), forcedType || "event");
  const title = text(valueAt(data, ["title", "name", "subject", "headline", "description"])) || {
    document: "Documento regulatório",
    event: "Evento regulatório",
    material_fact: "Fato relevante",
    assembly: "Assembleia",
    regulation: "Regulamento",
  }[type];
  const occurredAt = toIso(valueAt(data, ["occurredAt", "eventDate", "date", "referenceDate", "publishedAt", "createdAt", "receivedAt"]));
  const publishedAt = toIso(valueAt(data, ["publishedAt", "publicationDate", "receivedAt", "createdAt"]));
  const url = safeUrl(valueAt(data, ["url", "link", "documentUrl", "fileUrl", "sourceUrl"]));
  const sourceValue = valueAt(data, ["provider", "sourceName", "source"]);
  const source = typeof sourceValue === "string" ? sourceValue.trim() || fallbackSource : fallbackSource;
  const summary = text(valueAt(data, ["summary", "description", "details", "content"]));
  const documentNumber = text(valueAt(data, ["documentNumber", "protocol", "number"]));
  const version = text(valueAt(data, ["version", "versionId", "parserVersion"]));
  const itemId = id || fingerprint({ ticker, type, title, occurredAt, url, documentNumber });
  return { id: itemId, ticker, type, title, summary, occurredAt, publishedAt, url, source, documentNumber, version, metadata: metadata(data) };
}

function objectValue(value: unknown) {
  if (typeof value === "string") return { title: value };
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function overlayItems(ticker: string, overlay: RegulatoryOverlay | null) {
  if (!overlay) return [];
  return ARRAY_FIELDS.flatMap(({ keys, type }) => {
    const found = keys.map((key) => overlay[key]).find(Array.isArray);
    if (!Array.isArray(found)) return [];
    return found.flatMap((raw, index) => {
      const data = objectValue(raw);
      if (!data) return [];
      const item = itemFromData(ticker, data, text(data.id) || `${keys[0]}-${index}`, type, "Overlay regulatório Dados FII");
      return item ? [item] : [];
    });
  });
}

function auditItems(ticker: string, events: RegulatoryAuditEvent[]) {
  return events.flatMap((event) => {
    if (!["publish", "rollback"].includes(event.action)) return [];
    const title = event.action === "publish" ? "Publicação regulatória" : "Rollback regulatório";
    const data: Record<string, unknown> = {
      type: "event",
      title,
      summary: event.action === "publish" ? "Nova versão regulatória publicada após aprovação e backup." : "Versão regulatória anterior restaurada com auditoria.",
      occurredAt: event.createdAt,
      source: "Auditoria Dados FII",
      version: event.metadata?.versionId,
      status: "completed",
    };
    const item = itemFromData(ticker, data, `audit-${event.id}`, "event", "Auditoria Dados FII");
    return item ? [item] : [];
  });
}

function encodeCursor(offset: number) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

function decodeCursor(cursor?: string | null) {
  if (!cursor) return 0;
  try {
    const offset = Number(Buffer.from(cursor, "base64url").toString("utf8"));
    return Number.isInteger(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}

export class RegulatoryTimeline {
  build(input: {
    ticker: string;
    records: TimelineRecord[];
    overlay: RegulatoryOverlay | null;
    auditEvents: RegulatoryAuditEvent[];
    types?: RegulatoryTimelineType[];
    limit?: number;
    cursor?: string | null;
    generatedAt?: string;
  }): RegulatoryTimelineResponse {
    const ticker = input.ticker.toUpperCase();
    const records = input.records.flatMap(({ id, data }) => {
      const item = itemFromData(ticker, data, id);
      return item ? [item] : [];
    });
    const unique = new Map<string, RegulatoryTimelineItem>();
    [...records, ...overlayItems(ticker, input.overlay), ...auditItems(ticker, input.auditEvents)].forEach((item) => {
      const key = fingerprint({ type: item.type, title: item.title.toLowerCase(), date: item.occurredAt?.slice(0, 10), url: item.url });
      if (!unique.has(key)) unique.set(key, item);
    });
    const allItems = [...unique.values()].sort((a, b) => {
      const dateOrder = String(b.occurredAt || b.publishedAt || "").localeCompare(String(a.occurredAt || a.publishedAt || ""));
      return dateOrder || a.title.localeCompare(b.title);
    });
    const counts = Object.fromEntries(TIMELINE_TYPES.map((type) => [type, allItems.filter((item) => item.type === type).length])) as Record<RegulatoryTimelineType, number>;
    const appliedTypes = (input.types?.length ? input.types : TIMELINE_TYPES).filter((type, index, list) => TIMELINE_TYPES.includes(type) && list.indexOf(type) === index);
    const filtered = allItems.filter((item) => appliedTypes.includes(item.type));
    const offset = decodeCursor(input.cursor);
    const limit = Math.min(Math.max(input.limit || 20, 1), 100);
    const items = filtered.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    return {
      ticker,
      generatedAt: input.generatedAt || new Date().toISOString(),
      items,
      total: filtered.length,
      counts,
      appliedTypes,
      nextCursor: nextOffset < filtered.length ? encodeCursor(nextOffset) : null,
      sources: Array.from(new Set(items.map((item) => item.source))).sort(),
    };
  }
}

export const regulatoryTimeline = new RegulatoryTimeline();
