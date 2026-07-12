import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

const OBSERVABILITY_COLLECTION = "AppObservabilityEvents";

export type ObservabilityEventInput = {
  type: "fii_lookup" | "fii_batch_lookup" | "risk_report" | "portfolio_notifications" | "system";
  ok: boolean;
  statusCode?: number;
  ticker?: string;
  tickers?: string[];
  message?: string;
  error?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

function normalizeTicker(value?: string) {
  return String(value || "").trim().toUpperCase().slice(0, 16);
}

export async function logObservabilityEvent(input: ObservabilityEventInput) {
  try {
    const now = new Date();
    await adminDb.collection(OBSERVABILITY_COLLECTION).add({
      type: input.type,
      ok: Boolean(input.ok),
      statusCode: input.statusCode || (input.ok ? 200 : 500),
      ticker: normalizeTicker(input.ticker),
      tickers: Array.isArray(input.tickers) ? input.tickers.map(normalizeTicker).filter(Boolean).slice(0, 80) : [],
      message: input.message || null,
      error: input.error || null,
      source: input.source || null,
      metadata: input.metadata || {},
      createdAt: adminFieldValue.serverTimestamp(),
      createdAtIso: now.toISOString(),
      dateKey: now.toISOString().slice(0, 10),
    });
  } catch (err) {
    console.warn("Observability log failed", err);
  }
}

export const OBSERVABILITY_COLLECTION_NAME = OBSERVABILITY_COLLECTION;
