import { storeFlags } from '../config.js';
import { attr, clean, makeOffer, parseCount, parsePrice, textLines } from '../util.js';

export class BlockedError extends Error {
  constructor(message) { super(message); this.name = 'BlockedError'; }
}

const BLOCKED = /Enter the characters you see below|api-services-support@amazon|Type the characters you see in this image|Sorry, we just need to make sure you're not a robot/i;

/**
 * Amazon.in search results.
 * Everything is read from attributes Amazon has kept stable for years
 * (data-component-type, data-asin, a-offscreen, aria-labels). If a field starts
 * coming back empty, adjust the matching regex below.
 */
export function parseAmazon(html, { limit = 10 } = {}) {
  if (BLOCKED.test(html)) throw new BlockedError('Amazon returned a robot-check page.');
  const chunks = html.split(/(?=<div\b[^>]*data-component-type="s-search-result")/).slice(1);
  const out = [];
  const seen = new Set();

  for (const raw of chunks) {
    if (out.length >= limit) break;
    /* each chunk runs to the next result, so cap the last one to avoid footer noise */
    const c = raw.slice(0, 60000);
    const asin = (c.match(/data-asin="([A-Z0-9]{10})"/) || [])[1];
    if (!asin || seen.has(asin)) continue;
    if (/puis-sponsored-label|aria-label="Sponsored"|>\s*Sponsored\s*</i.test(c.slice(0, 6000))) continue;

    const h2 = (c.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/) || [])[1];
    let title = h2 ? textLines(h2).join(' ') : '';
    if (!title) title = attr((c.match(/<h2\b[^>]*>/) || [''])[0], 'aria-label') || '';
    title = clean(title);
    if (!title) continue;

    /* class="a-price" is the selling price; "a-price a-text-price" is the struck-through MRP */
    const price = parsePrice((c.match(/<span class="a-price"[^>]*>[\s\S]*?<span class="a-offscreen">([^<]*)<\/span>/) || [])[1]);
    if (!price) continue; /* unavailable or price hidden: nothing to compare */
    const mrp = parsePrice((c.match(/<span class="a-price a-text-price"[^>]*>[\s\S]*?<span class="a-offscreen">([^<]*)<\/span>/) || [])[1]);

    const rating = parseFloat((c.match(/(\d(?:\.\d)?) out of 5 stars/) || [])[1]);
    const reviews = parseCount(
      (c.match(/aria-label="([\d,.]+\s?[KkMm]?)\s+ratings?"/) || [])[1]
      || (c.match(/class="a-size-base s-underline-text"[^>]*>\s*\(?([\d,.]+\s?[KkMm]?)\)?\s*</) || [])[1]
      || (c.match(/href="[^"]*customerReviews[^"]*"[^>]*>[\s\S]{0,300}?>\s*\(?([\d,.]+\s?[KkMm]?)\)?\s*</) || [])[1],
    );

    const imgTag = (c.match(/<img\b[^>]*class="s-image"[^>]*>/) || [''])[0];
    const image = attr(imgTag, 'src');

    let delivery = null;
    const di = c.indexOf('data-cy="delivery-recipe"');
    if (di > -1) {
      /* start after the opening tag's ">" so attribute text is not read as content */
      const open = c.indexOf('>', di);
      const lines = textLines(c.slice(open > -1 ? open + 1 : di, di + 900));
      const k = lines.findIndex((l) => /delivery/i.test(l));
      if (k > -1) {
        delivery = lines[k];
        if (delivery.length < 22 && lines[k + 1] && !/delivery/i.test(lines[k + 1])) delivery += ' ' + lines[k + 1];
        delivery = delivery.slice(0, 80);
      }
    }

    seen.add(asin);
    out.push(makeOffer({
      store: 'Amazon.in', title, price, mrp, rating: Number.isFinite(rating) ? rating : null, reviews, image, delivery,
      url: `https://www.amazon.in/dp/${asin}`,
    }));
  }
  return out;
}

export const amazon = {
  id: 'amazon',
  name: 'Amazon.in',
  searchUrl: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  /* Server-rendered, so JS rendering is not needed; a premium proxy usually is. */
  flags: () => storeFlags('amazon', { js: false, premium: true }),
  waitFor: undefined,
  parse: parseAmazon,
};
