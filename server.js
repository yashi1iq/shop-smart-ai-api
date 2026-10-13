import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 3000);
const CACHE_TTL_MS = Math.max(0, Number(process.env.CACHE_TTL_SECONDS ?? 180)) * 1000;
const MAX_RESULTS = Math.min(40, Math.max(5, Number(process.env.MAX_RESULTS || 24)));
const cache = new Map();
const clean = (v, max = 180) => String(v ?? '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://shopsmart-ai.netlify.app,http://localhost:3000,http://127.0.0.1:3000').split(',').map(x => x.trim()).filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(cors({ origin(origin, cb) {
  if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
  return cb(new Error('Origin not allowed by CORS'));
}}));
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 60), standardHeaders: true, legacyHeaders: false }));

function cacheGet(key) {
  const v = cache.get(key);
  if (!v || Date.now() - v.at > CACHE_TTL_MS) { cache.delete(key); return null; }
  return v.value;
}
function cacheSet(key, value) {
  if (!CACHE_TTL_MS) return;
  if (cache.size >= 500) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
}
function safeUrl(raw, base = 'https://www.google.com') {
  if (!raw) return null;
  try {
    let u = new URL(raw, base);
    if (u.hostname === 'www.google.com' && u.pathname === '/url') {
      const target = u.searchParams.get('url') || u.searchParams.get('q');
      if (target) u = new URL(target);
    }
    return ['http:', 'https:'].includes(u.protocol) ? u.toString() : null;
  } catch { return null; }
}
function amazonAffiliate(raw) {
  const url = safeUrl(raw);
  const tag = clean(process.env.AMAZON_ASSOCIATE_TAG, 80);
  if (!url || !tag) return url;
  try {
    const u = new URL(url);
    if ((u.hostname === 'amazon.in' || u.hostname.endsWith('.amazon.in')) && !u.searchParams.has('tag')) u.searchParams.set('tag', tag);
    return u.toString();
  } catch { return url; }
}
function affiliateLink(raw) {
  const url = safeUrl(raw);
  if (!url) return null;
  const template = process.env.AWIN_TRACKING_TEMPLATE;
  if (template && /awin/i.test(new URL(url).hostname)) return template.replace('{url}', encodeURIComponent(url));
  return amazonAffiliate(url);
}
function parsePrice(text) {
  if (text == null) return null;
  const s = String(text).replace(/\u00a0/g, ' ').replace(/,/g, '').trim();
  const m = s.match(/(?:₹|Rs\.?\s*|INR\s*)\s*(\d+(?:\.\d{1,2})?)/i) || s.match(/(\d+(?:\.\d{1,2})?)\s*(?:₹|INR)/i);
  if (!m) return null;
  const n = Number(m[1]); return Number.isFinite(n) && n > 0 ? n : null;
}
function normalizeProduct(raw) {
  const title = clean(raw.title || raw.name, 240);
  const price = typeof raw.price === 'number' ? raw.price : parsePrice(raw.price);
  if (!title || !price) return null;
  const old = typeof raw.mrp === 'number' ? raw.mrp : parsePrice(raw.mrp);
  const store = clean(raw.store || raw.source || raw.merchant || 'Online store', 100);
  const url = affiliateLink(raw.url || raw.link);
  return {
    id: clean(raw.id || `${title}-${store}`, 220), title, name: title,
    brand: clean(raw.brand, 100) || null, store, source: store, merchant: store,
    price, mrp: old && old > price ? old : null,
    discount: old && old > price ? Math.round((old - price) / old * 100) : null,
    currency: 'INR', image: safeUrl(raw.image), thumbnail: safeUrl(raw.image),
    link: url, url, product_link: url,
    rating: Number.isFinite(Number(raw.rating)) && Number(raw.rating) > 0 ? Number(raw.rating) : null,
    reviews: Number.isFinite(Number(raw.reviews)) && Number(raw.reviews) > 0 ? Number(raw.reviews) : null,
    inStock: raw.inStock ?? null, delivery: clean(raw.delivery, 160) || null,
    specs: Array.isArray(raw.specs) ? raw.specs.slice(0, 12) : []
  };
}
function parseGoogleShopping(html) {
  const $ = cheerio.load(html);
  const found = [];
  const seen = new Set();
  const containers = $('div.sh-dgr__content, div.sh-dgr__grid-result, div[data-docid], div.sh-pr__product-results-grid > div, .sh-dlr__list-result, [data-attrid="Price"]')
    .toArray();
  for (const el of containers) {
    const card = $(el);
    const titleEl = card.find('h3, [role="heading"], .tAxDx, .sh-np__product-title').first();
    const title = clean(titleEl.text(), 240);
    if (!title) continue;
    const text = clean(card.text(), 1800);
    const priceText = card.find('[aria-label*="₹"], .a8Pemb, .kHxwFf, .e10twf, .T14wmb, [class*="price"]').toArray().map(x => $(x).attr('aria-label') || $(x).text()).join(' ');
    const price = parsePrice(priceText) || parsePrice(text);
    if (!price) continue;
    const linkEl = card.find('a[href]').filter((_, a) => {
      const href = $(a).attr('href') || '';
      return href && !/google\.(com|co\.in)\/(search|shopping|url)|#/.test(href);
    }).first();
    const rawHref = linkEl.attr('href') || titleEl.closest('a').attr('href') || '';
    const url = safeUrl(rawHref, 'https://www.google.com');
    const image = safeUrl(card.find('img').first().attr('src') || card.find('img').first().attr('data-src'), 'https://www.google.com');
    const store = clean(card.find('[class*="seller"], [class*="merchant"], .aULzUe, .IuHnof, .LbUacb').first().text(), 100) || clean(text.replace(title, '').match(/(?:Amazon\.in|Flipkart|Croma|Reliance Digital|Myntra|Meesho|Tata CLiQ|Vijay Sales)/i)?.[0] || 'Google Shopping result', 100);
    const mrpMatch = text.match(/(?:₹|Rs\.?\s*)([\d,]+(?:\.\d{1,2})?)/g) || [];
    const mrpValues = mrpMatch.map(parsePrice).filter(Boolean);
    const mrp = mrpValues.find(n => n > price) || null;
    const key = `${title.toLowerCase()}|${store.toLowerCase()}|${price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ title, price, mrp, store, url, image, rating: Number(card.find('[aria-label*="stars"], [aria-label*="out of 5"]').first().attr('aria-label')?.match(/[0-5](?:\.\d+)?/)?.[0]) || null });
  }
  // Structured data fallback helps when Google changes its card markup.
  if (!found.length) {
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).contents().text());
        const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
        for (const p of items) {
          if (!/Product/i.test(String(p['@type'] || ''))) continue;
          const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers || {};
          const product = normalizeProduct({ title: p.name, price: offer.price || offer.lowPrice, mrp: offer.highPrice, store: offer.seller?.name || 'Online store', url: offer.url || p.url, image: Array.isArray(p.image) ? p.image[0] : p.image, brand: p.brand?.name || p.brand });
          if (product) found.push(product);
        }
      } catch {}
    });
  }
  return found.map(normalizeProduct).filter(Boolean).slice(0, MAX_RESULTS);
}
async function zenrowsFetch(targetUrl, { jsRender = false } = {}) {
  const key = process.env.ZENROWS_API_KEY || process.env.ZENROWS_API_TOKEN;
  if (!key) { const e = new Error('ZENROWS_API_KEY is missing. Add your ZenRows API key in Railway Variables.'); e.status = 503; throw e; }
  const endpoint = process.env.ZENROWS_API_URL || 'https://api.zenrows.com/v1/';
  const params = new URLSearchParams({ apikey: key, url: targetUrl });
  if (jsRender || process.env.ZENROWS_JS_RENDER === 'true') params.set('js_render', 'true');
  if (process.env.ZENROWS_PREMIUM_PROXY === 'true') params.set('premium_proxy', 'true');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.PROVIDER_TIMEOUT_MS || 30000));
  try {
    const response = await fetch(`${endpoint}?${params.toString()}`, { signal: controller.signal, headers: { Accept: 'text/html,application/xhtml+xml' } });
    if (!response.ok) {
      const msg = (await response.text().catch(() => '')).slice(0, 300);
      const e = new Error(`ZenRows returned HTTP ${response.status}${msg ? `: ${msg.replace(/\s+/g, ' ')}` : ''}`);
      e.status = response.status === 429 ? 429 : response.status >= 400 && response.status < 500 ? 502 : 502;
      throw e;
    }
    return await response.text();
  } catch (err) {
    if (err.name === 'AbortError') { const e = new Error('ZenRows request timed out.'); e.status = 504; throw e; }
    throw err;
  } finally { clearTimeout(timer); }
}
async function searchProducts(query, category) {
  const fullQuery = clean([query, category].filter(Boolean).join(' '), 220);
  const target = new URL(process.env.ZENROWS_SEARCH_URL || 'https://www.google.com/search');
  target.searchParams.set('tbm', 'shop');
  target.searchParams.set('q', fullQuery);
  target.searchParams.set('gl', process.env.DEFAULT_COUNTRY || 'in');
  target.searchParams.set('hl', process.env.DEFAULT_LANGUAGE || 'en');
  target.searchParams.set('num', String(Math.min(40, MAX_RESULTS)));
  const html = await zenrowsFetch(target.toString(), { jsRender: process.env.ZENROWS_JS_RENDER === 'true' });
  return parseGoogleShopping(html);
}
function parseYoutube(html, query) {
  const $ = cheerio.load(html);
  const videos = [];
  $('ytd-video-renderer, ytd-rich-item-renderer, .yt-lockup-view-model, a#video-title').each((_, el) => {
    const node = $(el);
    const anchor = node.is('a#video-title') ? node : node.find('a#video-title, a[href*="/watch?v="], a.yt-lockup-view-model__title').first();
    const href = anchor.attr('href') || '';
    const title = clean(anchor.attr('title') || anchor.text() || node.find('#video-title').text(), 240);
    const id = href.match(/[?&]v=([\w-]{6,})/)?.[1] || href.match(/youtu\.be\/([\w-]{6,})/)?.[1];
    if (!id || !title || videos.some(v => v.id === id)) return;
    const image = node.find('img').first().attr('src') || node.find('img').first().attr('data-thumb') || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const channel = clean(node.find('#channel-name, .yt-content-metadata-view-model__metadata-text, .ytd-channel-name').first().text(), 100);
    videos.push({ id, title, url: `https://www.youtube.com/watch?v=${id}`, thumbnail: safeUrl(image, 'https://www.youtube.com'), channel: channel || 'YouTube', query });
  });
  return videos.slice(0, 8);
}

