/* In-memory TTL cache + in-flight de-duplication.
   Identical concurrent searches share one ZenRows call, and repeats are served free. */
export class TTLCache {
  constructor(max = 500) {
    this.max = max;
    this.map = new Map();
  }
  get(key) {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.exp <= Date.now()) { this.map.delete(key); return undefined; }
    /* refresh recency */
    this.map.delete(key);
    this.map.set(key, e);
    return e.value;
  }
  set(key, value, ttlMs) {
    this.map.delete(key);
    this.map.set(key, { value, exp: Date.now() + ttlMs });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
  }
  get size() { return this.map.size; }
}

export function createMemo(cache) {
  const inflight = new Map();
  /* fn() must resolve to { value, ttlMs }. Rejections are never cached. */
  return async function memo(key, fn) {
    const hit = cache.get(key);
    if (hit !== undefined) return { value: hit, cached: true };
    if (inflight.has(key)) return { value: await inflight.get(key), cached: false };
    const p = (async () => {
      try {
        const { value, ttlMs } = await fn();
        if (ttlMs > 0) cache.set(key, value, ttlMs);
        return value;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, p);
    return { value: await p, cached: false };
  };
}
