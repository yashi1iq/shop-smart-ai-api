const env = process.env;
let rules = {};
try { rules = JSON.parse(env.STORE_RULES_JSON || '{}'); } catch { console.warn('STORE_RULES_JSON is not valid JSON, ignored'); }

export const cfg = {
  port: +env.PORT || 3000,
  corsOrigin: env.CORS_ORIGIN || '*',
  adminKey: env.ADMIN_KEY || '',
  searchTtlMs: (+env.SEARCH_TTL_MIN || 360) * 60000,
  ytTtlMs: (+env.YT_TTL_HOURS || 24) * 3600000,
  maxScrapeStores: +env.MAX_SCRAPE_STORES || 3,
  minOffers: +env.MIN_OFFERS || 6,
  searchTimeoutMs: +env.SEARCH_TIMEOUT_MS || 30000,
  amazon: {
    clientId: env.AMAZON_CLIENT_ID || '', clientSecret: env.AMAZON_CLIENT_SECRET || '',
    partnerTag: env.AMAZON_PARTNER_TAG || 'shopsmartai03-21', marketplace: 'www.amazon.in',
    tokenUrl: env.AMAZON_TOKEN_URL || 'https://api.amazon.co.uk/auth/o2/token',
    apiBase: env.AMAZON_API_BASE || 'https://creatorsapi.amazon',
    upstreamUrl: env.AMAZON_UPSTREAM_URL || '', upstreamKey: env.AMAZON_UPSTREAM_KEY || ''
  },
  flipkart: { id: env.FLIPKART_AFFILIATE_ID || '', token: env.FLIPKART_AFFILIATE_TOKEN || '', base: env.FLIPKART_API_BASE || 'https://affiliate-api.flipkart.net/affiliate' },
  scrapingbee: { key: env.SCRAPINGBEE_API_KEY || '', dailyCredits: +env.SCRAPINGBEE_DAILY_CREDITS || 7000, base: env.SCRAPINGBEE_BASE || 'https://app.scrapingbee.com/api/v1/' },
  serpapi: { key: env.SERPAPI_API_KEY || '', dailyCalls: +env.SERPAPI_DAILY_CALLS || 8, base: env.SERPAPI_BASE || 'https://serpapi.com/search.json' },
  youtube: { key: env.YOUTUBE_API_KEY || '', dailyUnits: +env.YOUTUBE_DAILY_UNITS || 9000, base: env.YOUTUBE_BASE || 'https://www.googleapis.com/youtube/v3' },
  cuelinksCid: env.CUELINKS_CID || '',
  storeRules: rules
};

const e = encodeURIComponent;
const slug = q => q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* Amazon and Flipkart use their official APIs when credentials exist. With no credentials they fall back to ScrapingBee
   (needs SCRAPINGBEE_API_KEY). The CSS rules below are best guesses: verify with /admin/probe?store=amz&q=iphone and override
   with STORE_RULES_JSON if a store returns nothing. Both sites change their markup from time to time. */
const AMZ_API = !!(cfg.amazon.upstreamUrl || (cfg.amazon.clientId && cfg.amazon.clientSecret));
const FLK_API = !!(cfg.flipkart.id && cfg.flipkart.token);
const AMZ_SCRAPE = {
  name: 'Amazon.in', type: 'scrape', hard: true, base: 'https://www.amazon.in',
  url: q => `https://www.amazon.in/s?k=${e(q)}`,
  rules: {
    item: 'div[data-component-type="s-search-result"]:not(.AdHolder)',
    fields: {
      title: 'h2 a span', price: '.a-price .a-offscreen', mrp: '.a-price.a-text-price .a-offscreen',
      url: { selector: 'h2 a', output: '@href' }, image: { selector: 'img.s-image', output: '@src' },
      rating: '.a-icon-alt', reviews: 'span.a-size-base.s-underline-text'
    }
  }
};
const FLK_SCRAPE = {
  name: 'Flipkart', type: 'scrape', hard: false, base: 'https://www.flipkart.com',
  url: q => `https://www.flipkart.com/search?q=${e(q)}`,
  rules: {
    item: 'div[data-id]',
    fields: {
      title: '.KzDlHZ, .wjcEIp, .WKTcLC, a[title]', price: '.Nx9bqj, ._30jeq3', mrp: '.yRaY8j, ._3I9_wc',
      url: { selector: 'a[href*="/p/"]', output: '@href' }, image: { selector: 'img', output: '@src' },
      rating: '.XQDdHH, ._3LWZlK', reviews: '.Wphh3N, ._2_R_DZ'
    }
  }
};

