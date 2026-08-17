import { safeLog, sanitizeForLog } from "@/lib/observability/SafeLogger";

export type ObservabilityEventInput = {
  type: "fii_lookup" | "fii_batch_lookup" | "risk_report" | "portfolio_notifications" | "system"
    | "radar_follow_started" | "radar_follow_removed" | "radar_limit_reached" | "radar_update_opened";
  ok: boolean;
  statusCode?: number;
  ticker?: string;
  tickers?: string[];
  message?: string;
  error?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
};

export type ObservabilityWriteOptions = {
  required?: boolean;
};

export type ObservabilitySink = {
  append(event: Record<string, unknown>): Promise<void>;
};

export class ObservabilityPersistenceError extends Error {
  constructor() {
    super("Não foi possível persistir a evidência operacional obrigatória.");
    this.name = "ObservabilityPersistenceError";
  }
}

function normalizeTicker(value?: string) {
  return String(value || "").trim().toUpperCase().slice(0, 16);
}

function correlationId(value?: string) {
  const normalized = String(value || "");
  return /^[A-Za-z0-9._-]{8,128}$/.test(normalized) ? normalized : null;
}

export class ObservabilityService {
  private persisted = 0;
  private lost = 0;
  private readonly sink: ObservabilitySink;

  constructor(sink: ObservabilitySink) {
    this.sink = sink;
  }

  async record(input: ObservabilityEventInput, options: ObservabilityWriteOptions = {}) {
    const now = new Date();
    const event = {
      type: input.type,
      ok: Boolean(input.ok),
      statusCode: input.statusCode || (input.ok ? 200 : 500),
      ticker: normalizeTicker(input.ticker),
      tickers: Array.isArray(input.tickers) ? input.tickers.map(normalizeTicker).filter(Boolean).slice(0, 80) : [],
      message: input.message ? sanitizeForLog(input.message) : null,
      error: input.error ? sanitizeForLog(input.error) : null,
      source: input.source ? sanitizeForLog(input.source) : null,
      metadata: sanitizeForLog(input.metadata || {}),
      correlationId: correlationId(input.correlationId),
      createdAtIso: now.toISOString(),
      dateKey: now.toISOString().slice(0, 10),
    };
    try {
      await this.sink.append(event);
      this.persisted += 1;
      return { persisted: true as const, event };
    } catch (error) {
      this.lost += 1;
      safeLog(options.required ? "error" : "warn", "observability.persistence.failed", {
        required: Boolean(options.required),
        eventType: input.type,
        correlationId: event.correlationId,
        error,
        lostEvents: this.lost,
      });
      if (options.required) throw new ObservabilityPersistenceError();
      return { persisted: false as const, event };
    }
  }

  metrics() {
    return {
      persistedEvents: this.persisted,
      lostEvents: this.lost,
    };
  }
}
