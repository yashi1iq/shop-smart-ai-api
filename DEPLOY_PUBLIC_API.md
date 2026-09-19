# Shop Smart AI API — Deploy

## Render
1. Create a Render account.
2. Create a new Web Service and connect this project/repository.
3. Runtime: Node.
4. Build command: `npm install`
5. Start command: `npm start`
6. Health check: `/api/health`
7. Deploy.

After deployment, Render gives a public base URL, for example:
`https://shop-smart-ai-api.onrender.com`

API examples:
`https://YOUR-DOMAIN/api/health`
`https://YOUR-DOMAIN/api/retailers/status`
`https://YOUR-DOMAIN/api/search?q=iPhone%2016%20Pro`

Replace YOUR-DOMAIN with the exact URL assigned by the hosting provider.

## Important
A public API URL only deploys this backend. Live retailer pricing requires authorized credentials/API access or feeds for each retailer. Do not add private keys to frontend code or commit `.env`.
