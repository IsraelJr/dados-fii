export const PRODUCT_EVENT_NAMES = [
  "portfolio_viewed",
  "history_month_added",
  "history_month_updated",
  "history_month_deleted",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export type ProductEvent = Readonly<{
  name: ProductEventName;
  occurredAt: string;
  schemaVersion: 1;
}>;

export class ProductEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductEventValidationError";
  }
}

export function createProductEvent(value: unknown, now = new Date()): ProductEvent {
  const name = String(value ?? "") as ProductEventName;
  if (!PRODUCT_EVENT_NAMES.includes(name)) {
    throw new ProductEventValidationError("Evento de produto inválido.");
  }
  return Object.freeze({ name, occurredAt: now.toISOString(), schemaVersion: 1 });
}
