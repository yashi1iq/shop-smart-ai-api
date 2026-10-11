import { cfg } from './config.js';
import { Skip, fetchJson } from './util.js';
import { spend } from './budget.js';

const iso = d => { const m = String(d || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : null; };

/* search.list costs 100 quota units, videos.list 1 unit. Results are cached 24h, and a daily unit cap protects the quota. */
export async function youtubeReviews(q) {
  const y = cfg.youtube;
  if (!y.key) throw new Skip('YOUTUBE_API_KEY not set');
  if (!spend('youtube', 101, y.dailyUnits)) throw new Skip('daily YouTube quota cap reached');
  const s = new URL(y.base + '/search');
  Object.entries({ part: 'snippet', type: 'video', maxResults: 6, regionCode: 'IN', relevanceLanguage: 'en', safeSearch: 'moderate', q: q + ' review', key: y.key }).forEach(([k, v]) => s.searchParams.set(k, v));
  const j = await fetchJson(s.href);
  const items = (j.items || []).filter(i => i.id?.videoId);
  if (!items.length) return [];
  let dur = {};
  try {
    const v = new URL(y.base + '/videos');
    Object.entries({ part: 'contentDetails', id: items.map(i => i.id.videoId).join(','), key: y.key }).forEach(([k, x]) => v.searchParams.set(k, x));
    (await fetchJson(v.href)).items?.forEach(i => { dur[i.id] = iso(i.contentDetails?.duration); });
  } catch { /* durations are optional */ }
  return items.map(i => ({
    videoId: i.id.videoId, title: i.snippet.title, channelTitle: i.snippet.channelTitle,
    thumbnail: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url || null,
    duration: dur[i.id.videoId] ?? null, url: 'https://www.youtube.com/watch?v=' + i.id.videoId
  }));
}
