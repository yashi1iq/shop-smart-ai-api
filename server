import http from 'node:http';
import { cfg, STORES, CATEGORY_STORES } from './config.js';
import * as cache from './cache.js';
import { snapshot } from './budget.js';
import { search } from './search.js';
import { scrapeStore, credits } from './scrapingbee.js';
import { youtubeReviews } from './youtube.js';
import { Skip } from './util.js';

const send = (res, code, body) => {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': cfg.corsOrigin, 'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
};

/* Tiny per-IP limiter: 60 requests/minute. */
const hits = new Map();
const limited = ip => {
  const now = Date.now(), h = (hits.get(ip) || []).filter(t => now - t < 60000);
  h.push(now); hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return h.length > 60;
};
const admin = (req, u) => cfg.adminKey && (req.headers['x-admin-key'] === cfg.adminKey || u.searchParams.get('key') === cfg.adminKey);
const clean = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120);

const configured = () => ({
  amazon: !!(cfg.amazon.upstreamUrl || (cfg.amazon.clientId && cfg.amazon.clientSecret)),
  flipkart: !!(cfg.flipkart.id && cfg.flipkart.token), scrapingbee: !!cfg.scrapingbee.key,
  serpapi: !!cfg.serpapi.key, youtube: !!cfg.youtube.key, cuelinks: !!cfg.cuelinksCid
});

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    const u = new URL(req.url, 'http://x');
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    if (u.pathname === '/health') return send(res, 200, { ok: true, uptime: Math.round(process.uptime()) });
    if (limited(ip)) return send(res, 429, { error: 'Too many requests, slow down.' });

    if (u.pathname === '/api/search' || u.pathname === '/search') {
      const q = clean(u.searchParams.get('q') || u.searchParams.get('query'));
      if (!q) return send(res, 400, { error: 'Missing q' });
      const cat = /^[a-z]{2,20}$/.test(u.searchParams.get('category') || '') ? u.searchParams.get('category') : null;
      return send(res, 200, await search(q, cat));
    }

    if (u.pathname === '/api/youtube-reviews') {
      const q = clean(u.searchParams.get('q'));
      if (!q) return send(res, 400, { error: 'Missing q' });
      const key = 'yt|' + q.toLowerCase(), hit = cache.get(key);
      if (hit) return send(res, 200, { videos: hit, cached: true });
      try {
        const videos = await cache.once(key, () => youtubeReviews(q));
        cache.set(key, videos, videos.length ? cfg.ytTtlMs : 600000);
        return send(res, 200, { videos });
      } catch (e) {                                   // never break the page because YouTube is unavailable
        return send(res, 200, { videos: [], note: e instanceof Skip ? e.message : 'YouTube unavailable' });
      }
    }

    if (u.pathname.startsWith('/admin/')) {
      if (!admin(req, u)) return send(res, 401, { error: 'Admin key required' });
      if (u.pathname === '/admin/status') return send(res, 200, { configured: configured(), budgets: snapshot(), cacheEntries: cache.size(), stores: Object.keys(STORES).length, categories: Object.keys(CATEGORY_STORES).length });
      if (u.pathname === '/admin/probe') {   // test one store live: /admin/probe?store=snp&q=air fryer
        const id = u.searchParams.get('store'), q = clean(u.searchParams.get('q') || 'iphone');
        if (!STORES[id] || STORES[id].type !== 'scrape') return send(res, 400, { error: 'store must be one of: ' + Object.keys(STORES).filter(k => STORES[k].type === 'scrape').join(', ') });
        const t = Date.now();
        try { const offers = await scrapeStore(id, q); return send(res, 200, { store: id, count: offers.length, ms: Date.now() - t, creditsPerAttempt: { plain: credits(false, false), js: credits(true, false), premiumJs: credits(true, true) }, sample: offers.slice(0, 3) }); }
        catch (e) { return send(res, 200, { store: id, count: 0, error: e.message, skipped: e instanceof Skip }); }
      }
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('request failed:', e);
    send(res, 500, { error: 'Server error' });
  }
});

process.on('unhandledRejection', e => console.error('unhandledRejection', e));
server.listen(cfg.port, () => console.log(`ShopSmart AI backend listening on :${cfg.port}`, configured()));
