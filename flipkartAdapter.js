/**
 * Flipkart Affiliate API adapter.
 * Docs: https://affiliate.flipkart.com/api-docs
 *
 * Requires an approved Flipkart affiliate account (FLIPKART_AFFILIATE_ID,
 * FLIPKART_AFFILIATE_TOKEN). Without those, reports "not_connected" —
 * never a fabricated result.
 */
import { normalizeOffer, notConnectedOffer, failedOffer } from "../lib/normalizer.js";

export async function searchFlipkart(query) {
  const { FLIPKART_AFFILIATE_ID, FLIPKART_AFFILIATE_TOKEN } = process.env;

  if (!FLIPKART_AFFILIATE_ID || !FLIPKART_AFFILIATE_TOKEN) {
    return [notConnectedOffer("Flipkart", "No FLIPKART_AFFILIATE_ID/FLIPKART_AFFILIATE_TOKEN configured — apply via the Flipkart Affiliate Program.")];
  }

  const url = `https://affiliate-api.flipkart.net/affiliate/1.0/search.json?query=${encodeURIComponent(query)}&resultCount=10`;

  let res, body;
  try {
    res = await fetch(url, {
      headers: {
        "Fk-Affiliate-Id": FLIPKART_AFFILIATE_ID,
        "Fk-Affiliate-Token": FLIPKART_AFFILIATE_TOKEN,
      },
    });
    body = await res.json();
  } catch (err) {
    return [failedOffer("Flipkart", "flipkart-affiliate-api", `Request failed: ${err.message}`)];
  }

  if (!res.ok) {
    return [failedOffer("Flipkart", "flipkart-affiliate-api", `HTTP ${res.status}`)];
  }

  const products = body?.products || [];
  if (products.length === 0) {
    return [failedOffer("Flipkart", "flipkart-affiliate-api", "No matching products returned")];
  }

  return products.map(({ productBaseInfoV1: p }) => {
    const mrp = p?.maximumRetailPrice?.amount ?? null;
    const price = p?.flipkartSpecialPrice?.amount ?? p?.flipkartSellingPrice?.amount ?? null;

    return normalizeOffer({
      retailer: "Flipkart",
      productId: p?.productId || null,
      productName: p?.title || query,
      brand: p?.attributes?.brand || null,
      image: p?.imageUrls?.["400x400"] || null,
      mrp,
      sellingPrice: price,
      // The Affiliate API surfaces flags like codAvailable/emiAvailable but
      // not itemized bank/card/coupon breakdowns — we only report what it
      // actually returns.
      bankOffers: [],
      cardOffers: [],
      couponOffers: [],
      cashback: [],
      exchangeOffer: null,
      emiOffer: p?.emiAvailable ? { label: "EMI available", condition: "See retailer for eligible banks/terms" } : null,
      shipping: 0,
      availability: p?.inStock ? "in_stock" : "out_of_stock",
      productUrl: p?.productUrl || null, // exact canonical URL from the API — never constructed
      source: "flipkart-affiliate-api",
      verificationStatus: price != null ? "VERIFIED" : "UNAVAILABLE",
    });
  });
}
