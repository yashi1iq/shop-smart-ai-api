export class Skip extends Error {}   // provider not configured / budget used: not an error

export const num = v => {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'object') { for (const k of ['value', 'amount', 'current', 'selling', 'price', 'lowPrice']) if (v[k] != null) { const n = num(v[k]); if (n != null) return n; } return null; }
  const m = String(v).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

export const absUrl = (u, base) => {
  if (!u || typeof u !== 'string') return null;
  try { const x = new URL(u.startsWith('//') ? 'https:' + u : u, base); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; }
};

/* One normalised offer in the exact shape the app reads. Returns null for unusable rows. */
export function offer(o) {
  const title = String(o.title || '').replace(/\s+/g, ' ').trim();
  const price = num(o.price);
  if (!title || title.length < 3 || price == null || price <= 0) return null;
  const mrp0 = num(o.mrp), mrp = mrp0 && mrp0 > price ? mrp0 : null;
  let rating = num(o.rating); if (rating != null && (rating <= 0 || rating > 5)) rating = null;
  const dp = mrp ? Math.round((mrp - price) / mrp * 100) : (num(o.discountPercent) || null);
  return {
    title: title.slice(0, 200), brand: o.brand || null, price: Math.round(price * 100) / 100, mrp,
    discountPercent: dp && dp > 0 && dp < 100 ? dp : null, currency: 'INR', rating,
    reviews: num(o.reviews), inStock: typeof o.inStock === 'boolean' ? o.inStock : null,
    store: o.store, storeId: o.storeId, delivery: o.delivery || null, image: o.image || null,
    url: o.url || null, specs: Array.isArray(o.specs) ? o.specs.filter(Boolean).map(s => String(s).slice(0, 80)).slice(0, 4) : []
  };
}

export const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timed out')), ms))]);

export async function fetchJson(url, opts = {}, ms = 20000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status} ${text.slice(0, 160)}`);
    try { return JSON.parse(text); } catch { throw new Error('reply was not JSON'); }
  } finally { clearTimeout(t); }
}

export const relevant = (title, q) => {
  const toks = String(q).toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 3);
  if (!toks.length) return true;
  const t = title.toLowerCase();
  return toks.some(k => t.includes(k));
};
