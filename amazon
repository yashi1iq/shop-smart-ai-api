import { cfg } from './config.js';
import { Skip, fetchJson, offer, num } from './util.js';

let tok = { v: null, exp: 0 };
async function token() {
  if (tok.v && tok.exp > Date.now() + 60000) return tok.v;
  const j = await fetchJson(cfg.amazon.tokenUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: cfg.amazon.clientId, client_secret: cfg.amazon.clientSecret, scope: 'creatorsapi::default' })
  });
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return tok.v;
}

/* Amazon Creators API (replaces the retired PA-API 5). Needs Associates approval + Creators API credentials. */
async function viaCreators(q) {
  const a = cfg.amazon;
  const j = await fetchJson(`${a.apiBase}/catalog/v1/searchItems`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', 'x-marketplace': a.marketplace },
    body: JSON.stringify({
      keywords: q, partnerTag: a.partnerTag, marketplace: a.marketplace, itemCount: 10,
      resources: ['images.primary.medium', 'itemInfo.title', 'itemInfo.byLineInfo', 'itemInfo.features',
        'offersV2.listings.price', 'offersV2.listings.availability', 'offersV2.listings.isBuyBoxWinner']
    })
  });
  return (j.searchResult?.items || []).map(it => {
    const ls = it.offersV2?.listings || [];
    const l = ls.find(x => x.isBuyBoxWinner) || ls[0];
    const p = l?.price;
    return offer({
      title: it.itemInfo?.title?.displayValue, brand: it.itemInfo?.byLineInfo?.brand?.displayValue,
      price: p?.money?.amount, mrp: p?.savingBasis?.money?.amount, discountPercent: p?.savings?.percentage,
      inStock: l ? l.availability?.type === 'IN_STOCK' : null,
      image: it.images?.primary?.medium?.url, url: it.detailPageURL,
      specs: it.itemInfo?.features?.displayValues, store: 'Amazon.in', storeId: 'amz'
    });
  });
}

/* Alternative: reuse your existing Amazon service (any JSON list with title/price/url/image fields). */
async function viaUpstream(q) {
  const u = new URL(cfg.amazon.upstreamUrl); u.searchParams.set('q', q);
  const j = await fetchJson(u.href, { headers: cfg.amazon.upstreamKey ? { Authorization: `Bearer ${cfg.amazon.upstreamKey}` } : {} });
  const list = Array.isArray(j) ? j : (j.offers || j.results || j.products || j.items || []);
  const pick = (o, ...k) => { for (const x of k) if (o[x] != null && o[x] !== '') return o[x]; return null; };
  return list.map(o => offer({
    title: pick(o, 'title', 'name'), brand: pick(o, 'brand'), price: num(pick(o, 'price', 'salePrice', 'currentPrice')),
    mrp: num(pick(o, 'mrp', 'listPrice', 'originalPrice')), rating: pick(o, 'rating'), reviews: pick(o, 'reviews', 'reviewCount'),
    inStock: typeof o.inStock === 'boolean' ? o.inStock : null, image: pick(o, 'image', 'imageUrl', 'thumbnail'),
    url: pick(o, 'url', 'link', 'detailPageURL'), store: 'Amazon.in', storeId: 'amz'
  }));
}

export async function amazon(q) {
  if (cfg.amazon.upstreamUrl) return (await viaUpstream(q)).filter(Boolean);
  if (!cfg.amazon.clientId || !cfg.amazon.clientSecret) throw new Skip('Amazon credentials not set');
  return (await viaCreators(q)).filter(Boolean);
}
