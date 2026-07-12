export const SUPPORTED_INGESTION_TICKERS = ["TGAR11", "VGIA11"] as const;

export type SupportedIngestionTicker = typeof SUPPORTED_INGESTION_TICKERS[number];

const KNOWN_INGESTION_CNPJS: Partial<Record<SupportedIngestionTicker, string>> = {
  VGIA11: "41081088000109",
};

export function normalizeIngestionTicker(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function isSupportedIngestionTicker(value: unknown): value is SupportedIngestionTicker {
  const ticker = normalizeIngestionTicker(value);
  return SUPPORTED_INGESTION_TICKERS.includes(ticker as SupportedIngestionTicker);
}

export function assertSupportedIngestionTicker(value: unknown): SupportedIngestionTicker {
  const ticker = normalizeIngestionTicker(value);
  if (!isSupportedIngestionTicker(ticker)) {
    throw new Error(
      `Ticker não autorizado para o modo operacional. Permitidos: ${SUPPORTED_INGESTION_TICKERS.join(", ")}.`
    );
  }
  return ticker;
}

export function getKnownIngestionCnpj(value: unknown) {
  const ticker = normalizeIngestionTicker(value);
  if (!isSupportedIngestionTicker(ticker)) return "";
  return KNOWN_INGESTION_CNPJS[ticker] || "";
}
