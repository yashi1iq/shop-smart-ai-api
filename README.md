# ShopSmart AI Backend

This backend is designed for the uploaded ShopSmart AI iPhone frontend.

The frontend already expects:

`GET /api/search?q=<query>&category=<category>`

and reads offer fields such as title, price, mrp, discount, rating, store, image, url, availability and specs. The frontend currently points at:

`https://shop-smart-ai-api-production.up.railway.app`

Source: uploaded ShopSmart AI HTML configuration.

## What is included

- Express API
- CORS for mobile/Netlify frontend
- `/api/health`
- `/api/search`
- `/api/stores`
- Demo data so the app works immediately
- Optional live shopping provider through SerpApi
- 2-minute in-memory cache
- Electronics + beauty queries, with the same API shape
- Railway-ready `package.json`
- Environment-variable configuration

## Important: real store prices

The backend cannot legally/reliably obtain every retailer's live price simply by opening their websites from JavaScript. Store APIs, affiliate feeds, or a compliant shopping-data provider should be used.

This project therefore has two modes:

### Demo mode

Default:

`DATA_MODE=demo`

The API returns realistic test offers so the frontend can be connected and tested.

### Live mode

Set:

`DATA_MODE=live`

and:

`SERPAPI_KEY=your_key`

The backend will query the configured shopping provider and normalize the returned results into the exact format used by the frontend.

## Run locally

```bash
npm install
npm start
```

Then open:

`http://localhost:8080/api/health`

Test search:

`http://localhost:8080/api/search?q=iPhone%2016%20Pro&category=electronics`

## Railway deployment

1. Create a GitHub repository, for example `ShopSmartAI-Backend`.
2. Upload these files.
3. Create a Railway project from the GitHub repository.
4. Railway should detect Node automatically.
5. Add environment variables:
   - `FRONTEND_ORIGIN=*` for initial testing
   - `DATA_MODE=demo`
6. Deploy.
7. Copy the Railway public URL.
8. In the ShopSmart AI frontend's Connection Check, set:
   - Backend URL = your Railway URL
   - Search path = `/api/search`
9. Save and retry.

For production, replace `FRONTEND_ORIGIN=*` with your exact Netlify domain.

## Frontend compatibility

The uploaded frontend is already configured for:

- `/api/search`
- query parameter `q`
- optional `category`
- JSON response
- CORS
- live polling

The frontend also has a connection-check screen that lets you change the backend URL without editing the HTML.

## Next production upgrades

For truly live retailer-by-retailer prices, add official retailer APIs/affiliate feeds or a licensed shopping-data provider for each store. Do not rely on uncontrolled browser scraping.

Recommended database additions later:

- PostgreSQL for price history
- Redis for shared caching
- scheduled workers for price refresh
- user alerts
- affiliate click tracking
- product deduplication
- retailer-specific adapters
