/**
 * Every adapter, regardless of the retailer's own response shape, must
 * produce objects matching this standardized ProductOffer schema before
 * they reach the matching/offer engines. Keeping normalization here
 * (rather than duplicated in each adapter) is what lets the rest of the
 * system stay retailer-agnostic.
 *
 * verificationStatus values:
 *   VERIFIED    - price came from a successful, fresh API/feed response
 *   RECENT      - served from short-lived cache (see CACHE_TTL_MS below)
 *   STALE       - cache is older than CACHE_TTL_MS but a live refetch failed
 *   UNAVAILABLE - no live data and nothing usable cached; never fill this
 *                 with an invented number
 */

export function normalizeOffer({
  retailer,
  productId = null,
  productName,
  brand = null,
  model = null,
  variant = null,
  color = null,
  storage = null,
  ram = null,
  image = null,
  mrp = null,
  sellingPrice = null,
  bankOffers = [],
  cardOffers = [],
  couponOffers = [],
  cashback = [],
  exchangeOffer = null,
  emiOffer = null,
  shipping = null,
  availability = "unknown",
  productUrl = null,
  currency = "INR",
  source,
  verificationStatus,
  fetchedAt = new Date().toISOString(),
  error = null,
}) {
  const discount =
    mrp != null && sellingPrice != null
      ? { amount: Math.max(mrp - sellingPrice, 0), percent: mrp > 0 ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0 }
      : null;

  return {
    retailer,
    productId,
    productName,
    brand,
    model,
    variant,
    color,
    storage,
    ram,
    image,
    mrp,
    sellingPrice,
    discount,
    bankOffers,
    cardOffers,
    couponOffers,
    cashback,
    exchangeOffer,
    emiOffer,
    shipping,
    availability,
    // Never invented: only ever the exact URL the retailer/API returned.
    productUrl,
    currency,
    source, // e.g. "amazon-paapi-v5", "flipkart-affiliate-api", "not_connected"
    verificationStatus,
    lastVerified: fetchedAt,
    error,
  };
}

/** Standard shape for an adapter that has no connected data source. */
export function notConnectedOffer(retailer, reason) {
  return normalizeOffer({
    retailer,
    productName: null,
    productUrl: null,
    source: "not_connected",
    verificationStatus: "UNAVAILABLE",
    error: reason,
  });
}

/** Standard shape for an adapter call that failed at request time. */
export function failedOffer(retailer, source, reason) {
  return normalizeOffer({
    retailer,
    productName: null,
    productUrl: null,
    source,
    verificationStatus: "UNAVAILABLE",
    error: reason,
  });
}
