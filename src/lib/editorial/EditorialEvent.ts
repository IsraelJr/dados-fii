import type { MarketArticleSlug } from "./marketContent";

export const EDITORIAL_EVENT_NAMES = [
  "market_hub_viewed",
  "market_article_viewed",
  "market_continuation_clicked",
] as const;

export const EDITORIAL_ENTRY_CLASSES = ["direct", "search", "social", "internal", "other"] as const;
export const EDITORIAL_DESTINATIONS = ["fund", "portfolio", "premium", "editorial"] as const;

export type EditorialEventName = (typeof EDITORIAL_EVENT_NAMES)[number];
export type EditorialEntryClass = (typeof EDITORIAL_ENTRY_CLASSES)[number];
export type EditorialDestination = (typeof EDITORIAL_DESTINATIONS)[number];
export type EditorialPage = MarketArticleSlug | "hub";

export type EditorialEvent = Readonly<{
  name: EditorialEventName;
  page: EditorialPage;
  entryClass: EditorialEntryClass;
  destination?: EditorialDestination;
  origin: "market-content";
  schemaVersion: 1;
  correlationId: string;
  occurredAt: string;
  expiresAt: string;
}>;

export class EditorialEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorialEventValidationError";
  }
}

function isDate(value: string) {
  return Number.isFinite(Date.parse(value));
}

export function createEditorialEvent(
  input: unknown,
  correlationId: string,
  now = new Date(),
): EditorialEvent {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const name = String(body.name ?? "") as EditorialEventName;
  const page = String(body.page ?? "") as EditorialPage;
  const entryClass = String(body.entryClass ?? "") as EditorialEntryClass;
  const destination = body.destination === undefined ? undefined : String(body.destination) as EditorialDestination;

  if (!EDITORIAL_EVENT_NAMES.includes(name)) throw new EditorialEventValidationError("Evento editorial inválido.");
  if (page !== "hub" && !/^[a-z0-9-]{3,80}$/.test(page)) throw new EditorialEventValidationError("Página editorial inválida.");
  if (!EDITORIAL_ENTRY_CLASSES.includes(entryClass)) throw new EditorialEventValidationError("Origem editorial inválida.");
  if (destination !== undefined && !EDITORIAL_DESTINATIONS.includes(destination)) throw new EditorialEventValidationError("Destino editorial inválido.");
  if (name === "market_continuation_clicked" && destination === undefined) throw new EditorialEventValidationError("Destino editorial obrigatório.");
  if (name !== "market_continuation_clicked" && destination !== undefined) throw new EditorialEventValidationError("Destino editorial inesperado.");
  if (!/^[0-9a-f-]{20,80}$/i.test(correlationId)) throw new EditorialEventValidationError("Correlação editorial inválida.");

  const occurredAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
  if (!isDate(occurredAt) || !isDate(expiresAt)) throw new EditorialEventValidationError("Data editorial inválida.");

  return Object.freeze({
    name,
    page,
    entryClass,
    ...(destination ? { destination } : {}),
    origin: "market-content",
    schemaVersion: 1,
    correlationId,
    occurredAt,
    expiresAt,
  });
}
