const BUDGET_RE = /(?:under|below|within|upto|up to|less than|<)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|lakh|lac|l)?\b/i;

export function parseBudget(q = '') {
  const m = q.match(BUDGET_RE);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ''));
  const u = (m[2] || '').toLowerCase();
  if (u === 'k') n *= 1e3; else if (u) n *= 1e5;
  return n > 0 ? n : null;
}

// "best phone under ₹15,000" -> "phone"
export const searchTerm = (q) => q.replace(BUDGET_RE, '').replace(/\bbest\b/i, '').replace(/\s+/g, ' ').trim() || q;

const score = (i) => ((i.rating - 3) * Math.log10((i.reviews || 0) + 10)) / Math.sqrt(i.price);

export function pickTiers(items, budget) {
  if (!budget) return null;
  const good = items.filter((i) => i.rating >= 3.5 && i.reviews >= 20);
  const within = good.filter((i) => i.price <= budget);
  return {
    budget,
    budgetPick: [...within].sort((a, b) => a.price - b.price)[0] || null,
    bestValue: [...within].sort((a, b) => score(b) - score(a))[0] || null,
    stretchPick:
      good
        .filter((i) => i.price > budget && i.price <= budget * 1.25)
        .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)[0] || null
  };
}
