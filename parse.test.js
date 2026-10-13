import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmazon, BlockedError } from '../src/stores/amazon.js';
import { parseFlipkart } from '../src/stores/flipkart.js';
import { mergeOffers, prep, similar, shortTitle } from '../src/match.js';
import { parsePrice, parseCount } from '../src/util.js';
import { AMAZON_HTML, AMAZON_CAPTCHA, FLIPKART_HTML } from './fixtures.js';

test('util: price and count parsing', () => {
  assert.equal(parsePrice('₹1,29,900.00'), 129900);
  assert.equal(parsePrice('Rs. 499'), 499);
  assert.equal(parsePrice(''), null);
  assert.equal(parseCount('12,345'), 12345);
  assert.equal(parseCount('2.5K'), 2500);
  assert.equal(parseCount('(1.2M)'), 1200000);
});

test('amazon: parses cards, skips sponsored, priceless and duplicate ASINs', () => {
  const r = parseAmazon(AMAZON_HTML);
  assert.equal(r.length, 3);
  const [a, b] = r;
  assert.equal(a.store, 'Amazon.in');
  assert.equal(a.price, 119900);
  assert.equal(a.mrp, 129900);
  assert.equal(a.discount, 8);
  assert.equal(a.rating, 4.5);
  assert.equal(a.reviews, 1234);
  assert.equal(a.brand, 'Apple');
  assert.equal(a.url, 'https://www.amazon.in/dp/B0DGHYWX01');
  assert.match(a.image, /media-amazon/);
  assert.match(a.delivery, /FREE delivery Tue, 14 Oct/);
  assert.equal(b.reviews, 2500);
  assert.equal(r[2].mrp, null, 'mrp equal to price is not a discount');
});

test('amazon: robot check page throws BlockedError', () => {
  assert.throws(() => parseAmazon(AMAZON_CAPTCHA), BlockedError);
});

test('amazon: respects limit', () => {
  assert.equal(parseAmazon(AMAZON_HTML, { limit: 1 }).length, 1);
});

test('flipkart: parses cards from text, skips ads', () => {
  const r = parseFlipkart(FLIPKART_HTML);
  assert.equal(r.length, 3);
  const a = r[0];
  assert.equal(a.store, 'Flipkart');
  assert.equal(a.title, 'Apple iPhone 16 Pro (Black Titanium, 128 GB)');
  assert.equal(a.price, 117900, 'first pure price line is the selling price, not the exchange offer');
  assert.equal(a.mrp, 129900);
  assert.equal(a.rating, 4.6);
  assert.equal(a.reviews, 123456);
  assert.equal(a.url, 'https://www.flipkart.com/apple-iphone-16-pro-black-titanium-128-gb/p/itmmobh4dqfg8njrzcv?pid=MOBH4DQFG8NJRZCV');
  assert.match(a.image, /rukminim2/);
  assert.deepEqual(a.specs.slice(0, 2), ['128 GB ROM', '15.49 cm (6.1 inch) Display']);
  assert.equal(a.delivery, 'Free delivery');
  assert.equal(r[2].mrp, null);
});

test('flipkart: unrelated page returns empty list, captcha throws', () => {
  assert.deepEqual(parseFlipkart('<html><body>nothing here</body></html>'), []);
  assert.throws(() => parseFlipkart('<html>Please solve the recaptcha</html>'), BlockedError);
});

test('match: same phone across stores merges, different variants do not', () => {
  const amz = parseAmazon(AMAZON_HTML);
  const fk = parseFlipkart(FLIPKART_HTML);
  const merged = mergeOffers([...amz, ...fk]);

  const byTitle = new Map();
  merged.forEach((o) => byTitle.set(o.title, [...(byTitle.get(o.title) || []), o.store]));
  /* 3 distinct products: Pro 128, Pro 256, Plus 128 */
  assert.equal(byTitle.size, 3, JSON.stringify([...byTitle]));
  for (const stores of byTitle.values()) assert.deepEqual(stores.sort(), ['Amazon.in', 'Flipkart']);
  assert.ok([...byTitle.keys()].some((t) => /16 Pro/.test(t) && /128/.test(t)));
  assert.ok([...byTitle.keys()].every((t) => t.length <= 100));
});

test('match: strict rules', () => {
  const s = (a, b) => similar(prep(a), prep(b));
  assert.equal(s('Apple iPhone 16 Pro 128 GB', 'Apple iPhone 16 Pro (Black Titanium, 128 GB)'), true);
  assert.equal(s('Apple iPhone 16 128 GB', 'Apple iPhone 16 Plus 128 GB'), false);
  assert.equal(s('Apple iPhone 16 128 GB', 'Apple iPhone 15 128 GB'), false);
  assert.equal(s('Apple iPhone 16 128 GB', 'Apple iPhone 16 256 GB'), false);
  assert.equal(s('Samsung Galaxy S25 Ultra 12GB 256GB', 'Samsung Galaxy S25 Ultra (Titanium Silverblue, 12 GB RAM, 256 GB ROM)'), true);
  assert.equal(s('Samsung Galaxy S25 Ultra 256GB', 'Samsung Galaxy S25 256GB'), false);
  assert.equal(s('boAt Airdopes 141 Bluetooth Earbuds', 'Sony WH-1000XM5 Headphones'), false);
});

test('match: keeps cheapest listing per store inside a cluster', () => {
  const o = (store, price, title) => ({ store, price, title });
  const m = mergeOffers([
    o('Amazon.in', 500, 'Boat Airdopes 141 Earbuds Black'),
    o('Amazon.in', 450, 'Boat Airdopes 141 Earbuds Blue'),
    o('Flipkart', 480, 'boAt Airdopes 141 (Red)'),
  ]);
  assert.equal(m.length, 2);
  assert.equal(m.find((x) => x.store === 'Amazon.in').price, 450);
});

test('shortTitle trims marketing tails', () => {
  assert.equal(shortTitle('Apple iPhone 16 Pro 128 GB: 5G Mobile Phone with Camera Control'), 'Apple iPhone 16 Pro 128 GB');
  assert.ok(shortTitle('x'.repeat(40) + ' ' + 'word '.repeat(40)).length <= 100);
});
