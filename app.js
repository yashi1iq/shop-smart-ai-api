import http from 'node:http';
import crypto from 'node:crypto';
import { config } from './config.js';
import { cleanQuery } from './util.js';
import { searchOffers, SearchError } from './search.js';
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
  const a = Buffer.from(Str
