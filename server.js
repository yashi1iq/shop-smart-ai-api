import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import db, { save } from './store.js';
import { CATEGORIES } from './categories.js';
import { cached } from './cache.js';
import { searchAll } from './search.js';
import { parseBudget, searchTerm, pickTiers } from './tiers.js';
import { youtubeReviews } from './youtube.js';
import { askRiya } from './riya.js';
import { checkAlerts, vapidPublicKey } from './alerts.js';

const app = express();
app.set('trust proxy', 1);
app.use(cors(process.env.ALLOWED_ORIGINS ? { origin: process.env.ALLOWED_ORIGINS.split(',') } : {}));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const str = (v, n = 300) => String(v ?? '').slice(0, n);
const pos = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const bad = (res, msg) => res.status(400).json({ error: msg });

// Anonymous per-device identity: the app generates a random id once and sends it on every call.
const device = (req, res, next) => {
  const id = req.get('x-device-id');
  if (!id || id.length < 8 || id.length > 64) return bad(res, 'x-device-id header required');
  req.device = id;
  next();
};

const product = (p = {}) => ({
  key: str(p.key, 100), title: str(p.title), store: str(p.store, 40),
  url: /^https?:\/\//.test(p.url) ? str(p.url, 600) : '',
  image: /^https?:\/\//.test(p.image) ? str(p.image, 600) : null,
  price: pos(p.price), query: str(p.query, 100)
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/categories', (_req, res) => res.json(CATEGORIES));

// ---- Search + three-tier picks ----
app.get('/api/search', wrap(async (req, res) => {
  const q = str(req.query.q, 100).trim();
  if (q.length < 2) return bad(res, 'q is required');
  const budget = pos(req.query.budget) || parseBudget(q);
  const term = searchTerm(q);
  const ttl = (Number(process.env.CACHE_MINUTES) || 30) * 60_000;
  const { items, checkedAt } = await cached(`s:${term.toLowerCase()}`, ttl, async () => ({
    items: await searchAll(term), checkedAt: new Date().toISOString()
  }), !!req.query.refresh);
  res.json({
    query: q, searchTerm: term, category: str(req.query.category, 40) || null,
    budget, lastChecked: checkedAt, count: items.length,
    results: items, tiers: pickTiers(items, budget)
  });
}));

// ---- Hot deals (generated samples, as the UI labels them) ----
const SEEDS = [
  ['Wireless earbuds', 'electronics', 1999], ['Smart TV 43 inch', 'tv-appliances', 24999],
  ['Running shoes', 'footwear', 2499], ['Air fryer', 'home-kitchen', 3999],
  ['Face serum', 'beauty', 599], ['Backpack', 'travel-luggage', 1299]
];
app.get('/api/deals', (_req, res) => res.json(SEEDS.map(([title, category, price]) => ({
  title, category, price, mrp: Math.round(price * 1.3), discount: 23, sample: true, query: title
}))));

app.get(['/api/reviews', '/api/youtube-reviews'], wrap(async (req, res) => {
  const q = str(req.query.q ?? req.query.query ?? req.query.product ?? req.query.title, 100).trim();
  if (q.length < 2) return bad(res, 'q is required');
  res.json(await cached(`y:${q.toLowerCase()}`, 24 * 3600_000, () => youtubeReviews(q)));
}));

// ---- Riya ----
app.post('/api/riya', wrap(async (req, res) => {
  const { message, products, history, lang } = req.body || {};
  if (!message || typeof message !== 'string') return bad(res, 'message is required');
  const reply = await askRiya({
    message: message.slice(0, 1500),
    products: Array.isArray(products) ? products.slice(0, 8) : [],
    history: Array.isArray(history) ? history : [],
    lang
  });
  res.json({ reply });
}));

// ---- Saved ----
app.get('/api/saved', device, (req, res) => res.json(db.saved[req.device] || []));
app.post('/api/saved', device, (req, res) => {
  const p = product(req.body?.product);
  if (!p.key || !p.title || !p.price) return bad(res, 'product.key, title and price are required');
  const list = (db.saved[req.device] ||= []);
  if (list.length >= 200) return bad(res, 'Saved list is full');
  if (!list.some((x) => x.key === p.key)) list.push({ ...p, savedAt: Date.now() });
  save();
  res.status(201).json(list);
});
app.delete('/api/saved/:key', device, (req, res) => {
  db.saved[req.device] = (db.saved[req.device] || []).filter((x) => x.key !== req.params.key);
  save();
  res.json(db.saved[req.device]);
});

// ---- Price alerts ----
const mine = (req) => db.alerts.filter((a) => a.device === req.device);
const view = ({ device: _d, ...a }) => a;

app.get('/api/alerts', device, (req, res) => res.json(mine(req).map(view)));
app.post('/api/alerts', device, (req, res) => {
  const p = product(req.body);
  if (!p.key || !p.title || !p.price || !p.query) return bad(res, 'key, title, price and query are required');
  if (mine(req).filter((a) => a.active).length >= 50) return bad(res, 'Alert limit reached');
  const existing = mine(req).find((a) => a.key === p.key && a.active);
  if (existing) return res.json(view(existing));
  const a = {
    id: crypto.randomUUID(), device: req.device, ...p, basePrice: p.price,
    targetPrice: pos(req.body.targetPrice), active: true, createdAt: Date.now()
  };
  db.alerts.push(a);
  save();
  res.status(201).json(view(a));
});
app.delete('/api/alerts/:id', device, (req, res) => {
  db.alerts = db.alerts.filter((a) => !(a.id === req.params.id && a.device === req.device));
  save();
  res.json({ ok: true });
});

// In-app notifications (poll this) + optional browser push
app.get('/api/notifications', device, (req, res) => {
  const list = db.notifications[req.device] || [];
  if (req.query.clear) { db.notifications[req.device] = []; save(); }
  res.json(list);
});
app.get('/api/push/key', (_req, res) => res.json({ publicKey: vapidPublicKey() }));
app.post('/api/push/subscribe', device, (req, res) => {
  if (!req.body?.subscription?.endpoint) return bad(res, 'subscription required');
  db.push[req.device] = req.body.subscription;
  save();
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(err.status || 502).json({ error: err.message || 'Upstream error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`ShopSmart API on :${port}`));
const hours = Number(process.env.ALERT_INTERVAL_HOURS) || 6;
setInterval(() => checkAlerts().catch((e) => console.error('alerts', e.message)), hours * 3600_000);
