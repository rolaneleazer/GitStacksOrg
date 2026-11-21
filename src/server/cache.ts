interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

let cacheHits = 0;
let cacheMisses = 0;
let avoidedQueriesEstimate = 0;
let lastFlushedAt: string | null = null;

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}

export function getCachedValue<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  cacheHits += 1;
  avoidedQueriesEstimate += 1;
  return entry.value as T;
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number): void {
  if (ttlMs <= 0) return;
  if (store.size > 400) {
    pruneExpired();
  }
  store.set(key, {
    value,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs
  });
}

/**
 * Deduplicates concurrent in-flight requests and caches resolved values for `ttlMs`.
 * Pass `queryWeight` (approx number of Supabase calls avoided on a cache hit) for accurate Quota Shield telemetry.
 */
export async function getCachedOrFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  queryWeight = 1
): Promise<T> {
  const cached = store.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    cacheHits += 1;
    avoidedQueriesEstimate += Math.max(1, queryWeight);
    return cached.value as T;
  }

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) {
    cacheHits += 1;
    avoidedQueriesEstimate += Math.max(1, queryWeight);
    return pending;
  }

  cacheMisses += 1;
  const promise = fetcher()
    .then((result) => {
      setCachedValue(key, result, ttlMs);
      inFlight.delete(key);
      return result;
    })
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, promise);
  return promise;
}

export function invalidateCache(prefixOrKey?: string): number {
  if (!prefixOrKey) {
    const count = store.size;
    store.clear();
    lastFlushedAt = new Date().toISOString();
    return count;
  }

  let removed = 0;
  for (const key of store.keys()) {
    if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function getCacheStats(): {
  hits: number;
  misses: number;
  entries: number;
  hitRatePercent: number;
  avoidedQueriesEstimate: number;
  lastFlushedAt: string | null;
} {
  pruneExpired();
  const total = cacheHits + cacheMisses;
  const hitRatePercent = total === 0 ? 0 : Math.round((cacheHits / total) * 1000) / 10;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    entries: store.size,
    hitRatePercent,
    avoidedQueriesEstimate,
    lastFlushedAt
  };
}
