import { searchAmazon } from './amazon.js';
import { searchGoogleShopping } from './google-shopping.js';

// Each source is (query) => Promise<Product[]>. Add more sources here.
const providers = [searchAmazon, searchGoogleShopping];

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);

export async function searchAll(q) {
  const r = await Promise.allSettled(providers.map((p) => withTimeout(p(q), 35000)));
  r.forEach((x, i) => { if (x.status === 'rejected') console.error(`${providers[i].name} failed: ${x.reason.message}`); });
  const items = r.flatMap((x) => (x.status === 'fulfilled' ? x.value : []));
  if (!items.length && r.every((x) => x.status === 'rejected')) throw new Error(r[0].reason.message);
  return items.sort((a, b) => a.price - b.price); // low -> high by price
}
