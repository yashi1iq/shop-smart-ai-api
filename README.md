# ShopSmart AI API

Backend for the ShopSmart AI app. It answers the two calls the app makes:

| Endpoint | What it returns |
| --- | --- |
| `GET /api/search?q=<product>&category=<id>` | Store offers for a product (price, MRP, discount, rating, reviews, store, link, image) from Google Shopping India, through SerpAPI |
| `GET /api/youtube-reviews?q=<product>` | Up to 6 review videos from the YouTube Data API |
| `GET /api/health` | Status and which providers are configured (never shows keys) |

`/search` and `?query=` also work, because the app tries those routes when it probes the server.

## Run locally

Needs Node 20.12 or newer. There are no dependencies, so there is nothing to `npm install`.

```bash
cd backend
cp .env.example .env      # add SERPAPI_KEY and YOUTUBE_API_KEY
npm start
```

No keys yet? Run `npm run dev`. It starts with `MOCK=1`, which serves generated sample offers and marks every response with `X-ShopSmart-Data: mock`. Never enable `MOCK` in production, because the app would present sample prices as live ones.

Run the tests with `npm test`. They stub the upstream APIs, so no keys or network are needed.

## Deploy on Railway

1. Push the `backend` folder to a GitHub repo (or set the service root directory to `backend`).
2. In Railway, create a service from that repo. `railway.json` already sets the start command and the `/api/health` check.
3. In the service Variables tab, add `SERPAPI_KEY` and `YOUTUBE_API_KEY`. Leave `MOCK` unset.
4. Open the service domain. `/api/health` should show `"shopping":"serpapi"` and `"youtube":"youtube-data-api"`.
5. In the app's HTML, make sure `API_BASE` matches your Railway domain. You can also change it inside the app from **Diagnose** under the sample-data banner.

## Keys and cost

- **SerpAPI** counts one search credit per uncached request. The app re-checks prices every 30 seconds while a result is open, so responses are cached for `SEARCH_CACHE_SECONDS` (default 900 = 15 minutes). Identical simultaneous requests share one upstream call, and if SerpAPI fails the last good answer (up to 24 hours old) is served instead.
- **YouTube Data API** gives 10,000 quota units a day, and each search costs about 101. That is roughly 100 uncached searches a day, so video results are cached for 24 hours by default. When the quota runs out the app simply hides the video section.

## Response shape

```json
{
  "query": "iphone 16 pro",
  "category": "electronics",
  "count": 12,
  "cached": false,
  "stale": false,
  "updatedAt": "2026-10-10T14:58:00.000Z",
  "offers": [
    {
      "id": "p1",
      "title": "Apple iPhone 16 Pro 256 GB",
      "brand": "Apple",
      "price": 119900,
      "mrp": 134900,
      "discount": 11,
      "currency": "INR",
      "rating": 4.6,
      "reviews": 1523,
      "inStock": null,
      "availText": null,
      "store": "Amazon.in",
      "delivery": "Free delivery",
      "image": "https://...",
      "url": "https://www.amazon.in/dp/...",
      "specs": ["256 GB"]
    }
  ]
}
```

`inStock` is `null` when the listing doesn't say, and `false` only when it states the item is out of stock. Amazon links are tagged with your Associates ID by the app itself.

## Errors

Every error is JSON: `{ "error": "<code>", "message": "..." }`.

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_query` | `q` missing, under 2 or over 120 characters |
| 429 | `rate_limited` | More than `RATE_LIMIT_PER_MINUTE` requests from one IP |
| 502 | `provider_error`, `provider_auth` | The data provider failed or rejected the key |
| 503 | `not_configured`, `provider_quota`, `youtube_quota` | Missing key or quota used up |
| 504 | `upstream_unreachable` | The provider timed out |

When the app gets a 502/503 on search it falls back to its labelled sample data, so a misconfigured server is visible rather than silently wrong.

## Configuration

See `.env.example` for every variable: `ALLOWED_ORIGINS`, cache lifetimes, rate limit, result cap and the rest.
