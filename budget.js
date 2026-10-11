/* Daily spend guard per paid provider (resets at midnight IST). Stops one busy day from using the month's credits. */
const used = {};
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const slot = n => { const d = today(); if (!used[n] || used[n].d !== d) used[n] = { d, n: 0 }; return used[n]; };
export const spend = (name, amount, limit) => { const s = slot(name); if (s.n + amount > limit) return false; s.n += amount; return true; };
export const refund = (name, amount) => { const s = slot(name); s.n = Math.max(0, s.n - amount); };
export const snapshot = () => Object.fromEntries(Object.entries(used).map(([k, v]) => [k, { day: v.d, used: v.n }]));
