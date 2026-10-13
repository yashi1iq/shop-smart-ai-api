import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AMAZON_HTML, FLIPKART_HTML, YT_HTML } from './fixtures.js';

process.env.ZENROWS_API_KEY = 'SECRET_TEST_KEY_123';
process.env.PORT = '0';
process.env.RATE_LIMIT_PER_MIN = '1000';
process.env.MAX_ZENROWS_REQUESTS_PER_DAY = '1000';
delete process.env.YOUTUBE_API_KEY;

const realFetch = globalThis.fetch;
const zrCalls = [];
let behaviour = {}; /* per-host overrides: { amazon: 'ok'|403|500, flipkart: ... } */

globalThis.fetch = async (input, init) => {
  const u = new URL(String(input));
  if (u.hostname !== 'api.zenrows.com') return realFetch(input, init);
  const target = new URL(u.searchParams.get('url'));
  zrCalls.push({ target: target.href, params: Object.fromEntries(u.searchParams) });
  const host = target.hostname.includes('amazon') ? 'amazon' : target.hostname.includes('flipkart') ? 'flipkart' : 'youtube';
  const mode = behaviour[host] ?? 'ok';
  if (mode !== 'ok') {
    return new Response(JSON.stringify({ code: 'ERR', title: 'mock failure', detail: 'nope' }), { status: mode });
  }
  const body = host === 'amazon' ? AMAZON_HTML : host === 'flipkart' ? FLIPKART_HTML : YT_HTML;
  return new Response(body, { status: 200 });
};

let server, base;
before(async () => {
  const { createApp } = await import('../src/app.js');
  server = createApp();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const get = (p, headers) => realFetch(base + p, { headers });

test('health reports configuration without exposing the key', async () => {
  const r = await get('/health');
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.zenrowsConfigured, true);
  assert.deepEqual(j.stores, ['amazon', 'flipkart']);
  assert.ok(!JSON.stringify(j).includes('SECRET_TEST_KEY_123'));
});

test('search: merges both stores into comparable offers, then serves repeats from cache', async () => {
  zrCalls.length = 0;
  const r1 = await get('/api/search?q=iPhone%2016%20Pro&category=electronics');
  const j1 = await r1.json();
  assert.equal(r1.status, 200);
  assert.equal(r1.headers.get('access-control-allow-origin'), '*');
  assert.equal(j1.category, 'electronics');
  assert.equal(j1.meta.cached, false);
  assert.deepEqual(Object.keys(j1.meta.stores).sort(), ['amazon', 'flipkart']);
  assert.ok(j1.meta.stores.amazon.ok && j1.meta.stores.flipkart.ok);
  assert.equal(j1.count, j1.offers.length);

  /* the shape the frontend's norm() reads */
  for (const o of j1.offers) {
    assert.equal(typeof o.title, 'string');
    assert.equal(typeof o.price, 'number');
    assert.ok(['Amazon.in', 'Flipkart'].includes(o.store));
    assert.equal(typeof o.inStock, 'boolean');
    assert.ok(o.url.startsWith('https://'));
  }
  const titles = new Set(j1.offers.map((o) => o.title));
  assert.equal(titles.size, 3, 'Pro 128, Pro 256, Plus 128, each present at both stores');
  assert.equal(j1.offers.length, 6);

  /* ZenRows parameters */
  const amz = zrCalls.find((c) => c.target.includes('amazon.in'));
  assert.equal(amz.target, 'https://www.amazon.in/s?k=iPhone%2016%20Pro');
  assert.equal(amz.params.premium_proxy, 'true');
  assert.equal(amz.params.proxy_country, 'in');
  assert.equal(amz.params.js_render, undefined);
  assert.equal(zrCalls.length, 2);

  /* second identical search (different case/spacing) must not call ZenRows again */
  const j2 = await (await get('/api/search?q=%20iphone%2016%20%20pro')).json();
  assert.equal(j2.meta.cached, true);
  assert.equal(zrCalls.length, 2);
});

test('search: one store failing still returns the other, flagged in meta', async () => {
  behaviour = { flipkart: 500 };
  const r = await get('/api/search?q=partial%20failure%20phone');
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.meta.stores.flipkart.ok, false);
  assert.equal(j.meta.stores.amazon.ok, true);
  assert.ok(j.offers.length > 0 && j.offers.every((o) => o.store === 'Amazon.in'));
  assert.ok(!JSON.stringify(j).includes('SECRET_TEST_KEY_123'));
  behaviour = {};
});

test('search: every store failing gives 502 and never leaks the key', async () => {
  behaviour = { amazon: 403, flipkart: 403 };
  const r = await get('/api/search?q=total%20failure%20phone');
  const text = await r.text();
  assert.equal(r.status, 502);
  assert.match(JSON.parse(text).error, /Every store failed/);
  assert.ok(!text.includes('SECRET_TEST_KEY_123'));
  behaviour = {};
  /* failures are not cached: the same query works once ZenRows recovers */
  const ok = await get('/api/search?q=total%20failure%20phone');
  assert.equal(ok.status, 200);
});

test('search: validation, routing and CORS', async () => {
  assert.equal((await get('/api/search')).status, 400);
  assert.equal((await get('/api/search?q=a')).status, 400);
  assert.equal((await get('/nope')).status, 404);
  const pre = await realFetch(base + '/api/search?q=x', { method: 'OPTIONS', headers: { Origin: 'https://example.com' } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), '*');
  const post = await realFetch(base + '/api/search?q=xx', { method: 'POST' });
  assert.equal(post.status, 405);
});

test('debug route is hidden when ADMIN_TOKEN is not set', async () => {
  assert.equal((await get('/api/debug/scrape?store=amazon&q=test')).status, 404);
});

test('youtube-reviews: ZenRows fallback returns frontend shape and skips live streams', async () => {
  zrCalls.length = 0;
  const j = await (await get('/api/youtube-reviews?q=iphone%2016%20pro')).json();
  assert.equal(j.source, 'zenrows');
  assert.equal(j.videos.length, 2);
  assert.deepEqual(j.videos[0], {
    videoId: 'abc123DEF45',
    title: 'iPhone 16 Pro Review',
    channelTitle: 'TechChannel',
    thumbnail: 'https://i.ytimg.com/vi/abc123DEF45/hq.jpg',
    duration: '12:04',
    url: 'https://www.youtube.com/watch?v=abc123DEF45',
  });
  assert.equal(zrCalls[0].params.premium_proxy, undefined, 'YouTube does not need the expensive proxy');
});
