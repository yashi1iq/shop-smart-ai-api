/**
 * Amazon Product Advertising API (PA-API) v5 adapter — SearchItems operation.
 *
 * This performs a REAL signed request to Amazon's API. It requires:
 *   AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, AMAZON_PARTNER_TAG
 * from an approved Amazon Associates account with PA-API access
 * (https://webservices.amazon.in/paapi5/documentation/). Without those,
 * this adapter correctly reports "not_connected" — it never fabricates
 * a response.
 *
 * PA-API v5 access is also usage-gated: Amazon only keeps issuing request
 * quota to associates who are generating qualifying sales, so a newly
 * approved key can still return throttling/quota errors. Those are
 * surfaced as UNAVAILABLE, never masked with invented data.
 */
import crypto from "node:crypto";
import { normalizeOffer, notConnectedOffer, failedOffer } from "../lib/normalizer.js";

const SERVICE = "ProductAdvertisingAPI";

function hmac(key, msg) {
  return crypto.createHmac("sha256", key).update(msg, "utf8").digest();
}
function hash(msg) {
  return crypto.createHash("sha256").update(msg, "utf8").digest("hex");
}

function signRequest({ method, host, path, payload, accessKey, secretKey, region }) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems\n`;
  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";

  const canonicalRequest =
    `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${hash(payload)}`;

  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const stringToSign =
    `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${hash(canonicalRequest)}`;

  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { amzDate, authorization };
}

export async function searchAmazon(query) {
  const { AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, AMAZON_PARTNER_TAG, AMAZON_HOST, AMAZON_REGION, AMAZON_MARKETPLACE } = process.env;

  if (!AMAZON_ACCESS_KEY || !AMAZON_SECRET_KEY || !AMAZON_PARTNER_TAG) {
    return [notConnectedOffer("Amazon", "No AMAZON_ACCESS_KEY/AMAZON_SECRET_KEY/AMAZON_PARTNER_TAG configured — apply for PA-API access via your Amazon Associates account.")];
  }

  const host = AMAZON_HOST || "webservices.amazon.in";
  const region = AMAZON_REGION || "eu-west-1";
  const path = "/paapi5/searchitems";

  const payload = JSON.stringify({
    Keywords: query,
    Resources: [
      "ItemInfo.Title",
      "ItemInfo.ByLineInfo",
      "ItemInfo.ProductInfo",
      "Offers.Listings.Price",
      "Offers.Listings.SavingBasis",
      "Offers.Listings.Availability.Message",
      "Images.Primary.Large",
    ],
    PartnerTag: AMAZON_PARTNER_TAG,
    PartnerType: "Associates",
    Marketplace: AMAZON_MARKETPLACE || "www.amazon.in",
    ItemCount: 10,
  });

  const { amzDate, authorization } = signRequest({
    method: "POST", host, path, payload,
    accessKey: AMAZON_ACCESS_KEY, secretKey: AMAZON_SECRET_KEY, region,
  });

  let res, body;
  try {
    res = await fetch(`https://${host}${path}`, {
      method: "POST",
      headers: {
        "content-encoding": "amz-1.0",
        "content-type": "application/json; charset=utf-8",
        "x-amz-date": amzDate,
        "x-amz-target": "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems",
        "Authorization": authorization,
      },
      body: payload,
    });
    body = await res.json();
  } catch (err) {
    return [failedOffer("Amazon", "amazon-paapi-v5", `Request failed: ${err.message}`)];
  }

  if (!res.ok || body.Errors) {
    const reason = body?.Errors?.[0]?.Message || `HTTP ${res.status}`;
    return [failedOffer("Amazon", "amazon-paapi-v5", reason)];
  }

  const items = body?.SearchResult?.Items || [];
  if (items.length === 0) {
    return [failedOffer("Amazon", "amazon-paapi-v5", "No matching items returned")];
  }

  return items.map((item) => {
    const listing = item.Offers?.Listings?.[0];
    const price = listing?.Price?.Amount ?? null;
    const mrp = listing?.SavingBasis?.Amount ?? price;

    return normalizeOffer({
      retailer: "Amazon",
      productId: item.ASIN,
      productName: item.ItemInfo?.Title?.DisplayValue || query,
      brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue || null,
      image: item.Images?.Primary?.Large?.URL || null,
      mrp,
      sellingPrice: price,
      // PA-API does not return bank/card/coupon offer breakdowns — Amazon
      // does not expose that via this endpoint, so we do not invent them.
      bankOffers: [],
      cardOffers: [],
      couponOffers: [],
      cashback: [],
      exchangeOffer: null,
      emiOffer: null,
      shipping: 0,
      availability: listing?.Availability?.Message || "unknown",
      productUrl: item.DetailPageURL || null, // exact canonical URL from the API — never constructed
      source: "amazon-paapi-v5",
      verificationStatus: price != null ? "VERIFIED" : "UNAVAILABLE",
    });
  });
}