app.get('/', (_req, res) => res.json({ name: 'ShopSmart AI API', status: 'ok', endpoints: ['/health', '/api/search?q=phone', '/api/youtube-reviews?q=phone'] }));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'shopsmart-ai-api', timestamp: new Date().toISOString(), providers: { zenrowsConfigured: Boolean(process.env.ZENROWS_API_KEY || process.env.ZENROWS_API_TOKEN), youtubeReviews: Boolean(process.env.ZENROWS_API_KEY || process.env.ZENROWS_API_TOKEN) } }));
app.get('/api/search', handleSearch);
app.get('/search', handleSearch);
app.get('/api/products/search', handleSearch);
async function handleSearch(req, res) {
  const q = clean(req.query.q || req.query.query || req.query.search, 180);
  const category = clean(req.query.category, 60);
  if (q.length < 2) return res.status(400).json({ success: false, error: 'Missing or too-short query. Use ?q=phone' });
  const key = `products:${q.toLowerCase()}:${category.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return res.json({ success: true, query: q, category: category || null, cached: true, offers: cached, products: cached, results: cached });
  try {
    const products = await searchProducts(q, category);
    cacheSet(key, products);
    return res.json({ success: true, query: q, category: category || null, cached: false, count: products.length, offers: products, products, results: products, message: products.length ? undefined : 'No products could be parsed from the shopping results. Try a more specific query or check the ZenRows response/target URL.' });
  } catch (err) {
    console.error('[search]', err.message);
    const status = err.status || 502;
    return res.status(status).json({ success: false, error: status === 503 ? err.message : 'Product search failed. Check ZenRows API key, quota, and target URL.', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
}
app.get('/api/youtube-reviews', async (req, res) => {
  const q = clean(req.query.q || req.query.query, 180);
  if (q.length < 2) return res.status(400).json({ error: 'Use ?q=product name' });
  const key = `youtube:${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return res.json({ success: true, query: q, cached: true, videos: cached });
  try {
    const target = new URL(process.env.ZENROWS_YOUTUBE_URL || 'https://www.youtube.com/results');
    target.searchParams.set('search_query', `${q} review`);
    const html = await zenrowsFetch(target.toString(), { jsRender: process.env.ZENROWS_YOUTUBE_JS_RENDER === 'true' });
    const videos = parseYoutube(html, q);
    cacheSet(key, videos);
    return res.json({ success: true, query: q, cached: false, count: videos.length, videos });
  } catch (err) {
    console.error('[youtube-reviews]', err.message);
    return res.status(err.status || 502).json({ success: false, error: 'Could not retrieve YouTube reviews right now.' });
  }
});
app.use((err, _req, res, _next) => {
  if (err.message === 'Origin not allowed by CORS') return res.status(403).json({ success: false, error: err.message });
  console.error('[server]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});
app.listen(PORT, '0.0.0.0', () => console.log(`ShopSmart AI API listening on 0.0.0.0:${PORT}`));
