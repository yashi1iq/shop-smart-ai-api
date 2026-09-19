/**
 * Reliance Digital does not publish a public product/pricing API or
 * affiliate feed as of writing. See cromaAdapter.js for the reasoning —
 * the same applies here: report true status, never scrape or invent data.
 */
import { notConnectedOffer } from "../lib/normalizer.js";

export async function searchRelianceDigital(_query) {
  return [notConnectedOffer(
    "Reliance Digital",
    "No public product/pricing API or affiliate feed is available from Reliance Digital at this time. A data partnership would need to be arranged directly with Reliance Retail."
  )];
}
