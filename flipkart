import { cfg } from './config.js';
import { Skip, fetchJson, offer, num } from './util.js';

const img = u => { if (!u) return null; const k = ['400x400', '275x275', '200x200', 'unknown']; for (const x of k) if (u[x]) return String(u[x]).replace(/^http:/, 'https:'); return Object.values(u)[0] || null; };

/* Flipkart Affiliate API: GET /1.0/search.json?query=&resultCount=  (headers Fk-Affiliate-Id / Fk-Affiliate-Token).
   Reads both the v1 shape (productBaseInfoV1) and the older one (productBaseInfo.productAttributes). */
export async function flipkart(q) {
  const f = cfg.flipkart;
  if (!f.id || !f.token) throw new Skip('Flipkart affiliate credentials not set');
  const j = await fetchJson(`${f.base}/1.0/search.json?query=${encodeURIComponent(q)}&resultCount=10`, { headers: { 'Fk-Affiliate-Id': f.id, 'Fk-Affiliate-Token': f.token } });
  const list = j.products || j.productInfoList || [];
  return list.map(p => {
    const b = p.productBaseInfoV1 || p.productBaseInfo?.productAttributes || p;
    const price = num(b.flipkartSpecialPrice) ?? num(b.flipkartSellingPrice) ?? num(b.sellingPrice);
    const specs = p.categorySpecificInfoV1?.keySpecs;
    let url = b.productUrl || null;
    if (url && !/[?&]affid=/.test(url)) url += (url.includes('?') ? '&' : '?') + 'affid=' + encodeURIComponent(f.id);
    return offer({
      title: b.title, brand: b.productBrand, price, mrp: num(b.maximumRetailPrice),
      discountPercent: num(b.discountPercentage), inStock: typeof b.inStock === 'boolean' ? b.inStock : null,
      image: img(b.imageUrls), url: url && url.replace(/^http:/, 'https:'), specs,
      delivery: num(p.productShippingInfoV1?.shippingCharges) === 0 ? 'Free delivery' : null,
      store: 'Flipkart', storeId: 'flk'
    });
  }).filter(Boolean);
}
