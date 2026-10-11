const link = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' review')}`;
const fallback = (q) => [{ title: `${q} review videos`, channel: 'YouTube', type: 'Search', thumbnail: null, url: link(q) }];

export async function youtubeReviews(q) {
  if (!process.env.YOUTUBE_API_KEY) return fallback(q);
  try {
    const u = new URL('https://www.googleapis.com/youtube/v3/search');
    u.search = new URLSearchParams({
      part: 'snippet', q: `${q} review`, type: 'video', maxResults: '4',
      regionCode: 'IN', key: process.env.YOUTUBE_API_KEY
    });
    const j = await (await fetch(u, { signal: AbortSignal.timeout(10000) })).json();
    const items = (j.items || []).map((v) => ({
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      type: /unbox/i.test(v.snippet.title) ? 'Unboxing' : /\bvs\b|compar/i.test(v.snippet.title) ? 'Comparison' : 'Review',
      thumbnail: v.snippet.thumbnails?.medium?.url || null,
      url: `https://www.youtube.com/watch?v=${v.id.videoId}`
    }));
    return items.length ? items : fallback(q);
  } catch {
    return fallback(q);
  }
}
