/**
 * Turns a normalized offer's raw bank/card/coupon/exchange/cashback data
 * into clearly labeled SCENARIOS rather than one auto-summed "final price".
 *
 * Only if the adapter explicitly marked combinability as confirmed by the
 * retailer/API (offer.combinable === true) do we compute a single combined
 * total. No current adapter sets that flag, because neither PA-API nor the
 * Flipkart Affiliate API confirms combinability — so today this always
 * produces separate scenarios, per the "never stack unconfirmed discounts"
 * rule.
 */

export function buildOfferScenarios(offer) {
  const scenarios = [];
  const basePrice = offer.sellingPrice;

  if (basePrice == null) {
    return { basePrice: null, scenarios: [], note: "Live price unavailable — no scenario can be calculated." };
  }

  const conditionalGroups = [
    ["bankOffers", "Bank offer"],
    ["cardOffers", "Card offer"],
    ["couponOffers", "Coupon"],
    ["cashback", "Cashback"],
  ];

  for (const [field, label] of conditionalGroups) {
    for (const entry of offer[field] || []) {
      scenarios.push({
        type: label,
        description: entry.label || label,
        amount: entry.amount ?? null,
        condition: entry.condition || "Terms apply",
        // Never pre-applied to the displayed price — shown as a potential
        // scenario the user opts into.
        estimatedPriceIfApplied: entry.amount != null ? Math.max(basePrice - entry.amount, 0) : null,
      });
    }
  }

  if (offer.exchangeOffer) {
    scenarios.push({
      type: "Exchange",
      description: offer.exchangeOffer.label || "Exchange offer",
      amount: offer.exchangeOffer.amount ?? null,
      condition: offer.exchangeOffer.condition || "With eligible device exchange",
      estimatedPriceIfApplied: offer.exchangeOffer.amount != null ? Math.max(basePrice - offer.exchangeOffer.amount, 0) : null,
    });
  }

  if (offer.emiOffer) {
    scenarios.push({
      type: "EMI",
      description: offer.emiOffer.label || "EMI available",
      amount: null,
      condition: offer.emiOffer.condition || "Terms apply",
      estimatedPriceIfApplied: null,
    });
  }

  return {
    basePrice,
    scenarios,
    note: "Prices and retailer offers can change. Final price is determined by the retailer at checkout.",
  };
}
