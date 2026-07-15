type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export class RegulatoryCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private evictions = 0;
  private expired = 0;

  constructor(ttlMs: number, maxEntries: number) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      this.expired += 1;
      this.misses += 1;
      return null;
    }
    this.hits += 1;
    // Refresh insertion order so frequently used entries are retained.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.ttlMs) {
    this.sets += 1;
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.entries.delete(oldest);
      this.evictions += 1;
    }
  }

  delete(key: string) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }

  get size() {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
        this.expired += 1;
      }
    }
    return this.entries.size;
  }

  stats() {
    const requests = this.hits + this.misses;
    return {
      entries: this.size,
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      evictions: this.evictions,
      expired: this.expired,
      hitRate: requests ? Math.round((this.hits / requests) * 10_000) / 100 : 0,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
    };
  }
}

export function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
