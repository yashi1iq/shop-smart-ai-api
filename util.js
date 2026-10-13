export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rupee: '₹' };
export function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChr(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChr(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}
function safeChr(n) {
  try { return String.fromCodePoint(n); } catch { return ''; }
}

export const clean = (s) => decodeEntities(s).replace(/\s+/g, ' ').trim();

/* Visible text of an HTML fragment, one logical element per line. */
export function textLines(html) {
  return decodeEntities(
    String(html ?? '')
      .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, '\n')
      .replace(/<[^>]*>/g, '\n'),
  )
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/* "₹1,29,900.00" -> 129900 */
export function parsePrice(s) {
  if (s == null) return null;
  const m = String(s).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Math.round(parseFloat(m[0]));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* "12,345" -> 12345, "1.2K" -> 1200, "(3M)" -> 3000000 */
export function parseCount(s) {
  const t = String(s ?? '').replace(/[(),\s]/g, '').toLowerCase();
  const m = t.match(/^(\d+(?:\.\d+)?)([km])?\+?/);
  if (!m) return null;
  const mult = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1;
  return Math.round(parseFloat(m[1]) * mult);
}

export function attr(tag, name) {
  const m = String(tag ?? '').match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decodeEntities(m[2] ?? m[3]) : null;
}

/* Common brands, used only to fill the `brand` field when the title starts with one. */
const BRANDS = [
  'Apple', 'Samsung', 'Google', 'OnePlus', 'Sony', 'LG', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Canon', 'Nikon',
  'Maybelline', 'Lakme', 'Nivea', 'Cetaphil', 'Neutrogena', 'Minimalist', 'Garnier', 'Olay', 'Clinique', 'Mamaearth',
  'Revlon', 'Dyson', 'Philips', 'Xiaomi', 'Redmi', 'Realme', 'Poco', 'Vivo', 'Oppo', 'Motorola', 'Nothing', 'iQOO',
  'boAt', 'JBL', 'Bose', 'Noise', 'Sennheiser', "Levi's", 'Nike', 'Adidas', 'Puma', 'Crocs', 'Skechers', 'Bata',
  'LEGO', 'Fastrack', 'Titan', 'Casio', 'Fossil', 'Funko', 'Prestige', 'Bajaj', 'Havells', 'Whirlpool', 'Voltas',
  'Panasonic', 'Godrej', 'IFB', 'Bosch', 'Haier', 'TCL', 'Hisense', 'Mi', 'GoPro', 'Fujifilm', 'Kindle', 'Amazon',
];
const BRAND_MAP = new Map(BRANDS.map((b) => [b.toLowerCase(), b]));
export function guessBrand(title) {
  const words = String(title ?? '').trim().split(/\s+/).slice(0, 3);
  for (const w of words) {
    const b = BRAND_MAP.get(w.toLowerCase().replace(/[^a-z0-9']/g, ''));
    if (b) return b;
  }
  return null;
}

export function makeOffer({ store, title, price, mrp, rating, reviews, image, url, delivery, specs, inStock = true, availText }) {
  const p = price ?? null;
  const m = mrp && p && mrp > p ? mrp : null;
  const out = {
    title: String(title || '').trim(),
    brand: guessBrand(title),
    price: p,
    mrp: m,
    discount: m ? Math.round(((m - p) / m) * 100) : null,
    currency: 'INR',
    rating: rating != null && rating > 0 && rating <= 5 ? Math.round(rating * 10) / 10 : null,
    reviews: reviews ?? null,
    inStock,
    availText: availText || (inStock ? 'In stock' : 'Out of stock'),
    store,
    delivery: delivery || null,
    image: image || null,
    url: url || null,
    specs: Array.isArray(specs) ? specs.slice(0, 4) : [],
  };
  return out;
}

export function cleanQuery(raw) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
