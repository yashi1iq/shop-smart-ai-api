import http from 'node:http';
import crypto from 'node:crypto';
import { config } from './config.js';
import { cleanQuery } from './util.js';
import { searchOffers, SearchError } from './search.js';
import { youtubeReviews } from './youtube.js';
import { requestsToday, zrFetch, ZenRowsError } from './zenrows.js';
import { REGISTRY, enabledStores } from './stores/index.js';

/* The frontend's category ids. Unknown values are ignored. */
const CATEGORIES = new Set([
  'electronics', 'beauty', 'fashion', 'footwear', 'home', 'furniture', 'computers', 'cameras', 'gaming', 'tv', 'mobileacc',
  'watches', 'jewellery', 'toys', 'sports', 'auto', 'pets', 'books', 'grocery', 'health', 'travel', 'tools', 'garden', 'gifts',
]);

/* ---------- helpers ---------- */
function corsHeaders(req) {
  const origin = req.headers.origin;
  const any = config.corsOrigins.includes('*');
  const h = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (any) h['Access-Control-Allow-Origin'] = '*';
  else if (origin && config.corsOrigins.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function send(req, res, status, body, extra = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...corsHeaders(req),
    ...extra,
  });
  res.end(payload);
}

/* Fixed-window rate limit per client IP. Every cache miss costs ZenRows credits, so this matters. */
const hits = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
}, 60_000).unref();

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  /* The right-most entries are added by our own proxies; the left-most can be forged by the client. */
  const hop = xff[xff.length - config.trustProxyHops];
  return hop || req.socket.remoteAddress || 'unknown';
}
function limited(req) {
  if (config.rateLimitPerMin <= 0) return null;
  const ip = clientIp(req), now = Date.now();
  let e = hits.get(ip);
  if (!e || e.reset <= now) { e = { n: 0, reset: now + 60_000 }; hits.set(ip, e); }
  e.n++;
  return e.n > config.rateLimitPerMin ? Math.ceil((e.reset - now) / 1000) : null;
}

const tokenOk = (given) => {
  if (!config.adminToken || !given) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(config.adminToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/* ---------- routes ---------- */
async function route(req, res, url) {
  const p = url.pathname.replace(/\/+$/, '') || '/';

  if (p === '/') {
    return send(req, res, 200, {
      name: 'ShopSmart AI backend',
      status: 'ok',
      endpoints: ['GET /api/search?q=&category=', 'GET /api/youtube-reviews?q=', 'GET /health'],
    });
  }

  if (p === '/health') {
    return send(req, res, 200, {
      ok: true,
      zenrowsConfigured: Boolean(config.zenrowsKey),
      stores: enabledStores().map((s) => s.id),
      youtube: config.youtubeKey ? 'youtube-api' : 'zenrows',
      zenrowsRequests: requestsToday(),
    });
  }

  if (p === '/api/search') {
    const q = cleanQuery(url.searchParams.get('q') ?? url.searchParams.get('query'));
    if (q.length < 2) return send(req, res, 400, { error: 'Missing search text. Use ?q=your+search' });
    if (!config.zenrowsKey) return send(req, res, 503, { error: 'ZENROWS_API_KEY is not set on the server.' });
    const cat = url.searchParams.get('category');
    try {
      const out = await searchOffers(q);
      return send(req, res, 200, { ...out, category: CATEGORIES.has(cat) ? cat : null });
    } catch (e) {
      if (e instanceof SearchError) return send(req, res, e.status, { error: e.message, meta: e.details });
      if (e instanceof ZenRowsError) return send(req, res, e.status, { error: e.message });
      throw e;
    }
  }

  if (p === '/api/youtube-reviews') {
    const q = cleanQuery(url.searchParams.get('q'));
    if (q.length < 2) return send(req, res, 400, { error: 'Missing search text. Use ?q=product+name' });
    try {
      return send(req, res, 200, await youtubeReviews(q));
    } catch (e) {
      /* The frontend treats any failure here as "no videos", so keep it quiet and cheap. */
      return send(req, res, 200, { videos: [], error: String(e.message || e).slice(0, 160) });
    }
  }

  /* Admin only: fetch one store page and show what the parser sees. Use it when a store changes its layout. */
  if (p === '/api/debug/scrape') {
    if (!config.adminToken) return send(req, res, 404, { error: 'Not found' });
    if (!tokenOk(req.headers['x-admin-token'])) return send(req, res, 401, { error: 'Bad or missing X-Admin-Token header' });
    const store = REGISTRY[url.searchParams.get('store')];
    const q = cleanQuery(url.searchParams.get('q'));
    if (!store || q.length < 2) return send(req, res, 400, { error: `Use ?store=${Object.keys(REGISTRY).join('|')}&q=...` });
    const html = await zrFetch(store.searchUrl(q), { ...store.flags(), waitFor: store.waitFor });
    let offers = [], parseError = null;
    try { offers = store.parse(html, { limit: 5 }); } catch (e) { parseError = e.message; }
    return send(req, res, 200, {
      store: store.id, htmlLength: html.length, parseError, parsed: offers.length, offers,
      htmlStart: html.slice(0, 600).replace(/\s+/g, ' '),
    });
  }

  return send(req, res, 404, { error: 'Not found' });
}

export function createApp() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405, { error: 'Method not allowed' });
      if (url.pathname !== '/health' && url.pathname !== '/') {
        const wait = limited(req);
        if (wait) return send(req, res, 429, { error: 'Too many requests. Slow down.' }, { 'Retry-After': String(wait) });
      }
      await route(req, res, url);
    } catch (e) {
      if (config.debug) console.error(e);
      else console.error('Unhandled error:', e && e.name, e && e.message);
      if (!res.headersSent) send(req, res, 500, { error: 'Internal server error' });
      else res.end();
    }
  });
}
