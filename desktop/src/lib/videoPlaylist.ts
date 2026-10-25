export interface VideoItem {
  id: string;
  title: string;
  url: string;
  kind: 'youtube' | 'video' | 'local';
  videoId?: string;
}
export const PLAYLIST_KEY = 'study-with-sarang:video-playlist';
export const PLAYER_STATE_KEY = 'study-with-sarang:video-controls';
export const PLAYLIST_EVENT = 'sws:playlist-replaced';
export const SOURCE_PLAYLIST = 'https://www.youtube.com/playlist?list=PLUh7Kk4TLS8E';

// The same 10-video study playlist as the original Sarang.md focus studio. These
// are YouTube embeds, not bundled video files. Titles are short descriptive
// labels, not licensing statements.
const seeded: [string, string][] = [
  ['74cOUSKXMz0', 'iCanStudy · 3-hour hyper-efficient study with me'],
  ['sdhh7AYzsTY', 'iCanStudy · 1.5-hour deep-work session'],
  ['382OExOIipQ', 'Justin Sung · 2-hour deep-work session'],
  ['UXwJ9RwdyHs', 'Work With Paul · 3-hour hyperfocus'],
  ['sa61rE36264', "Sora's Treehouse Study · rainy forest"],
  ['IdjDjxNn9ws', 'StudyMD · sunset piano study'],
  ['Q-rJe-jnpQw', 'Merve · rain sounds and background noise'],
  ['eIoHJBA43lk', "Sora's Treehouse Study · forest rain"],
  ['hSW0i79Db1o', 'tani study · five-hour lofi session'],
  ['sUwD3GRPJos', 'Abao in Tokyo · Yokohama harbor sunset'],
];
export function defaultVideoPlaylist(): VideoItem[] {
  return seeded.map(([videoId, title]) => ({ id: `default-${videoId}`, videoId, title,
    url: `https://www.youtube.com/watch?v=${videoId}`, kind: 'youtube' }));
}

export function parseVideoLink(raw: string): Pick<VideoItem, 'url' | 'kind' | 'videoId'> | null {
  try {
    const link = new URL(raw.trim());
    if (link.protocol !== 'https:' || link.username || link.password || link.hash) return null;
    const host = link.hostname.toLowerCase();
    let id: string | null = null;
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'].includes(host)) {
      if (link.pathname === '/watch') id = link.searchParams.get('v');
      else if (/^\/(?:embed|shorts)\//.test(link.pathname)) id = link.pathname.split('/')[2];
    } else if (host === 'youtu.be' || host === 'www.youtu.be') id = link.pathname.slice(1);
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return { url: link.href, kind: 'youtube', videoId: id };
    if (/\.(mp4|webm|ogg)$/i.test(link.pathname)) return { url: link.href, kind: 'video' };
  } catch { /* Reject invalid and unsafe links. */ }
  return null;
}

export function sanitizePlaylist(stored: unknown): VideoItem[] | null {
  if (!Array.isArray(stored)) return null;
  return stored.slice(0, 30).flatMap((entry) => {
    if (!entry || typeof entry.id !== 'string' || typeof entry.url !== 'string' || typeof entry.title !== 'string') return [];
    const parsed = parseVideoLink(entry.url);
    return parsed ? [{ id: entry.id.slice(0, 90), title: entry.title.slice(0, 80), ...parsed }] : [];
  });
}

export function readVideoPlaylist(): VideoItem[] {
  try {
    const raw = localStorage.getItem(PLAYLIST_KEY);
    if (raw === null) return defaultVideoPlaylist();
    return sanitizePlaylist(JSON.parse(raw)) ?? defaultVideoPlaylist();
  } catch { return defaultVideoPlaylist(); }
}
