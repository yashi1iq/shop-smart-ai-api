# Shop Smart AI — prototype (backend + frontend)

`frontend/index.html` is the client UI — open it locally or host it anywhere
static. It has zero price-generation logic of its own; it only calls the
backend below and shows exactly what it returns, including "not connected"
and "Live price unavailable" states honestly.


This is a real, deployable backend implementing the retailer-adapter
architecture: adapters → normalizer → matching engine → offer engine →
API endpoints. It is **not running anywhere right now** — I can't host a
persistent server or hold API secrets inside this chat/artifact
environment, and the sandbox this was written in has no outbound network
access at all. You (or a developer) need to deploy it somewhere with real
network access — a small VM, Render, Railway, Fly.io, a serverless
function, etc.

## What's actually real here

- **Amazon adapter** (`adapters/amazonAdapter.js`) — a real, correctly
  signed PA-API v5 `SearchItems` request (AWS Signature v4, implemented
  from scratch with Node's `crypto` module — no unverified third-party
  signing library). It will return real Amazon prices **once you have
  approved PA-API credentials.**
- **Flipkart adapter** — a real call to the Flipkart Affiliate API. Same
  condition: needs an approved affiliate account.
- **Croma / Reliance Digital / Vijay Sales adapters** — these always
  return `"not_connected"`. As of writing, none of these three publish a
  public product/pricing API or affiliate feed. There is nothing to wire
  up honestly. If one of them opens a partner program later, its adapter
  slots in the same way `amazonAdapter.js` does.

## What you need to do to make prices actually appear

1. **Amazon**: Sign up for the Amazon Associates Program (India), then
   apply for PA-API access from your Associates account
   (https://webservices.amazon.in/paapi5/documentation/). Amazon approves
   PA-API access based on your account generating qualifying sales — a
   brand-new associate account is not guaranteed instant access.
2. **Flipkart**: Apply for the Flipkart Affiliate Program
   (https://affiliate.flipkart.com/api-docs) and get your affiliate ID +
   token.
3. Copy `.env.example` to `.env` and fill in whichever credentials you
   actually obtained. Leave the rest blank — those retailers will
   correctly show as "not connected" instead of the app crashing or
   guessing.
4. `npm install && npm start` (or deploy to your platform of choice with
   the same env vars set in its dashboard/secrets manager).
5. Point the frontend's `API_BASE_URL` (top of the artifact's `<script>`)
   at your deployed backend's URL.

## Why Croma / Reliance Digital / Vijay Sales can't be "just added"

Getting their real prices legitimately requires one of:
- A commercial data-partnership / affiliate agreement directly with the
  retailer (not something either of us can set up from a chat).
- Scraping their website — which I won't build, since it's against their
  Terms of Service regardless of how the request is framed.

Until one of those changes, the honest state for those three is
"Data source not connected," not a fake price.

## Endpoints

- `GET /api/search?q=<query>` — runs all adapters, normalizes, groups by
  configuration (brand + storage), returns real results plus which
  retailers were unavailable and why.
- `POST /api/offers/compute` — given one ProductOffer, returns labeled
  offer *scenarios* (never auto-summed unless the source explicitly
  confirmed combinability, which neither current adapter does).
- `GET /api/retailers/status` — connection dashboard: connected/not,
  last sync, last error, products returned.
- `GET /api/health` — liveness check.

## Caching and freshness

Results are cached in-memory for 2 minutes to absorb repeat requests in
one session — not to serve old data as current. A cached result is
labeled `RECENT` (not `VERIFIED`); if a live refetch fails and only old
cache remains, it's labeled `STALE`. The frontend should render these
statuses visibly rather than treating every response as equally live.

## What this does NOT do, on purpose

- Never invents a price, product URL, or offer.
- Never bypasses CAPTCHA, bot protection, or authentication.
- Never stores secrets anywhere the frontend can read them — the
  frontend only ever talks to this backend, never to a retailer
  directly.
- Never auto-stacks bank + coupon + exchange discounts into one number
  unless a retailer source explicitly says they combine.
