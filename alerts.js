import webpush from 'web-push';
import db, { save } from './store.js';
import { searchAll } from './search.js';

const pushOn = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (pushOn) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}
export const vapidPublicKey = () => (pushOn ? process.env.VAPID_PUBLIC_KEY : null);

function notify(a, hit) {
  const n = {
    id: a.id,
    title: 'Price drop',
    body: `${a.title.slice(0, 80)} is now ₹${hit.price.toLocaleString('en-IN')} on ${hit.store}`,
    url: hit.url,
    at: Date.now()
  };
  (db.notifications[a.device] ||= []).push(n);
  const sub = db.push[a.device];
  if (pushOn && sub) {
    webpush.sendNotification(sub, JSON.stringify(n)).catch((e) => {
      if (e.statusCode === 404 || e.statusCode === 410) delete db.push[a.device];
    });
  }
}

// One search per distinct query keeps ScrapingBee credit use low.
export async function checkAlerts() {
  const groups = {};
  for (const a of db.alerts.filter((x) => x.active)) (groups[a.query] ||= []).push(a);
  for (const [query, list] of Object.entries(groups)) {
    let items;
    try { items = await searchAll(query); } catch { continue; }
    for (const a of list) {
      const hit = items.find((i) => i.key === a.key);
      if (!hit) continue;
      a.lastPrice = hit.price;
      a.lastChecked = Date.now();
      const triggered = a.targetPrice ? hit.price <= a.targetPrice : hit.price < a.basePrice;
      if (triggered) { a.active = false; a.triggeredPrice = hit.price; notify(a, hit); }
    }
  }
  save();
}
