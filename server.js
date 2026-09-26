import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const DEFAULT_LOCATION = process.env.DEFAULT_LOCATION || "Hyderabad, Telangana, India";
const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY || "in";
const DEFAULT_LANGUAGE = process.env.DEFAULT_LANGUAGE || "en";
const CACHE_TTL = Number(process.env.CACHE_TTL_SECONDS || 60) * 1000;

const allowedOrigins = (process.env.CORS_ORIGINS || "*")
  .split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("CORS origin not allowed"));
  }
}));
app.use(express.json({ limit: "100kb" }));

const cache = new Map();

function cleanQuery(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 180);
}

function safeNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const m = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function discount(price, oldPrice) {
  if (price == null || oldPrice == null || oldPrice <= price) return null;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

function canonicalStore(source = "") {
  const s = source.toLowerCase();
  if (s.includes("amazon")) return "Amazon";
  if (s.includes("flipkart")) return "Flipkart";
  if (s.includes("croma")) return "Croma";
  if (s.includes("reliance digital") || s.includes("reliancedigital")) return "Reliance Digital";
  if (s.includes("vijay sales") || s.includes("vijaysales")) return "Vijay Sales";
  if (s.includes("myntra")) return "Myntra";
  if (s.includes("nykaa")) return "Nykaa";
  if (s.includes("purplle")) return "Purplle";
  if (s.includes("ajio")) return "AJIO";
  if (s.includes("tata cliq") || s.includes("tatacliq")) return "Tata CLiQ";
  if (s.includes("firstcry")) return "FirstCry";
  if (s.includes("bigbasket")) return "BigBasket";
  if (s.includes("pepperfry")) return "Pepperfry";
  if (s.includes("ikea")) return "IKEA";
  if (s.includes("decathlon")) return "Decathlon";
  if (s.includes("1mg") || s.includes("tata 1mg")) return "Tata 1mg";
  if (s.includes("pharmeasy")) return "PharmEasy";
  return source || "Store";
}

function normalizeShoppingResult(item, index) {
  const price = safeNumber(item.extracted_price ?? item.price);
  const oldPrice = safeNumber(item.extracted_old_price ?? item.old_price);
  const source = canonicalStore(item.source || item.merchant || item.seller);
  const link = item.link || item.product_link || null;
  return {
    id: String(item.product_id || item.position || index),
    title: item.title || "Product",
    brand: null,
    price,
    mrp: oldPrice && price && oldPrice > price ? oldPrice : null,
    discount: discount(price, oldPrice),
    currency: "INR",
    rating: safeNumber(item.rating),
    reviews: safeNumber(item.reviews),
    inStock: item.second_hand_condition ? true : null,
    availText: null,
    store: source,
    delivery: item.delivery || item.shipping || null,
    image: item.thumbnail || item.serpapi_thumbnail || null,
    url: link,
    specs: Array.isArray(item.extensions) ? item.extensions.slice(0, 6) : []
  };
}

function categoryHint(category) {
  const map = {
    electronics: "electronics",
    beauty: "beauty skincare makeup hair care",
    fashion: "fashion clothing apparel",
    footwear: "shoes footwear",
    home: "home kitchen appliances",
    furniture: "furniture",
    grocery: "grocery food",
    sports: "sports fitness",
    computers: "computers laptops accessories",
    cameras: "cameras photography",
    mobileacc: "mobile accessories",
    watches: "watches",
    jewellery: "jewellery accessories",
    toys: "toys kids",
    books: "books education",
    pets: "pet supplies",
    automotive: "automotive car bike accessories"
  };
  return map[category] || "";
}

async function serpApiSearch(q, category, location) {
  if (!SERPAPI_KEY) {
    const err = new Error("SERPAPI_KEY is not configured on the backend.");
    err.code = "MISSING_API_KEY";
    throw err;
  }

  const cacheKey = JSON.stringify({ q, category, location });
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data;

  const query = [q, categoryHint(category)].filter(Boolean).join(" ").trim();
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", SERPAPI_KEY);
  url.searchParams.set("gl", DEFAULT_COUNTRY);
  url.searchParams.set("hl", DEFAULT_LANGUAGE);
  url.searchParams.set("location", location || DEFAULT_LOCATION);
  url.searchParams.set("device", "mobile");

  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const err = new Error(data.error || `SerpApi returned HTTP ${response.status}`);
    err.code = "UPSTREAM_ERROR";
    throw err;
  }

  const raw = Array.isArray(data.shopping_results) ? data.shopping_results : [];
  const offers = raw
    .map(normalizeShoppingResult)
    .filter(x => x.title && x.price != null && x.url)
    .slice(0, 40);

  const result = {
    query: q,
    category: category || null,
    location: location || DEFAULT_LOCATION,
    updatedAt: new Date().toISOString(),
    count: offers.length,
    offers
  };

  cache.set(cacheKey, { time: Date.now(), data: result });
  return result;
}

app.get("/", (_req, res) => {
  res.json({
    name: "ShopSmart AI API",
    status: "ok",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      search: "GET /api/search?q=iPhone%2016%20Pro&category=electronics"
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "shopsmart-ai-backend",
    serpapiConfigured: Boolean(SERPAPI_KEY),
    time: new Date().toISOString()
  });
});

app.get("/api/search", async (req, res) => {
  try {
    const q = cleanQuery(req.query.q ?? req.query.query);
    const category = cleanQuery(req.query.category);
    const location = cleanQuery(req.query.location) || DEFAULT_LOCATION;

    if (!q) return res.status(400).json({ error: "Missing required query parameter: q" });

    const result = await serpApiSearch(q, category, location);
    res.set("Cache-Control", "no-store");
    res.json(result);
  } catch (error) {
    const status = error.code === "MISSING_API_KEY" ? 503 : 502;
    res.status(status).json({
      error: error.message || "Search service failed",
      code: error.code || "SEARCH_FAILED"
    });
  }
});

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

app.listen(PORT, () => {
  console.log(`ShopSmart AI API running on port ${PORT}`);
});