/* type 'api' = official API adapter; 'scrape' = ScrapingBee. hard = needs premium proxy on retry (my guess, verify with /admin/probe). */
export const STORES = {
  amz: AMZ_API ? { name: 'Amazon.in', type: 'api' } : AMZ_SCRAPE,
  flk: FLK_API ? { name: 'Flipkart', type: 'api' } : FLK_SCRAPE,
  snp: { name: 'Snapdeal', type: 'scrape', base: 'https://www.snapdeal.com', url: q => `https://www.snapdeal.com/search?keyword=${e(q)}&sort=plth` },
  crm: { name: 'Croma', type: 'scrape', hard: true, base: 'https://www.croma.com', url: q => `https://www.croma.com/searchB?q=${e(q)}%3Arelevance&text=${e(q)}` },
  rel: { name: 'Reliance Digital', type: 'scrape', hard: true, base: 'https://www.reliancedigital.in', url: q => `https://www.reliancedigital.in/search?q=${e(q)}:relevance` },
  clq: { name: 'Tata CLiQ', type: 'scrape', hard: true, base: 'https://www.tatacliq.com', url: q => `https://www.tatacliq.com/search/?searchCategory=all&text=${e(q)}` },
  nyk: { name: 'Nykaa', type: 'scrape', hard: true, base: 'https://www.nykaa.com', url: q => `https://www.nykaa.com/search/result/?q=${e(q)}&root=search` },
  myn: { name: 'Myntra', type: 'scrape', hard: true, base: 'https://www.myntra.com', url: q => `https://www.myntra.com/${slug(q)}?rawQuery=${e(q)}` },
  pur: { name: 'Purplle', type: 'scrape', base: 'https://www.purplle.com', url: q => `https://www.purplle.com/search?q=${e(q)}` },
  ajo: { name: 'Ajio', type: 'scrape', hard: true, base: 'https://www.ajio.com', url: q => `https://www.ajio.com/search/?text=${e(q)}` },
  pep: { name: 'Pepperfry', type: 'scrape', base: 'https://www.pepperfry.com', url: q => `https://www.pepperfry.com/site_product/search?q=${e(q)}` },
  ike: { name: 'IKEA', type: 'scrape', base: 'https://www.ikea.com', url: q => `https://www.ikea.com/in/en/search/?q=${e(q)}` },
  dec: { name: 'Decathlon', type: 'scrape', base: 'https://www.decathlon.in', url: q => `https://www.decathlon.in/search?Ntt=${e(q)}` },
  fcr: { name: 'FirstCry', type: 'scrape', base: 'https://www.firstcry.com', url: q => `https://www.firstcry.com/search?q=${e(q)}` },
  bbk: { name: 'BigBasket', type: 'scrape', base: 'https://www.bigbasket.com', url: q => `https://www.bigbasket.com/ps/?q=${e(q)}&nc=as` },
  omg: { name: 'Tata 1mg', type: 'scrape', base: 'https://www.1mg.com', url: q => `https://www.1mg.com/search/all?name=${e(q)}` },
  phe: { name: 'PharmEasy', type: 'scrape', base: 'https://pharmeasy.in', url: q => `https://pharmeasy.in/search/all?name=${e(q)}` },
  stl: { name: 'Supertails', type: 'scrape', base: 'https://supertails.com', url: q => `https://supertails.com/search?q=${e(q)}` },
  huf: { name: 'Heads Up For Tails', type: 'scrape', base: 'https://headsupfortails.com', url: q => `https://headsupfortails.com/search?q=${e(q)}` }
};

/* Category id (sent by the app as ?category=) -> stores, in priority order. Copied from the app's CATS table. */
export const CATEGORY_STORES = {
  electronics: 'amz flk crm rel clq', beauty: 'nyk amz flk myn pur clq', fashion: 'myn ajo amz flk clq',
  footwear: 'myn ajo amz flk clq', home: 'amz flk clq snp ike', furniture: 'pep ike amz flk',
  computers: 'amz flk crm rel clq', cameras: 'amz flk crm rel', gaming: 'amz flk crm rel',
  tv: 'amz flk crm rel clq', mobileacc: 'amz flk crm rel snp', watches: 'amz flk myn clq ajo',
  jewellery: 'amz flk myn clq ajo', toys: 'amz flk fcr snp', sports: 'amz flk dec myn clq',
  auto: 'amz flk snp', pets: 'amz flk snp stl huf', books: 'amz flk snp',
  grocery: 'bbk amz flk', health: 'omg phe amz flk nyk', travel: 'amz flk myn clq snp',
  tools: 'amz flk snp', garden: 'amz flk snp', gifts: 'amz flk myn clq snp'
};
export const storesFor = cat => (CATEGORY_STORES[cat] || 'amz flk snp crm').split(' ');
