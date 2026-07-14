type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  loadedAt: string;
};

export class RegulatoryCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 100
  ) {}

  get(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, value: T) {
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey) this.entries.delete(oldestKey);
    }

    const loadedAt = new Date().toISOString();
    const entry: CacheEntry<T> = {
      value,
      loadedAt,
      expiresAt: Date.now() + this.ttlMs,
    };
    this.entries.set(key, entry);
    return entry;
  }

  delete(key: string) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }

  size() {
    return this.entries.size;
  }
}

export function regulatoryCacheTtlMs() {
  const configured = Number(process.env.REGULATORY_CACHE_TTL_MS || 60_000);
  if (!Number.isFinite(configured)) return 60_000;
  return Math.min(Math.max(Math.floor(configured), 5_000), 5 * 60_000);
}
