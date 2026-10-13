import { cfg } from './config.js';
import { Skip, fetchJson, offer } from './util.js';
import { spend } from './budget.js';

/* Google Shopping via SerpApi: broad fallback for stores nothing else covers. 1 call = 1 search. */
export async function serpapi(q) {
  if (!cfg.serpapi.key) throw new Skip('SERPAPI_API_KEY not set');
  if (!spend('serpapi', 1, cfg.serpapi.dailyCalls)) throw new Skip('daily SerpApi cap reached');
  const u = new URL(cfg.serpapi.base);
  Object.entries({ engine: 'google_shopping', q, gl: 'in', hl: 'en', google_domain: 'google.co.in', api_key: cfg.serpapi.key }).forEach(([k, v]) => u.searchParams.set(k, v));
  const j = await fetchJson(u.href, {}, 25000);
  return (j.shopping_results || []).map(r => offer({
    title: r.title, price: r.extracted_price ?? r.price, mrp: r.extracted_old_price ?? r.old_price,
    rating: r.rating, reviews: r.reviews, image: r.thumbnail, url: r.product_link || r.link,
    delivery: r.delivery, store: r.source || 'Google Shopping',
    storeId: 'gs-' + String(r.source || 'google').toLowerCase().replace(/[^a-z0-9]+/g, '')
  })).filter(Boolean);
}
