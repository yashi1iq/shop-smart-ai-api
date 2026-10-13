const axios = require("axios");

const ZENROWS_URL = "https://api.zenrows.com/v1/";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch a page through ZenRows.
 * @param {string} url      Target page URL
 * @param {object} options  Extra ZenRows params (override defaults)
 *                          e.g. { premium_proxy: "false", proxy_country: "us" }
 * @param {number} retries  Retry count on failure (default 2)
 * @returns {Promise<string|object>} Response body (HTML, or JSON/markdown if requested)
 */
async function fetchPage(url, options = {}, retries = 2) {
  const apikey = process.env.ZENROWS_API_KEY;
  if (!apikey) throw new Error("ZENROWS_API_KEY is not set");

  const params = {
    apikey,
    url,
    js_render: "true",
    premium_proxy: "true",
    ...options,
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(ZENROWS_URL, { params, timeout: 60000 });
      return res.data;
    } catch (err) {
      const status = err.response && err.response.status;
      // Don't retry on auth / bad request / plan-limit errors
      const fatal = [400, 401, 402, 403, 404].includes(status);
      if (fatal || attempt === retries) {
        const detail =
          err.response && err.response.data
            ? JSON.stringify(err.response.data)
            : err.message;
        throw new Error(`ZenRows request failed (${status || "no status"}): ${detail}`);
      }
      await sleep(1000 * (attempt + 1));
    }
  }
}

module.exports = { fetchPage };
