// adapters/scrapedo.js  (replaces the SerpApi adapter)
// Needs Node 18+ (built-in fetch). Env var: SCRAPEDO_TOKEN
// NOTE: every Scrape.do Google Shopping call costs 10 credits, so the cache below is important.

const TOKEN = process.env.SCRAPEDO_TOKEN;
const TTL_MS = Number(process.env.CACHE_HOURS || 24) * 3600 * 1000; // cache time
const MAX_CACHE = 500;

const cache = new Map();    // key -> { at, data }
const inflight = new Map(); // key -> Promise (same query at the same time = one call)

function key(q, cat) {
  return (q || '').trim().toLowerCase() + '|' + (cat || '');
}

function mapItem(r, i) {
  const price = typeof r.extracted_price === 'number' ? r.extracted_price : null;
  const mrp = typeof r.extracted_old_price === 'number' ? r.extracted_old_price : null;
  const discount = price != null && mrp && mrp > price ? Math.round((1 - price / mrp) * 100) : null;
  return {
    id: String(r.catalog_id || r.product_id || i),
    title: r.title || '',
    store: r.source || 'Store',
    price,
    mrp: mrp && price != null && mrp > price ? mrp : null,
    discount,
    currency: 'INR',
    rating: typeof r.rating === 'number' ? r.rating : null,
    reviews: typeof r.reviews === 'number' ? r.reviews : null,
    delivery: r.delivery || null,
    image: r.thumbnail || null,
    url: r.product_link || null, // Google Shopping page for this product
  };
}

async function callScrapeDo(q) {
  if (!TOKEN) {
    const e = new Error('SCRAPEDO_TOKEN is not set');
    e.status = 500;
    throw e;
  }
  const params = new URLSearchParams({
    token: TOKEN,
    q,
    gl: 'in',
    hl: 'en',
    google_domain: 'google.co.in',
  });
  const res = await fetch('https://api.scrape.do/plugin/google/shopping?' + params, {
    signal: AbortSignal.timeout(25000),
  });
  let j = null;
  try { j = await res.json(); } catch (_) {}
  if (!res.ok) {
    const e = new Error((j && (j.message || j.error)) || 'Scrape.do error ' + res.status);
    e.status = res.status;
    throw e;
  }
  let list = (j && j.shopping_results) || [];
  // Scrape.do says an unexpected empty list is transient: retry once
  if (!list.length) {
    const res2 = await fetch('https://api.scrape.do/plugin/google/shopping?' + params);
    if (res2.ok) {
      const j2 = await res2.json();
      list = (j2 && j2.shopping_results) || [];
    }
  }
  return list.map(mapItem).filter((o) => o.title && o.price != null);
}

async function search(q, cat) {
  const k = key(q, cat);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL_MS) return { offers: hit.data, cached: true };
  if (inflight.has(k)) return { offers: await inflight.get(k), cached: false };

  const p = callScrapeDo(q)
    .then((data) => {
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
      cache.set(k, { at: Date.now(), data });
      return data;
    })
    .finally(() => inflight.delete(k));
  inflight.set(k, p);
  return { offers: await p, cached: false };
}

module.exports = { search };

/* ---------------- in server.js, use it like this ----------------

const scrapedo = require('./adapters/scrapedo');

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || req.query.query || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });
  try {
    const { offers, cached } = await scrapedo.search(q, req.query.category);
    res.json({ query: q, cached, count: offers.length, offers });
  } catch (e) {
    console.error('search failed:', e.message);
    res.status(e.status === 429 ? 429 : 502).json({ error: e.message });
  }
});

// health check: replace the serpapiConfigured field with
//   scrapedoConfigured: Boolean(process.env.SCRAPEDO_TOKEN)

------------------------------------------------------------------ */
