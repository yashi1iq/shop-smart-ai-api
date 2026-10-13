# ---------- Server ----------
PORT=3000
CORS_ORIGIN=*                  # set to your app's origin in production
ADMIN_KEY=change-me            # protects /admin/* endpoints
SEARCH_TTL_MIN=360             # cache each search 6h (Amazon allows up to 24h)
MAX_SCRAPE_STORES=3            # max ScrapingBee stores per search (credit control)
MIN_OFFERS=6                   # below this, the SerpApi fallback runs

# ---------- Amazon Creators API (PA-API 5 was retired) ----------
AMAZON_CLIENT_ID=
AMAZON_CLIENT_SECRET=
AMAZON_PARTNER_TAG=shopsmartai03-21
# India uses the EU credential region:
AMAZON_TOKEN_URL=https://api.amazon.co.uk/auth/o2/token
# OR point to your existing Amazon service instead (returns a JSON list):
AMAZON_UPSTREAM_URL=
AMAZON_UPSTREAM_KEY=

# ---------- Flipkart Affiliate API ----------
FLIPKART_AFFILIATE_ID=
FLIPKART_AFFILIATE_TOKEN=

# ---------- ZENROWS (stores with no API) ----------
ZENROWS _API_KEY=
SCRAPINGBEE_DAILY_CREDITS=7000   # ~ monthly credits / 30, minus a safety margin
# Optional per-store CSS rules, see README. Example:
# STORE_RULES_JSON={"snp":{"item":".product-tuple-listing","fields":{"title":".product-title","price":".product-price"}}}

# ---------- SerpApi Google Shopping (fallback) ----------
SERPAPI_API_KEY=
SERPAPI_DAILY_CALLS=8            # free plan = 250/month

# ---------- YouTube Data API v3 ----------
YOUTUBE_API_KEY=
YOUTUBE_DAILY_UNITS=9000         # default Google quota is 10,000 units/day
YT_TTL_HOURS=24

# ---------- Affiliate wrapping for non-Amazon/Flipkart links (optional) ----------
CUELINKS_CID=
