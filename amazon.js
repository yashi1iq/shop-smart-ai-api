// Amazon.in search through ScrapingBee's dedicated Amazon API (returns structured JSON).
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function searchAmazon(q) {
  const key = process.env.SCRAPINGBEE_API_KEY;
  if (!key) throw new Error('SCRAPINGBEE_API_KEY not set');
  const u = new URL('https://app.scrapingbee.com/api/v1/amazon/search');
  u.search = new URLSearchParams({ api_key: key, query: q, domain: 'in' });
  const res = await fetch(u, { signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`ScrapingBee responded ${res.status}`);
  const { products = [] } = await res.json();

  const tag = process.env.AMAZON_AFFILIATE_TAG;
  const seen = new Set();
  const out = [];
  for (const p of products) {
    const price = num(p.price);
    if (!p.asin || !p.title || !price || p.is_sponsored || seen.has(p.asin)) continue; // zero sponsored, no dupes
    seen.add(p.asin);
    const mrp = num(p.price_strikethrough);
    out.push({
      key: `amazon:${p.asin}`,
      store: 'Amazon',
      title: p.title,
      price,
      mrp: mrp && mrp > price ? mrp : null,
      discount: mrp && mrp > price ? Math.round((1 - price / mrp) * 100) : null,
      rating: num(p.rating),
      reviews: num(p.reviews_count),
      image: p.url_image || p.image || p.thumbnail || null,
      url: `https://www.amazon.in/dp/${p.asin}${tag ? `?tag=${tag}` : ''}`
    });
  }
  return out;
}
