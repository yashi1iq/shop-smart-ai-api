import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* Tiny .env loader for local development (Railway injects real env vars). */
function loadEnvFile() {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (/^(".*"|'.*')$/.test(val)) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

const env = process.env;
const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const bool = (v, d) => (v == null || v === '' ? d : /^(1|true|yes|on)$/i.test(String(v)));
const list = (v, d) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : d);

export const config = {
  port: int(env.PORT, 3000),

  /* ZenRows */
  zenrowsKey: env.ZENROWS_API_KEY || '',
  zenrowsEndpoint: env.ZENROWS_ENDPOINT || 'https://api.zenrows.com/v1/',
  proxyCountry: env.ZENROWS_PROXY_COUNTRY || 'in',
  /* Per-attempt timeout and the total time one search may take. The frontend gives up after 45 s. */
  zenrowsTimeoutMs: int(env.ZENROWS_TIMEOUT_MS, 30000),
  searchBudgetMs: int(env.SEARCH_BUDGET_MS, 38000),
  /* Hard cap on ZenRows requests per UTC day. Protects your credits. 0 = unlimited. */
  maxDailyRequests: int(env.MAX_ZENROWS_REQUESTS_PER_DAY, 1500),

  /* Which stores to query, in order. Available: amazon, flipkart */
  stores: list(env.STORES, ['amazon', 'flipkart']),
  resultsPerStore: int(env.RESULTS_PER_STORE, 10),

  /* Caching (every cache miss costs ZenRows credits) */
  cacheTtlMs: int(env.CACHE_TTL_MINUTES, 30) * 60_000,
  partialCacheTtlMs: int(env.PARTIAL_CACHE_TTL_MINUTES, 5) * 60_000,
  youtubeTtlMs: int(env.YOUTUBE_CACHE_HOURS, 24) * 3_600_000,
  cacheMaxEntries: int(env.CACHE_MAX_ENTRIES, 500),

  /* YouTube: the official API is preferred when a key is set; otherwise ZenRows scrapes results. */
  youtubeKey: env.YOUTUBE_API_KEY || '',

  /* HTTP */
  corsOrigins: list(env.CORS_ORIGINS, ['*']),
  rateLimitPerMin: int(env.RATE_LIMIT_PER_MIN, 60),
  trustProxyHops: int(env.TRUST_PROXY_HOPS, 1),
  adminToken: env.ADMIN_TOKEN || '',
  debug: bool(env.DEBUG, false),
};

/* Per-store ZenRows switches, overridable from env (e.g. ZENROWS_JS_FLIPKART=false). */
export function storeFlags(id, defaults) {
  const up = id.toUpperCase();
  return {
    js: bool(env[`ZENROWS_JS_${up}`], defaults.js),
    premium: bool(env[`ZENROWS_PREMIUM_${up}`], defaults.premium),
  };
}
