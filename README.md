# ShopSmart AI Backend — ZenRows edition

Express API for the ShopSmart AI frontend. Uses the **existing ZenRows API** to retrieve Google Shopping HTML and parse product cards. It does not require SerpApi. It also includes a ZenRows-powered YouTube review-search endpoint.

## API routes

- `GET /` — service information
- `GET /health` — health/configuration check (does not expose credentials)
- `GET /api/search?q=phone&category=smartphone` — product results
- `GET /search?q=phone` — alias
- `GET /api/products/search?q=phone` — alias
- `GET /api/youtube-reviews?q=iPhone%2016` — YouTube review links and thumbnails

Product response includes `success`, `query`, `count`, and the same product array as `products`, `offers`, and `results` for frontend compatibility. Each product may include title, price in INR, store, link, image, rating, MRP/discount, and stock/delivery fields when the source exposes them.

## Deploy on existing Railway project

1. Download/extract this ZIP.
2. Review the files; commit the contents to the GitHub repository connected to your Railway service (back up the current version first).
3. In Railway → service → Variables, set `ZENROWS_API_KEY` to your real ZenRows key. Do not put the key in GitHub or the frontend.
4. Keep `PORT` unset unless your service specifically requires it; Railway injects it.
5. Set `CORS_ORIGINS` to the exact deployed frontend origin, e.g. `https://shopsmart-ai.netlify.app`. Add other origins comma-separated if genuinely needed.
6. Ensure the Railway service root directory points to the folder containing `package.json`, or place these files at the repository root.
7. Deploy and wait for a successful build. The start command is `npm start` (also set automatically by the package script).
8. Open `https://YOUR-RAILWAY-DOMAIN/health`. Confirm `status: ok` and `providers.zenrowsConfigured: true`.
9. Test `https://YOUR-RAILWAY-DOMAIN/api/search?q=iphone` and `https://YOUR-RAILWAY-DOMAIN/api/youtube-reviews?q=iphone`.

## Connect the Netlify frontend

The HTML frontend previously shared uses:

```js
const API_BASE='https://shop-smart-ai-api-production.up.railway.app';
const SEARCH_PATH='/api/search';
const DEMO_MODE=true;
```

Set `API_BASE` to your real Railway public domain and set `DEMO_MODE=false`, then publish the updated frontend to Netlify. The frontend also calls `/api/youtube-reviews`; this backend implements that route. If the frontend has a saved API base in its browser settings, update/clear that saved value too.

## ZenRows notes

- This implementation requests Google Shopping's HTML through ZenRows and parses common result-card markup plus JSON-LD fallback. Search-engine markup can change; always test with your account and target region.
- Live prices/stock are only as accurate as the source response and may be missing. Do not present them as guaranteed real-time prices.
- ZenRows usage, proxy/rendering options, and target-site access depend on your plan. Enable `ZENROWS_JS_RENDER=true` or `ZENROWS_PREMIUM_PROXY=true` only if supported/needed, since they can consume more credits.
- A successful HTTP response with zero parsed products means the target page returned HTML but the parser did not find supported product cards; inspect ZenRows target response and update selectors as needed.
- Amazon tracking tag is appended to Amazon.in links when present. Other affiliate networks are not fabricated. Only configure `AWIN_TRACKING_TEMPLATE` if you have a valid template from your Awin account.

## Security and limits

- Never commit `.env` or API credentials.
- Rate limiting and a small in-memory cache are enabled. Cache clears when Railway restarts; it is not a persistent database.
- This is a product-search backend, not a full AI model. Riya product summaries/chat, accounts, wishlist persistence, price alerts, and a database are not implemented here.
