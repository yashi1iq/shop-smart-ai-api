const MAX = 800, store = new Map(), inflight = new Map();
export const get = k => { const e = store.get(k); if (!e) return undefined; if (e.exp < Date.now()) { store.delete(k); return undefined; } return e.v; };
export const set = (k, v, ttl) => { if (store.size >= MAX) store.delete(store.keys().next().value); store.set(k, { v, exp: Date.now() + ttl }); };
/* Coalesce identical concurrent requests so one burst of users costs one API call. */
export const once = (k, fn) => { if (inflight.has(k)) return inflight.get(k); const p = fn().finally(() => inflight.delete(k)); inflight.set(k, p); return p; };
export const size = () => store.size;
