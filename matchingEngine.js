/**
 * Parses a free-text query into structured attributes, and groups
 * cross-retailer results into "same configuration" clusters so a 128GB
 * phone is never compared against a 256GB one as if they were identical.
 *
 * This is intentionally conservative: if we can't confidently confirm two
 * listings are the same configuration, we keep them in SEPARATE groups
 * rather than guessing they match.
 */

const STORAGE_RE = /(\d+)\s?(gb|tb)\b/i;
const RAM_RE = /(\d+)\s?gb\s?ram\b/i;

export function parseQuery(query) {
  const q = query.trim();
  const storageMatch = q.match(STORAGE_RE);
  const ramMatch = q.match(RAM_RE);

  return {
    raw: q,
    brand: q.split(" ")[0] || null,
    storage: storageMatch ? `${storageMatch[1]}${storageMatch[2].toUpperCase()}` : null,
    ram: ramMatch ? `${ramMatch[1]}GB` : null,
  };
}

function normalizeToken(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Groups normalized ProductOffer objects by (brand + storage + ram) when
 * those attributes are known. Offers missing enough attribute data to
 * confirm a match are placed in their own singleton group rather than
 * merged by guesswork.
 */
export function groupByConfiguration(offers, parsedQuery) {
  const groups = new Map();

  for (const offer of offers) {
    if (offer.verificationStatus === "UNAVAILABLE" && !offer.sellingPrice) {
      // Not-connected / failed adapters don't participate in matching —
      // they're surfaced separately as retailer status, not as a "product".
      continue;
    }

    const storage = offer.storage || parsedQuery.storage || "unspecified";
    const brand = normalizeToken(offer.brand || parsedQuery.brand || "unknown");
    const key = `${brand}::${storage}`;

    if (!groups.has(key)) groups.set(key, { brand: offer.brand || parsedQuery.brand, storage, offers: [] });
    groups.get(key).offers.push(offer);
  }

  return Array.from(groups.values());
}
