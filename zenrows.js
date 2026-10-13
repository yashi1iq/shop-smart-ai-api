import { config } from './config.js';
import { sleep } from './util.js';

export class ZenRowsError extends Error {
  constructor(message, { status = 502, code = 'zenrows_error', retryable = false } = {}) {
    super(message);
    this.name = 'ZenRowsError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

/* ---- daily request budget (resets at 00:00 UTC) ---- */
const budget = { day: '', used: 0 };
function spend() {
  const day = new Date().toISOString().slice(0, 10);
  if (budget.day !== day) { budget.day = day; budget.used = 0; }
  if (config.maxDailyRequests > 0 && budget.used >= config.maxDailyRequests) {
    throw new ZenRowsError('Daily ZenRows request limit reached. Try again tomorrow or raise MAX_ZENROWS_REQUESTS_PER_DAY.', {
      status: 429, code: 'daily_limit',
    });
  }
  budget.used++;
}
export const requestsToday = () => ({ day: budget.day, used: budget.used, limit: config.maxDailyRequests });

/**
 * Fetch a page through the ZenRows Universal Scraper API and return its HTML.
 *
 * Credit cost per request (check your ZenRows plan): basic 1, js_render about 5,
 * premium_proxy about 10, both about 25. Keep js_render off unless a store needs it.
 *
 * @param {string} targetUrl  page to scrape
 * @param {object} o
 * @param {boolean} [o.js]        render JavaScript (js_render=true)
 * @param {boolean} [o.premium]   residential proxy (premium_proxy=true), needed for Amazon/Flipkart
 * @param {string}  [o.country]   proxy_country (only with premium)
 * @param {string}  [o.waitFor]   CSS selector to wait for (js only)
 * @param {number}  [o.deadline]  absolute epoch ms by which we must be done
 */
export async function zrFetch(targetUrl, { js = false, premium = true, country = config.proxyCountry, waitFor, deadline } = {}) {
  if (!config.zenrowsKey) {
    throw new ZenRowsError('ZENROWS_API_KEY is not set on the server.', { status: 503, code: 'no_key' });
  }
  const params = new URLSearchParams({ apikey: config.zenrowsKey, url: targetUrl });
  if (js) {
    params.set('js_render', 'true');
    if (waitFor) params.set('wait_for', waitFor);
  }
  if (premium) {
    params.set('premium_proxy', 'true');
    if (country) params.set('proxy_country', country);
  }
  const endpoint = `${config.zenrowsEndpoint}?${params}`;
  const end = deadline ?? Date.now() + config.zenrowsTimeoutMs;

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = end - Date.now();
    if (remaining < 4000) {
      throw lastErr || new ZenRowsError('Ran out of time before ZenRows could answer.', { status: 504, code: 'timeout' });
    }
    spend();
    try {
      const res = await fetch(endpoint, {
        signal: AbortSignal.timeout(Math.min(config.zenrowsTimeoutMs, remaining)),
        headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
      });
      const body = await res.text();
      if (res.ok) return body;
      lastErr = interpret(res.status, body);
    } catch (e) {
      if (e instanceof ZenRowsError) throw e;
      const timedOut = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      /* Never include the request URL in messages: it contains the API key. */
      lastErr = new ZenRowsError(timedOut ? 'ZenRows took too long to respond.' : 'Could not reach ZenRows.', {
        status: timedOut ? 504 : 502, code: timedOut ? 'timeout' : 'network', retryable: !timedOut,
      });
    }
    if (!lastErr.retryable) throw lastErr;
    await sleep(900 * (attempt + 1));
  }
  throw lastErr;
}

function interpret(status, body) {
  let detail = '';
  try {
    const j = JSON.parse(body);
    detail = [j.code, j.title, j.detail].filter(Boolean).join(' - ');
  } catch { detail = String(body).slice(0, 160).replace(/\s+/g, ' '); }
  const retryable = status === 429 || status >= 500;
  if (status === 401 || status === 403) {
    return new ZenRowsError(`ZenRows rejected the API key or request (${status}). ${detail}`.trim(), { status: 502, code: 'auth', retryable: false });
  }
  if (status === 402) {
    return new ZenRowsError(`ZenRows says the plan has no credits left (402). ${detail}`.trim(), { status: 502, code: 'credits', retryable: false });
  }
  if (status === 422 || status === 400) {
    return new ZenRowsError(`ZenRows could not scrape that page (${status}). ${detail}`.trim(), { status: 502, code: 'bad_request', retryable: false });
  }
  return new ZenRowsError(`ZenRows error ${status}. ${detail}`.trim(), { status: 502, code: `http_${status}`, retryable });
}
