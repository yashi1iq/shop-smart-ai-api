/**
 * Tracks, per retailer, the data needed for the /api/retailers/status
 * dashboard endpoint: connection state, last sync time, last error,
 * and how many products the last search actually returned.
 *
 * In-memory only — fine for a single-process deployment. For multiple
 * instances behind a load balancer, back this with Redis or a DB table
 * instead so the dashboard reflects reality across all of them.
 */

const state = new Map();

export function recordResult(retailer, { connected, productsReturned, error }) {
  state.set(retailer, {
    retailer,
    connected,
    lastSync: new Date().toISOString(),
    lastError: error || null,
    productsReturned: productsReturned ?? 0,
  });
}

export function getStatus() {
  return Array.from(state.values());
}

export function getStatusFor(retailer) {
  return state.get(retailer) || { retailer, connected: false, lastSync: null, lastError: "No requests made yet", productsReturned: 0 };
}
