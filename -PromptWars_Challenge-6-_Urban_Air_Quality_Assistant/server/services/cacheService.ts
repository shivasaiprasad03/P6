/**
 * Bounded LRU + TTL in-memory cache with in-flight request deduplication (coalescing).
 * Prevents cache stampedes and avoids redundant external API or GenAI token spend.
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheStats {
  size: number;
  maxEntries: number;
  hits: number;
  misses: number;
  coalesced: number;
}

/**
 * Bounded LRU + TTL cache with in-flight request deduplication (coalescing).
 */
export class TtlLruCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly inflight = new Map<string, Promise<T>>();
  private hits = 0;
  private misses = 0;
  private coalesced = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly defaultTtlMs: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }

    // Refresh recency for LRU eviction
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number = this.defaultTtlMs): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Returns cached value or executes `loader`, coalescing concurrent misses for the same key.
   */
  async getOrLoad(
    key: string,
    loader: () => Promise<T>,
    ttlMs: number = this.defaultTtlMs,
  ): Promise<{ value: T; hit: boolean }> {
    const existing = this.get(key);
    if (existing !== undefined) {
      return { value: existing, hit: true };
    }

    const pending = this.inflight.get(key);
    if (pending) {
      this.coalesced += 1;
      const value = await pending;
      return { value, hit: true };
    }

    const promise = loader()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    const value = await promise;
    return { value, hit: false };
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }

  stats(): CacheStats {
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      coalesced: this.coalesced,
    };
  }
}
