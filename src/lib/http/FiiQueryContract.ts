import { normalizeTicker } from "@/lib/regulatory/RegulatoryNormalizer";

export type FiiQuery =
  | { ok: true; mode: "detail"; ticker: string }
  | { ok: true; mode: "list"; limit: number; offset: number }
  | { ok: false; status: 400; code: string; error: string };

function decodeCursor(value: string | null) {
  if (!value) return 0;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const match = decoded.match(/^fii:(\d+)$/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

export function encodeFiiCursor(offset: number) {
  return Buffer.from(`fii:${Math.max(0, Math.floor(offset))}`, "utf8").toString("base64url");
}

export function parseFiiQuery(url: URL): FiiQuery {
  const tickerValues = url.searchParams.getAll("ticker");
  if (tickerValues.length > 1) {
    return { ok: false, status: 400, code: "duplicate_ticker", error: "Informe apenas um ticker." };
  }
  if (tickerValues.length === 1) {
    const ticker = normalizeTicker(tickerValues[0]);
    if (!ticker) return { ok: false, status: 400, code: "invalid_ticker", error: "Ticker ausente ou inválido." };
    return { ok: true, mode: "detail", ticker };
  }

  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? 100 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    return { ok: false, status: 400, code: "invalid_limit", error: "limit deve ser um inteiro entre 1 e 500." };
  }
  const offset = decodeCursor(url.searchParams.get("cursor"));
  if (offset === null) {
    return { ok: false, status: 400, code: "invalid_cursor", error: "Cursor inválido." };
  }
  return { ok: true, mode: "list", limit, offset };
}
