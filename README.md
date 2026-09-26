# ShopSmart AI Backend

This backend matches the uploaded ShopSmart AI frontend.

## Frontend contract

The frontend is already configured for:

`GET /api/search?q=<product>&category=<category-id>`

It accepts a response containing an `offers` array with fields such as title, price, mrp, discount, rating, reviews, store, delivery, image and url.

## Data source

The backend uses SerpApi's Google Shopping engine. Google Shopping results expose product title, source/store, price, old price, rating, reviews, delivery and product links. The backend keeps the SerpApi key on the server, not in the frontend.

## Run locally

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Put your SerpApi key in `SERPAPI_KEY`.
5. Run `npm start`.
6. Test `http://localhost:3000/health`.
7. Test `http://localhost:3000/api/search?q=iPhone%2016%20Pro&category=electronics`.

## Railway deployment

Create a Railway service from this folder/repository.

Environment variables:
- `SERPAPI_KEY` = your private SerpApi key
- `CORS_ORIGINS` = your Netlify frontend URL (or `*` for initial testing)
- `DEFAULT_LOCATION` = `Hyderabad, Telangana, India`
- `CACHE_TTL_SECONDS` = `60`

Railway automatically runs `npm start` from `package.json`.

After deployment, use the generated Railway domain as the frontend API base.

## Important

This implementation is designed for real shopping-search data, not fake demo prices. Results can vary by location and by what Google Shopping currently indexes. Store availability, final checkout price, coupons, bank offers and delivery should be treated as live-store information and verified on the retailer page before purchase.

## Frontend

Your uploaded HTML already points to:
`https://shop-smart-ai-api-production.up.railway.app`

Once this backend is deployed at that domain, the existing `/api/search` calls can work without changing the visual UI.
