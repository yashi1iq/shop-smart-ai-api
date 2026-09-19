import "dotenv/config";
import express from "express";
import cors from "cors";

import { searchAmazon } from "./adapters/amazonAdapter.js";
import { searchFlipkart } from "./adapters/flipkartAdapter.js";
import { searchCroma } from "./adapters/cromaAdapter.js";
import { searchRelianceDigital } from "./adapters/relianceDigitalAdapter.js";
import { searchVijaySales } from "./adapters/vijaySalesAdapter.js";
import { parseQuery, groupByConfiguration } from "./lib/matchingEngine.js";
import { buildOfferScenarios } from "./lib/offerEngine.js";
import { recordResult, getStatus } from "./lib/statusStore.js";

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS origin not allowed"));
  }
}));
app.use(express.json());

const ADAPTERS = {
  Amazon: searchAmazon,
  Flipkart: searchFlipkart,
  Croma: searchCroma,
  "Reliance Digital": searchRelianceDigital,
  "Vijay Sales": searchVijaySales,
};

// Short-lived in-memory cache. Real prices go stale fast, so this is
// intentionally short — it exists to absorb repeat requests during a
// single browsing session, not to serve day-old data as if it were live.
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const cache = new Map(); // key -> { at, results }

function cacheKey(query) { return query.trim().toLowerCase(); }

async function runAllAdapters(query) {
  const settled = await Promise.allSettled(
    Object.entries(ADAPTERS).map(async ([retailer, fn]) => {
      try {
        const offers = await fn(query);
        const connected = offers.some(o => o.source !== "not_connected");
        const succeeded = offers.filter(o => o.verificationStatus === "VERIFIED");
        recordResult(retailer, {
          connected,
          productsReturned: succeeded.length,
          error: offers[0]?.error || null,
        });
        return offers;
      } catch (err) {
        recordResult(retailer, { connected: false, productsReturned: 0, error: err.message });
        return [{ retailer, source: retailer.toLowerCase(), verificationStatus: "UNAVAILABLE", error: `Adapter threw: ${err.message}`, productUrl: null }];
      }
    })
  );
  // flatten; a single retailer throwing never takes down the others
  return settled.flatMap(r => (r.status === "fulfilled" ? r.value : []));
}

/**
 * GET /api/search?q=<query>
 * Runs every adapter, normalizes + groups by configuration, marks
 * cache freshness honestly (VERIFIED fresh vs RECENT from short cache
 * vs STALE if a refetch failed and only old cache is left).
 */
app.get("/api/search", async (req, res) => {
  const query = (req.query.q || "").toString();
  if (!query.trim()) return res.status(400).json({ error: "Missing query parameter q" });

  const key = cacheKey(query);
  const cached = cache.get(key);
  const cacheAge = cached ? Date.now() - cached.at : Infinity;

  let offers;
  let servedFromCache = false;

  if (cached && cacheAge < CACHE_TTL_MS) {
    offers = cached.results;
    servedFromCache = true;
  } else {
    try {
      offers = await runAllAdapters(query);
      cache.set(key, { at: Date.now(), results: offers });
    } catch (err) {
      if (cached) {
        // Live refetch failed; we still have something, but it must be
        // labeled STALE, never presented as current.
        offers = cached.results.map(o => ({ ...o, verificationStatus: "STALE" }));
        servedFromCache = true;
      } else {
        return res.status(502).json({ error: "All retailer sources failed and no cached data exists", detail: err.message });
      }
    }
  }

  if (servedFromCache) {
    offers = offers.map(o => ({
      ...o,
      verificationStatus: o.verificationStatus === "VERIFIED" ? "RECENT" : o.verificationStatus,
    }));
  }

  const parsed = parseQuery(query);
  const groups = groupByConfiguration(offers, parsed);
  const notConnected = offers.filter(o => o.source === "not_connected");

  res.json({
    query,
    parsed,
    groups: groups.map(g => ({
      brand: g.brand,
      storage: g.storage,
      offers: g.offers.sort((a, b) => (a.sellingPrice ?? Infinity) - (b.sellingPrice ?? Infinity)),
    })),
    unavailableRetailers: notConnected.map(o => ({ retailer: o.retailer, reason: o.error })),
    fetchedAt: new Date().toISOString(),
    disclaimer: "Prices and retailer offers can change. Final price is determined by the retailer at checkout.",
  });
});

/** GET /api/offers/:productId — offer scenarios for one specific offer/product. */
app.post("/api/offers/compute", (req, res) => {
  const offer = req.body;
  if (!offer || typeof offer !== "object") return res.status(400).json({ error: "Request body must be a ProductOffer object" });
  res.json(buildOfferScenarios(offer));
});

/** GET /api/retailers/status — connection dashboard. */
app.get("/api/retailers/status", (_req, res) => {
  const known = Object.keys(ADAPTERS);
  const recorded = getStatus();
  const byRetailer = new Map(recorded.map(r => [r.retailer, r]));

  res.json(known.map(retailer => byRetailer.get(retailer) || {
    retailer, connected: false, lastSync: null, lastError: "No requests made yet", productsReturned: 0,
  }));
});

app.get("/api/health", (_req, res) => res.json({
  ok: true,
  service: "shop-smart-ai-backend",
  version: "1.1.0",
  time: new Date().toISOString()
}));

app.get("/api", (_req, res) => {
  res.json({
    name: "Shop Smart AI API",
    version: "1.1.0",
    endpoints: {
      search: "GET /api/search?q=<query>",
      offerScenarios: "POST /api/offers/compute",
      retailerStatus: "GET /api/retailers/status",
      health: "GET /api/health"
    },
    note: "Retailer prices are returned only from configured authorized data sources."
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
    available: [
      "GET /api",
      "GET /api/health",
      "GET /api/search?q=<query>",
      "POST /api/offers/compute",
      "GET /api/retailers/status"
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Shop Smart AI backend listening on :${PORT}`));
