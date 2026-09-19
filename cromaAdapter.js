/**
 * Croma does not publish a public product/pricing API, affiliate feed, or
 * developer program as of writing. There is no permitted way for this
 * adapter to retrieve live Croma prices, so it reports its true status
 * instead of scraping croma.com (which would violate Croma's Terms of
 * Service) or inventing numbers.
 *
 * If Croma opens a partner/affiliate/API program in the future, implement
 * this the same way amazonAdapter.js / flipkartAdapter.js are structured:
 * read credentials from process.env, make the real signed/authenticated
 * request, and normalize the real response — nothing else in the system
 * needs to change.
 */
import { notConnectedOffer } from "../lib/normalizer.js";

export async function searchCroma(_query) {
  return [notConnectedOffer(
    "Croma",
    "No public product/pricing API or affiliate feed is available from Croma at this time. A data partnership would need to be arranged directly with Croma/Infiniti Retail."
  )];
}
