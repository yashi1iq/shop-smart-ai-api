const m = new Map();
export async function cached(key, ttlMs, fn, force = false) {
  const hit = m.get(key);
  if (!force && hit && hit.exp > Date.now()) return hit.val;
  const val = await fn();
  m.set(key, { val, exp: Date.now() + ttlMs });
  if (m.size > 500) m.delete(m.keys().next().value);
  return val;
}
