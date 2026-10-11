// Google Shopping through ScrapingBee: prices from Flipkart, Croma, Myntra and other Indian stores.
const num = (v) => {
  if (typeof v === 'number') return v > 0 ? v : null;
  const m = String(v ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) || null : null;
};
const web = (u) => (/^https?:\/\//.test(u || '') ? u : null);

export async function searchGoogleShopping(q) {
  const key = process.env.SCRAPINGBEE_API_KEY;
  if (!key) throw new Error('SCRAPINGBEE_API_KEY not set');
  const u = new URL('https://app.scrapingbee.com/api/v1/store/google');
  u.search = new URLSearchParams({
    api_key: key,
    search: q,
    search_type: 'shopping',
    country_code: 'in',
    sort_by: 'relevance',
    light_request: process.env.GOOGLE_LIGHT_REQUEST || 'false'
  });
  const res = await fetch(u, { signal: AbortSignal.timeout(40000) });
  if (!res.ok) throw new Error(`ScrapingBee Google responded ${res.status}`);
  const { organic_results = [] } = await res.json();

  const out = [];
  for (const p of organic_results) {
    const store = typeof p.merchant === 'string' ? p.merchant : p.merchant?.name || p.source;
    const price = num(p.price ?? p.price_str);
    if (!p.title || !price || !store || /amazon/i.test(store)) continue; // Amazon already comes from its own source
    const mrp = num(p.old_price ?? p.price_strikethrough);
    out.push({
      key: `gs:${store}:${p.product_id || p.title}`.toLowerCase().slice(0, 100),
      store,
      title: p.title,
      price,
      mrp: mrp && mrp > price ? mrp : null,
      discount: mrp && mrp > price ? Math.round((1 - price / mrp) * 100) : null,
      rating: num(p.review ?? p.rating),
      reviews: num(p.review_count ?? p.reviews),
      image: web(p.thumbnail) || web(p.image) || web(p.image_url),
      url: web(p.url) || web(p.link)
    });
    if (out.length >= 20) break;
  }
  return out;
}
