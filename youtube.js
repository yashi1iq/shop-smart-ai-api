import { config } from './config.js';
import { TTLCache, createMemo } from './cache.js';
import { zrFetch } from './zenrows.js';

const memo = createMemo(new TTLCache(config.cacheMaxEntries));
const MAX = 6;

/** { videos: [{ videoId, title, channelTitle, thumbnail, duration, url }] } */
export async function youtubeReviews(q) {
  const key = 'yt:' + q.toLowerCase().replace(/\s+/g, ' ').trim();
  const { value, cached } = await memo(key, async () => {
    const videos = config.youtubeKey ? await viaApi(q) : await viaZenRows(q);
    /* do not cache an empty answer for long: it is usually a hiccup */
    return { value: videos, ttlMs: videos.length ? config.youtubeTtlMs : 10 * 60_000 };
  });
  return { videos: value, cached, source: config.youtubeKey ? 'youtube-api' : 'zenrows' };
}

/* ---------- official YouTube Data API v3 (preferred: free quota, stable) ---------- */
async function viaApi(q) {
  const s = new URLSearchParams({
    part: 'snippet', type: 'video', maxResults: String(MAX + 2), q: `${q} review`,
    videoDuration: 'medium', regionCode: 'IN', relevanceLanguage: 'en', safeSearch: 'moderate', key: config.youtubeKey,
  });
  const search = await getJson(`https://www.googleapis.com/youtube/v3/search?${s}`);
  const items = (search.items || []).filter((i) => i.id?.videoId);
  if (!items.length) return [];
  const d = new URLSearchParams({ part: 'contentDetails', id: items.map((i) => i.id.videoId).join(','), key: config.youtubeKey });
  const details = await getJson(`https://www.googleapis.com/youtube/v3/videos?${d}`).catch(() => ({ items: [] }));
  const dur = new Map((details.items || []).map((v) => [v.id, v.contentDetails?.duration]));
  return items.slice(0, MAX).map((i) => shape({
    videoId: i.id.videoId,
    title: i.snippet?.title,
    channelTitle: i.snippet?.channelTitle,
    thumbnail: i.snippet?.thumbnails?.high?.url || i.snippet?.thumbnails?.medium?.url,
    duration: dur.get(i.id.videoId), /* ISO 8601, e.g. PT12M4S; the frontend formats it */
  }));
}
async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`YouTube API returned ${r.status}`);
  return r.json();
}

/* ---------- fallback: scrape the results page through ZenRows ---------- */
async function viaZenRows(q) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' review')}&sp=EgIQAQ%253D%253D&hl=en&gl=IN`;
  /* YouTube is easy to fetch, so no premium proxy and no JS rendering: about 1 credit. */
  const html = await zrFetch(url, { js: false, premium: false, deadline: Date.now() + 25000 });
  const data = extractInitialData(html);
  if (!data) return [];
  const found = [];
  walk(data, (n) => {
    const v = n.videoRenderer;
    if (v?.videoId && found.length < MAX + 4) found.push(v);
  });
  return found
    .map((v) => ({
      videoId: v.videoId,
      title: v.title?.runs?.map((r) => r.text).join('') || v.title?.simpleText,
      channelTitle: v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text,
      thumbnail: v.thumbnail?.thumbnails?.slice(-1)[0]?.url,
      duration: v.lengthText?.simpleText, /* "12:04" */
    }))
    .filter((v) => v.duration) /* live streams have no length */
    .slice(0, MAX)
    .map(shape);
}

function extractInitialData(html) {
  const m = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}
function walk(node, fn, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 14) return;
  if (Array.isArray(node)) { for (const x of node) walk(x, fn, depth + 1); return; }
  fn(node);
  for (const k of Object.keys(node)) walk(node[k], fn, depth + 1);
}

function shape(v) {
  return {
    videoId: v.videoId,
    title: v.title || 'Review video',
    channelTitle: v.channelTitle || '',
    thumbnail: v.thumbnail?.startsWith('//') ? 'https:' + v.thumbnail : v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    duration: v.duration || null,
    url: `https://www.youtube.com/watch?v=${v.videoId}`,
  };
}
