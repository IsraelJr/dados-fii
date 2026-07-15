export type UserWalletItem = { ticker: string; quotas: number };

const TICKER_KEYS = ["ticker", "code", "fii", "symbol", "assetTicker", "fundTicker", "tickerSymbol", "codigo", "ativo"];
const QUOTA_KEYS = ["quotas", "quantity", "qtd", "shares", "cotas", "totalQuotas", "quota", "amount", "units", "totalCotas", "quantidade"];

function valueAt(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (value[key] !== null && value[key] !== undefined && value[key] !== "") return value[key];
  }
  return undefined;
}

export function userWalletTicker(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export function userWalletQuotas(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function validTicker(value: string, strict = false) {
  return strict ? /^[A-Z]{4,6}\d{1,2}$/.test(value) : /^[A-Z0-9]{4,8}$/.test(value);
}

function validItem(item: UserWalletItem) {
  return validTicker(item.ticker) && item.quotas > 0;
}

function parseEntry(value: unknown, fallbackTicker?: string): UserWalletItem {
  if (typeof value === "string") {
    const ticker = userWalletTicker(value);
    if (validTicker(ticker)) return { ticker, quotas: 1 };
    return { ticker: userWalletTicker(fallbackTicker), quotas: userWalletQuotas(value) };
  }
  if (typeof value === "number") return { ticker: userWalletTicker(fallbackTicker), quotas: userWalletQuotas(value) };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ticker: "", quotas: 0 };

  const record = value as Record<string, unknown>;
  const ticker = userWalletTicker(valueAt(record, TICKER_KEYS) || fallbackTicker);
  const quotas = userWalletQuotas(valueAt(record, QUOTA_KEYS));
  if (ticker && quotas) return { ticker, quotas };

  const entries = Object.entries(record);
  if (entries.length === 1) return parseEntry(entries[0][1], entries[0][0]);
  return { ticker: "", quotas: 0 };
}

export function userWalletFrom(value: unknown, options?: { strictMapKeys?: boolean }): UserWalletItem[] {
  let items: UserWalletItem[] = [];
  if (Array.isArray(value)) items = value.map((item) => parseEntry(item));
  else if (value && typeof value === "object") {
    items = Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const parsed = parseEntry(item, key);
      if (options?.strictMapKeys && !validTicker(parsed.ticker, true)) return { ticker: "", quotas: 0 };
      return parsed;
    });
  }
  const byTicker = new Map<string, UserWalletItem>();
  items.filter(validItem).forEach((item) => byTicker.set(item.ticker, item));
  return Array.from(byTicker.values()).sort((a, b) => a.ticker.localeCompare(b.ticker)).slice(0, 120);
}

export function extractUserWallet(data: Record<string, unknown> | null | undefined): UserWalletItem[] {
  const record = data || {};
  const wallet = record.wallet as Record<string, unknown> | undefined;
  const carteira = record.carteira as Record<string, unknown> | undefined;
  const portfolio = record.portfolio as Record<string, unknown> | undefined;
  const monitored = record.monitored as Record<string, unknown> | undefined;
  const candidates = [
    record.wallet, wallet?.items, wallet?.fiis, wallet?.assets, wallet?.positions,
    record.carteira, carteira?.items, carteira?.fiis, carteira?.ativos, carteira?.positions,
    record.fiis, record.funds, record.assets, record.positions, record.holdings, record.investments,
    record.portfolio, portfolio?.items, portfolio?.fiis, portfolio?.assets, portfolio?.positions,
    monitored?.fiis, record.monitoredFiis, record.selectedFiis, record.favorites,
    record.fiiWallet, record.walletFiis, record.userWallet,
  ];
  for (const candidate of candidates) {
    const result = userWalletFrom(candidate);
    if (result.length) return result;
  }

  // Some iOS/legacy documents stored each ticker as a top-level key.
  return userWalletFrom(record, { strictMapKeys: true });
}
