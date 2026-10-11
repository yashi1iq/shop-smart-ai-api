import { cfg, STORES } from './config.js';
import { Skip, absUrl, offer, num } from './util.js';
import { spend, refund } from './budget.js';

/* Credits per request (ScrapingBee docs/reviews): no-JS 1, JS 5, premium no-JS 10, premium+JS 25. */
export const credits = (render, premium) => premium ? (render ? 25 : 10) : (render ? 5 : 1);

/* ---- Selector-free harvesting: reads embedded JSON (ld+json, __NEXT_DATA__) and finds product-like objects. ---- */
const first = (...v) => { for (const x of v) if (x != null && x !== '') return x; return null; };
function imgOf(x) { const i = first(x.image, x.imageUrl, x.imageURL, x.thumbnail, x.thumbnailUrl, x.img, x.primaryImage); return Array.isArray(i) ? imgOf({ image: i[0] }) : (i && typeof i === 'object' ? first(i.url, i.src, i.contentUrl) : i); }
function toOffer(x, base) {
  const title = first(x.name, x.title, x.productName, x.product_name, x.displayName);
  if (typeof title !== 'string' || title.length < 4) return null;
  const off = Array.isArray(x.offers) ? x.offers[0] : x.offers;
  const price = [x.sellingPrice, x.salePrice, x.finalPrice, x.offerPrice, x.specialPrice, x.discountedPrice, x.price, off && (off.price ?? off.lowPrice)].map(num).find(v => v != null && v > 0);
  if (!price) return null;
  const url = absUrl(first(x.url, x.link, x.productUrl, x.pdpUrl, x.productLink, off && off.url), base);
  const image = absUrl(imgOf(x), base);
  if (!url && !image) return null;                       // noise filter: real products have a link or picture
  const ar = x.aggregateRating || {};
  return {
    title, price, mrp: first(x.mrp, x.originalPrice, x.listPrice, x.strikePrice, x.maxPrice, off && off.highPrice),
    brand: typeof x.brand === 'object' ? x.brand?.name : x.brand, url, image,
    rating: first(ar.ratingValue, x.rating, x.averageRating), reviews: first(ar.reviewCount, ar.ratingCount, x.reviewCount, x.ratingCount),
    inStock: off?.availability ? /InStock/i.test(String(off.availability)) : (typeof x.inStock === 'boolean' ? x.inStock : null)
  };
}
export function harvest(html, base) {
  const re = /<script[^>]*(?:type=["']application\/ld\+json["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/gi;
  const blobs = []; let m;
  while ((m = re.exec(html)) && blobs.length < 12) { try { blobs.push(JSON.parse(m[1])); } catch { /* skip */ } }
  const out = [], seen = new Set(); let nodes = 0;
  const walk = (x, d) => {
    if (!x || typeof x !== 'object' || d > 14 || ++nodes > 60000 || out.length >= 40) return;
    if (!Array.isArray(x)) { const o = toOffer(x, base); if (o) { const k = o.title + '|' + o.price; if (!seen.has(k)) { seen.add(k); out.push(o); } } }
    for (const v of Array.isArray(x) ? x : Object.values(x)) walk(v, d + 1);
  };
  blobs.forEach(b => walk(b, 0));
  return out;
}

/* ---- Optional per-store CSS rules (STORE_RULES_JSON) sent to ScrapingBee's extract_rules. ---- */
const rulesFor = id => {
  const r = cfg.storeRules[id]; if (!r || !r.item || !r.fields) return null;
  return { items: { selector: r.item, type: 'list', output: r.fields } };
};

async function call(url, { render, premium, rules }) {
  const p = new URLSearchParams({ api_key: cfg.scrapingbee.key, url, render_js: String(render), country_code: 'in', premium_proxy: String(!!premium) });
  if (rules) p.set('extract_rules', JSON.stringify(rules));
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 55000);
  try {
    const r = await fetch(cfg.scrapingbee.base + '?' + p, { signal: ctl.signal });
    if (!r.ok) throw new Error(`ScrapingBee HTTP ${r.status}`);
    return rules ? await r.json() : await r.text();
  } finally { clearTimeout(t); }
}

export async function scrapeStore(id, q) {
  const s = STORES[id];
  if (!cfg.scrapingbee.key) throw new Skip('SCRAPINGBEE_API_KEY not set');
  const pageUrl = s.url(q), rules = rulesFor(id);
  const attempts = rules ? [{ render: false, premium: false, rules }]
    : [{ render: false, premium: false }, { render: true, premium: !!s.hard }];
  let lastErr = null;
  for (const a of attempts) {
    const c = credits(a.render, a.premium);
    if (!spend('scrapingbee', c, cfg.scrapingbee.dailyCredits)) throw new Skip('daily ScrapingBee credit cap reached');
    try {
      const body = await call(pageUrl, a);
      let list;
      if (a.rules) list = (body.items || []).map(r => ({ ...r, url: absUrl(r.url, s.base), image: absUrl(r.image, s.base) }));
      else list = harvest(body, s.base);
      const out = list.map(o => offer({ ...o, store: s.name, storeId: id, url: o.url || pageUrl })).filter(Boolean);
      if (out.length) return out;
    } catch (e) { refund('scrapingbee', c); lastErr = e; }   // failed requests are not billed
  }
  if (lastErr) throw lastErr;
  return [];
}
