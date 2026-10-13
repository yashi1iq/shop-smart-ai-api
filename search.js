import { config } from './config.js';
import { TTLCache, createMemo } from './cache.js';
import { zrFetch } from './zenrows.js';
import { enabledStores } from './stores/index.js';
import { mergeOffers } from './match.js';

const memo = createMemo(new TTLCache(config.cacheMaxEntries));
const keyOf = (q) => 'search:' + q.toLowerCase().replace(/\s+/g, ' ').trim();

export class SearchError extends Error {
  constructor(message, status = 502, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Scrape every enabled store in parallel and merge into comparable offers. */
export async function searchOffers(q) {
  const { value, cached } = await memo(keyOf(q), async () => {
    const result = await scrapeAll(q);
    const partial = Object.values(result.meta.stores).some((s) => !s.ok);
    return { value: result, ttlMs: partial ? config.partialCacheTtlMs : config.cacheTtlMs };
  });
  return { ...value, meta: { ...value.meta, cached } };
}

async function scrapeAll(q) {
  const stores = enabledStores();
  if (!stores.length) throw new SearchError('No stores are enabled. Check the STORES setting.', 500);
  const deadline = Date.now() + config.searchBudgetMs;

  const settled = await Promise.allSettled(
    stores.map(async (s) => {
      const f = s.flags();
      const html = await zrFetch(s.searchUrl(q), { ...f, waitFor: s.waitFor, deadline });
      return s.parse(html, { limit: config.resultsPerStore });
    }),
  );

  const meta = { stores: {}, fetchedAt: new Date().toISOString() };
  const raw = [];
  settled.forEach((r, i) => {
    const id = stores[i].id;
    if (r.status === 'fulfilled') {
      meta.stores[id] = { ok: true, count: r.value.length };
      raw.push(...r.value);
    } else {
      meta.stores[id] = { ok: false, error: String(r.reason?.message || r.reason).slice(0, 200), code: r.reason?.code };
    }
  });

  const okStores = Object.values(meta.stores).filter((s) => s.ok);
  if (!okStores.length) {
    const first = Object.values(meta.stores)[0];
    const quota = Object.values(meta.stores).find((s) => s.code === 'daily_limit');
    throw new SearchError(
      quota ? quota.error : `Every store failed. ${first?.error || ''}`.trim(),
      quota ? 429 : 502,
      meta,
    );
  }
  if (!raw.length) meta.warning = 'The stores answered but no products could be read. The page layout may have changed or the query matched nothing.';

  return { query: q, count: 0, offers: [], ...finish(raw), meta };
}

function finish(raw) {
  const offers = mergeOffers(raw);
  return { offers, count: offers.length };
}
