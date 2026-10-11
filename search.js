import { cfg, STORES, storesFor } from './config.js';
import * as cache from './cache.js';
import { Skip, withTimeout, relevant } from './util.js';
import { amazon } from './amazon.js';
import { flipkart } from './flipkart.js';
import { scrapeStore } from './scrapingbee.js';
import { serpapi } from './serpapi.js';

const API = { amz: amazon, flk: flipkart };

/* Optional: wrap non-Amazon/Flipkart store links with Cuelinks so clicks can earn commission. */
const affiliate = o => {
  if (o.storeId === 'amz' && STORES.amz.type === 'scrape' && o.url && cfg.amazon.partnerTag) {   // scraped Amazon links carry your Associates tag
    try { const u = new URL(o.url); u.searchParams.set('tag', cfg.amazon.partnerTag); return { ...o, url: u.href }; } catch { return o; }
  }
  if (!cfg.cuelinksCid || !STORES[o.storeId] || STORES[o.storeId].type !== 'scrape' || !o.url) return o;
  return { ...o, url: `https://linksredirect.com/?cid=${encodeURIComponent(cfg.cuelinksCid)}&source=linkkit&url=${encodeURIComponent(o.url)}` };
};

export async function search(q, category) {
  const key = `s|${category || 'all'}|${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return { ...hit, meta: { ...hit.meta, cached: true } };
  return cache.once(key, async () => {
    const ids = storesFor(category);
    const apiIds = ids.filter(i => STORES[i].type === 'api');
    const scrapeIds = [...ids.filter(i => i === 'amz' || i === 'flk'), ...ids.filter(i => i !== 'amz' && i !== 'flk')]   // Amazon/Flipkart first when scraped
      .filter(i => STORES[i].type === 'scrape').slice(0, cfg.maxScrapeStores);
    const sources = {};
    const run = async (id, fn) => {
      const t = Date.now();
      try {
        const r = await withTimeout(fn(), cfg.searchTimeoutMs, id);
        sources[id] = { status: r.length ? 'ok' : 'empty', count: r.length, ms: Date.now() - t };
        return r;
      } catch (e) {
        sources[id] = e instanceof Skip ? { status: 'skipped', reason: e.message } : { status: 'error', error: String(e.message).slice(0, 140) };
        return [];
      }
    };
    const parts = await Promise.all([
      ...apiIds.map(i => run(i, () => API[i](q))),
      ...scrapeIds.map(i => run(i, async () => (await scrapeStore(i, q)).filter(o => relevant(o.title, q))))
    ]);
    let offers = parts.flat();

    if (offers.length < cfg.minOffers) {                       // broaden with Google Shopping
      const have = new Set(Object.entries(sources).filter(([, s]) => s.status === 'ok').map(([k]) => k));
      const g = (await run('google', () => serpapi(q))).filter(o => {
        const s = o.store.toLowerCase();
        return !((s.includes('amazon') && have.has('amz')) || (s.includes('flipkart') && have.has('flk')));
      });
      offers = offers.concat(g);
    }

    const seen = new Set();
    offers = offers.filter(o => { const k = `${o.storeId}|${o.title.toLowerCase()}|${o.price}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => a.price - b.price).slice(0, 60).map(affiliate);

    const result = { query: q, category: category || null, count: offers.length, offers, meta: { sources, cached: false, generatedAt: new Date().toISOString() } };
    cache.set(key, result, offers.length ? cfg.searchTtlMs : 120000);   // retry empty searches sooner
    return result;
  });
}
