# Shop Smart AI API — Setup Guide

This backend is the API layer for Shop Smart AI.

## What is implemented

- `GET /api/search?q=...`
- `POST /api/offers/compute`
- `GET /api/retailers/status`
- `GET /api/health`
- `GET /api`
- Amazon adapter
- Flipkart adapter
- Croma adapter slot
- Reliance Digital adapter slot
- Vijay Sales adapter slot
- Product normalization
- Conservative product matching
- Offer scenarios without unsafe discount stacking
- Short-lived price caching
- Per-retailer failure isolation

## Start locally

```bash
npm install
cp .env.example .env
npm start
```

Windows PowerShell:

```powershell
npm install
Copy-Item .env.example .env
npm start
```

Then test:

```text
http://localhost:3000/api/health
http://localhost:3000/api/search?q=iphone%2017%20256gb
http://localhost:3000/api/retailers/status
```

## Real retailer credentials

The application does not manufacture retailer credentials.

Configure only credentials obtained through an authorized retailer/affiliate/partner program.

Amazon:
- `AMAZON_ACCESS_KEY`
- `AMAZON_SECRET_KEY`
- `AMAZON_PARTNER_TAG`

Flipkart:
- `FLIPKART_AFFILIATE_ID`
- `FLIPKART_AFFILIATE_TOKEN`

Croma, Reliance Digital and Vijay Sales currently have adapter slots. Leave them unconfigured unless you obtain an authorized API/feed/partnership.

## Frontend connection

Set your frontend API base URL to the deployed backend, for example:

```text
https://YOUR-BACKEND-DOMAIN.example.com
```

Do not put retailer secrets in the frontend.

## Data integrity

The API intentionally returns `UNAVAILABLE` when a retailer has no connected authorized source. It does not generate fake prices or product links.

Price responses include a source and verification status. Conditional offers are represented as separate scenarios unless the source explicitly confirms they are combinable.

## Production notes

- Deploy this backend on a Node.js host with outbound HTTPS access.
- Set environment variables in the host's secret/environment-variable manager.
- Set `ALLOWED_ORIGINS` to your real frontend domain(s).
- For multiple backend instances, replace the in-memory cache/status store with Redis or a database.
- Add platform-specific rate limiting/authentication before exposing a private admin API.
