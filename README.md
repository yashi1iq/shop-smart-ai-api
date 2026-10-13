# ShopSmart AI backend

Node backend for the ShopSmart AI frontend. It scrapes Amazon.in and Flipkart through the
[ZenRows](https://www.zenrows.com) Universal Scraper API, matches the same product across stores,
and returns offers in the shape the frontend already reads. It also serves the YouTube review videos.

**No npm dependencies.** Node 18.18+ only (`fetch` is built in), so there is nothing to install.

## Run it

```bash
cp .env.example .env        # put your ZENROWS_API_KEY in it
npm start                   # http://localhost:3000
npm test                    # 18 tests, no network or key needed
```

Check it works: `curl localhost:3000/health`, then `curl "localhost:3000/api/search?q=iphone+16+pro"`.

## Deploy on Railway

1. Push this folder to a GitHub repo (or `railway up`). Railway detects Node and runs `npm start`.
2. In **Variables** add `ZENROWS_API_KEY`, `CORS_ORIGINS` (your site's origin) and `MAX_ZENROWS_REQUESTS_PER_DAY`.
3. Your frontend already points at `https://shop-smart-ai-api-production.up.railway.app`. If your Railway
   URL differs, change `API_BASE` in the HTML.

## Switch the frontend to live data

In the HTML, set `const DEMO_MODE=false;` (it is `true` now, which never calls the backend).
If the backend is down or errors, the frontend automatically falls back to its sample data and shows a banner.

## Endpoints

| Route | What it returns |
|---|---|
| `GET /api/search?q=<text>&category=<id>` | `{ query, count, offers: [...], meta }` |
| `GET /api/youtube-reviews?q=<product>` | `{ videos: [{ videoId, title, channelTitle, thumbnail, duration, url }] }` |
| `GET /health` | Config status and today's ZenRows request count (never the key) |
| `GET /api/debug/scrape?store=&q=` | Admin only (needs `ADMIN_TOKEN`). Shows what the parser sees |

Each offer: `title, brand, price, mrp, discount, currency, rating, reviews, inStock, availText, store, delivery, image, url, specs`.

`meta.stores` says which stores answered (`{ amazon: { ok, count }, flipkart: { ok: false, error } }`), so a
partial result is visible. If every store fails the API returns 502 and the frontend uses sample data.

## How it works

- **Scraping** (`src/zenrows.js`): one ZenRows request per store per search, with `premium_proxy=true` and
  `proxy_country=in`. Retries once on 429/5xx, hard time budget of 38 s (the frontend gives up at 45 s),
  and the API key is never put in logs or responses.
- **Parsing** (`src/stores/`): Amazon is read from stable attributes (`data-asin`, `a-offscreen`, aria-labels).
  Flipkart's class names are obfuscated and change, so its parser reads visible text instead (₹ amounts,
  a lone rating, "N Ratings") and finds cards through `data-id` / `pid=`.
- **Matching** (`src/match.js`): the frontend groups offers by identical title, so listings of the same product
  from different stores get one shared title. Rules are strict on purpose: model number, storage size and
  variant words (Pro, Plus, Ultra...) must agree, and colour words are ignored. Merging iPhone 16 with 16 Plus
  would be worse than missing a match.
- **Caching** (`src/cache.js`): results are cached 30 min (5 min if a store failed), and identical
  simultaneous searches share one scrape. Every cache miss costs credits, so this is your main saving.

## Credits: read this before going live

ZenRows bills more for premium proxies and JS rendering. As I understand its pricing (confirm on your
dashboard): basic 1 credit, `js_render` about 5, `premium_proxy` about 10, both about 25 per request.
By default this backend uses premium proxy without JS, and each search makes **2 requests** (Amazon + Flipkart).

Things that multiply usage:

- **Hot deals on the home screen.** With `DEMO_MODE=false`, the frontend runs one search per category
  (about 24) the first time the page opens, then caches them in the browser for 6 hours. That is roughly
  48 ZenRows requests per new visitor, and the browser cache is per device. Keep `MAX_ZENROWS_REQUESTS_PER_DAY`
  set, and consider raising `CACHE_TTL_MINUTES`. The server cache means repeat visitors cost nothing.
- **Category browsing** runs 4 searches at once.
- Rate limiting (`RATE_LIMIT_PER_MIN`, default 60 per IP) stops one client from draining credits, but the
  daily cap is the real safety net. When it is hit, the API returns 429 and the frontend shows sample data.

## Known limits (please read)

- **The store parsers are not verified against the live sites.** I could not reach Amazon, Flipkart or
  ZenRows from the build environment, so the tests use synthetic pages shaped like the real markup.
  Expect to tweak a regex on first contact. Do this: set `ADMIN_TOKEN`, then call
  `/api/debug/scrape?store=amazon&q=iphone` with the `X-Admin-Token` header. It shows `htmlLength`, how many
  products parsed, and the start of the HTML. If a store returns zero products, first try
  `ZENROWS_JS_FLIPKART=true` (or `ZENROWS_JS_AMAZON=true`), then adjust the regexes in `src/stores/`.
- Only **Amazon.in and Flipkart** are implemented. Your frontend lists many more stores (Croma, Nykaa, Myntra...),
  but those are not scraped. Add one by writing a module like `src/stores/amazon.js` and registering it in
  `src/stores/index.js`.
- `specs` is only filled for Flipkart (from the bullet list on the card). Amazon search cards do not list specs.
- Scraping retail sites can conflict with their terms of service. Check that this is acceptable for your use.
- The Amazon affiliate tag is added by the frontend, not here.
- Search relevance comes from the stores. Searching "phone" can return cases and chargers; the frontend's
  pick logic already down-weights some of those.
