# ShopSmart AI backend

Zero-dependency Node 18+ server that matches what `ShopSmart_AI_Glass_UI.html` calls:

| Route | Used by the app for | Reply |
|---|---|---|
| `GET /api/search?q=&category=` | prices, all stores | `{ offers:[{title,brand,price,mrp,discountPercent,currency,rating,reviews,inStock,store,storeId,delivery,image,url,specs}], meta }` |
| `GET /api/youtube-reviews?q=` | review videos | `{ videos:[{videoId,title,channelTitle,thumbnail,duration,url}] }` |
| `GET /health` | uptime check | `{ ok:true }` |
| `GET /admin/status`, `/admin/probe?store=snp&q=air fryer` | your own checks (need `ADMIN_KEY`) | JSON |

`category` is the app's category id (electronics, beauty, ... gifts). `config.js` maps each of the 24 categories to its stores, copied from the app.

## Run
```
cp env.example .env      # fill the keys you have; anything missing is skipped, not an error
node --env-file=.env server.js
npm test                  # 19 end-to-end checks against mock upstreams, no keys needed
```
Deploy on Railway: push this folder, add the variables from `env.example`, start command `node server.js`.
Your app already points at `https://shop-smart-ai-api-production.up.railway.app`, so redeploy there or change `API_BASE`.

## What each provider does
- **Amazon**: Amazon Creators API (PA-API 5 was retired and now returns 403). Needs an approved Associates account and Creators API credentials; Amazon's docs list 10 qualifying sales in 30 days as a prerequisite. India uses the EU token endpoint (default set). Or set `AMAZON_UPSTREAM_URL` to keep using your existing Amazon service.
- **Flipkart**: Affiliate API `/1.0/search.json` with your affiliate id and token.
**No Amazon/Flipkart API keys?** Both fall back to ScrapingBee automatically (needs `SCRAPINGBEE_API_KEY`). Amazon uses the premium proxy (about 10 credits per search); scraped Amazon links carry `AMAZON_PARTNER_TAG`. The CSS rules in `config.js` are best guesses: check them with `/admin/probe?store=amz&q=iphone` and override with `STORE_RULES_JSON` if a store returns nothing. Set `MAX_SCRAPE_STORES=2` to scrape only those two and save credits.
- **ScrapingBee**: the 17 stores with no API. Tries 1 credit (no JS), then 5 (JS), or 25 (premium+JS) for stores marked `hard`. Reads embedded JSON (ld+json, `__NEXT_DATA__`) with no selectors. Add CSS rules per store with `STORE_RULES_JSON` where that returns nothing.
- **SerpApi**: Google Shopping fallback, only when fewer than `MIN_OFFERS` offers came back.
- **YouTube**: Data API v3, cached 24 h (a search costs 100 quota units).

## Cost controls
Results cached `SEARCH_TTL_MIN` (identical simultaneous requests share one call). Max `MAX_SCRAPE_STORES` scraped stores per search. Daily caps per paid provider (`SCRAPINGBEE_DAILY_CREDITS`, `SERPAPI_DAILY_CALLS`, `YOUTUBE_DAILY_UNITS`) reset at midnight IST; the response `meta.sources` shows what was skipped.

## Verify before launch (I could not reach live sites from my sandbox)
1. `/admin/probe?store=<id>&q=<product>` for each store. If `count` is 0, add rules in `STORE_RULES_JSON`; the `hard` flags in `config.js` are my guesses.
2. Flipkart search reply: the code reads `products` or `productInfoList`; confirm against your account's real response.
3. Amazon Creators API path `/catalog/v1/searchItems` follows the documented `getItems` pattern; confirm with a first call.
4. Store terms: scraping may violate some retailers' terms; keep it to stores you have checked.
