import { searchAmazon } from './amazon.js';

// Add Flipkart, Croma, Reliance Digital, etc. here: each adapter is (query) => Promise<Product[]>
const providers = [searchAmazon];

export async function searchAll(q) {
  const r = await Promise.allSettled(providers.map((p) => p(q)));
  const items = r.flatMap((x) => (x.status === 'fulfilled' ? x.value : []));
  if (!items.length && r.every((x) => x.status === 'rejected')) throw new Error(r[0].reason.message);
  return items.sort((a, b) => a.price - b.price); // low -> high by price
}
