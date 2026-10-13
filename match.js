/* Cross-store product matching.
 *
 * The frontend groups offers by identical title, so the same phone listed as
 *   Amazon:   "Apple iPhone 16 Pro 128 GB: 5G Mobile Phone with Camera Control ..."
 *   Flipkart: "Apple iPhone 16 Pro (Black Titanium, 128 GB)"
 * would show up as two unrelated products. We cluster them here and give every offer in a
 * cluster the same canonical title.
 *
 * A wrong merge (iPhone 16 vs 16 Plus) is worse than a missed one, so the rules are strict:
 * model numbers, storage sizes and variant words (pro, max, plus, ultra ...) must agree.
 */

const STOP = new Set([
  'with', 'for', 'and', 'the', 'of', 'in', 'new', 'latest', 'pack', 'combo', 'set', 'by', 'from', 'upto', 'free', 'buy',
  'online', 'india', 'mobile', 'phone', 'smartphone', 'smart', 'dual', 'sim', 'display', 'camera', 'battery', 'processor',
  'ram', 'storage', 'rom', 'color', 'colour', 'brand', 'model', 'a', 'an', 'to', 'on', 'at', 'as', 'or',
]);
const COLORS = new Set([
  'black', 'white', 'blue', 'red', 'green', 'grey', 'gray', 'silver', 'gold', 'pink', 'purple', 'yellow', 'orange', 'brown',
  'beige', 'titanium', 'natural', 'desert', 'midnight', 'starlight', 'ultramarine', 'teal', 'lavender', 'graphite', 'navy',
  'cream', 'violet', 'mint', 'coral', 'bronze', 'copper', 'rose', 'lilac', 'cyan', 'maroon', 'charcoal', 'ivory',
]);
const VARIANTS = new Set(['pro', 'max', 'plus', 'ultra', 'mini', 'lite', 'se', 'fe', 'air', 'neo', 'prime', 'turbo', 'edge', 'gt', 'xl']);
const STORAGE = /^\d+(gb|tb)$/;

export function prep(title) {
  const t = String(title || '')
    .toLowerCase()
    .replace(/(\d+(?:\.\d+)?)\s*(gb|tb|mb|mah|mp|hz|inch|inches|in|cm|mm|kg|ml|w|l)\b/g, '$1$2')
    .replace(/[″”"]/g, 'inch')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/(^|\s)\.+|\.+(\s|$)/g, ' ');
  const toks = t.split(/\s+/).filter((w) => w && !STOP.has(w) && !COLORS.has(w)).slice(0, 12);
  const set = new Set(toks);
  return {
    set,
    variants: new Set(toks.filter((w) => VARIANTS.has(w))),
    storage: new Set(toks.filter((w) => STORAGE.test(w))),
    nums: new Set(toks.filter((w) => /\d/.test(w) && !STORAGE.test(w))),
  };
}

const subsetEither = (a, b) => {
  if (!a.size || !b.size) return true;
  const [s, l] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of s) if (!l.has(x)) return false;
  return true;
};
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

export function similar(a, b) {
  if (!sameSet(a.variants, b.variants)) return false;
  if (!subsetEither(a.storage, b.storage)) return false;
  if (!subsetEither(a.nums, b.nums)) return false;
  let inter = 0;
  for (const x of a.set) if (b.set.has(x)) inter++;
  const min = Math.min(a.set.size, b.set.size);
  return min > 0 && inter >= 2 && inter / min >= 0.75;
}

/* Trim marketing tails: "Apple iPhone 16 Pro 128 GB: 5G Mobile Phone with ..." -> "Apple iPhone 16 Pro 128 GB" */
export function shortTitle(title) {
  let t = String(title || '').replace(/\s+/g, ' ').trim();
  const cut = t.search(/ \| |: | – | — /);
  if (cut >= 15) t = t.slice(0, cut);
  if (t.length > 100) {
    t = t.slice(0, 100);
    t = t.slice(0, t.lastIndexOf(' ') > 40 ? t.lastIndexOf(' ') : 100).replace(/[,(\-\s]+$/, '');
  }
  return t;
}

export function mergeOffers(offers) {
  const clusters = [];
  for (const o of offers) {
    const p = prep(o.title);
    let c = clusters.find((x) => similar(x.rep, p));
    if (!c) { c = { rep: p, offers: [] }; clusters.push(c); }
    c.offers.push(o);
  }
  const out = [];
  for (const c of clusters) {
    const titles = c.offers.map((o) => shortTitle(o.title)).sort((a, b) => a.length - b.length);
    const canonical = titles.find((t) => t.split(' ').length >= 3) || titles[0];
    /* one offer per store: keep the cheapest variant */
    const byStore = new Map();
    for (const o of c.offers) {
      const cur = byStore.get(o.store);
      if (!cur || o.price < cur.price) byStore.set(o.store, o);
    }
    for (const o of byStore.values()) out.push({ ...o, title: canonical });
  }
  return out;
}
