import { storeFlags } from '../config.js';
import { attr, clean, decodeEntities, makeOffer, parseCount, parsePrice, textLines } from '../util.js';
import { BlockedError } from './amazon.js';

const BLOCKED = /recaptcha|Access Denied|are you a human|unusual traffic/i;
const PURE_PRICE = /^₹\s?[\d,]+(?:\.\d+)?$/;

/**
 * Flipkart search results.
 * Flipkart's CSS class names are obfuscated and change often, so this parser avoids them:
 * cards are found through `data-id` / `pid=` links, and values come from the visible text
 * (₹ amounts, a lone "4.3" rating, "1,234 Ratings").
 */
export function parseFlipkart(html, { limit = 10 } = {}) {
  let chunks = html.split(/(?=<div\b[^>]*\bdata-id="[A-Z0-9]{10,20}")/).slice(1);
  if (!chunks.length) chunks = html.split(/(?=<a\b[^>]*href="[^"]*pid=)/).slice(1);
  if (!chunks.length) {
    if (BLOCKED.test(html)) throw new BlockedError('Flipkart returned a robot-check page.');
    return [];
  }

  const out = [];
  const seen = new Set();
  for (const raw of chunks) {
    if (out.length >= limit) break;
    const c = raw.slice(0, 25000);

    const anchor = (c.match(/<a\b[^>]*href="([^"]*\/p\/[^"]*|[^"]*pid=[^"]*)"[^>]*>/) || [])[0];
    if (!anchor) continue;
    const href = decodeEntities(attr(anchor, 'href') || '');
    const pid = (href.match(/[?&]pid=([A-Z0-9]+)/) || [])[1];
    const key = pid || href.split('?')[0];
    if (seen.has(key)) continue;

    const lines = textLines(c);
    if (lines.includes('Ad')) continue; /* sponsored */

    let title = attr(anchor, 'title');
    if (!title) title = attr((c.match(/<img\b[^>]*>/) || [''])[0], 'alt');
    if (!title) title = lines.find((l) => l.length >= 12 && !l.includes('₹') && !/^\d/.test(l));
    title = clean(title);
    if (!title) continue;

    const pure = lines.filter((l) => PURE_PRICE.test(l)).map(parsePrice);
    const any = pure.length ? pure : lines.flatMap((l) => (l.match(/₹\s?[\d,]+/g) || []).map(parsePrice));
    const price = any[0];
    if (!price) continue;
    const mrp = any.slice(1).find((n) => n > price) || null;

    const ratingLine = lines.find((l) => /^[1-5](?:\.\d)?$/.test(l));
    const rating = ratingLine ? parseFloat(ratingLine) : null;
    const flat = lines.join(' ');
    const reviews = parseCount(
      (flat.match(/([\d,.]+\s?[KkMm]?)\s*Ratings?\b/) || [])[1] || (flat.match(/([\d,.]+\s?[KkMm]?)\s*Reviews?\b/) || [])[1],
    );

    const image = [...c.matchAll(/<img\b[^>]*>/g)]
      .map((m) => attr(m[0], 'src'))
      .find((s) => s && /^https?:/.test(s));

    const specs = [...c.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)]
      .map((m) => clean(m[1].replace(/<[^>]*>/g, ' ')))
      .filter((s) => s.length >= 3 && s.length <= 60)
      .slice(0, 4);

    const delivery = lines.find((l) => /^free delivery|delivery by|delivery in/i.test(l)) || null;

    let url = null;
    try {
      const u = new URL(href, 'https://www.flipkart.com');
      u.search = pid ? `?pid=${pid}` : '';
      u.hash = '';
      url = u.href;
    } catch { /* leave null */ }

    seen.add(key);
    out.push(makeOffer({ store: 'Flipkart', title, price, mrp, rating, reviews, image, url, delivery, specs }));
  }
  return out;
}

export const flipkart = {
  id: 'flipkart',
  name: 'Flipkart',
  searchUrl: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
  /* Product cards are in the first HTML for most queries; turn JS on if you see zero results:
     set ZENROWS_JS_FLIPKART=true (costs more credits). */
  flags: () => storeFlags('flipkart', { js: false, premium: true }),
  waitFor: 'a[href*="pid="]',
  parse: parseFlipkart,
};
