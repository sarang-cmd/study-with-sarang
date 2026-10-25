/**
 * Drift detection: noticing, without any AI, that you wandered off while a focus block runs.
 * Think of it as parental controls you set for yourself, with three layers that you can use on their own or together:
 *   1. Rules (always on when drift detection is on): the app in front, and for browsers the window title.
 *   2. The browser helper (optional extension for Brave, Chrome, Edge and others): the exact website of the open tab.
 *   3. An AI second opinion (optional, your own key): only for things the rules do not know.
 * Everything that decides lives here, so it can be tested without Windows or a browser.
 */
export type DriftCategoryId = 'social' | 'video' | 'games' | 'shopping' | 'news' | 'chat';
export interface DriftCategory { id: DriftCategoryId; label: string; hint: string; defaultOn: boolean; apps: string[]; sites: string[]; words: string[] }

export const DRIFT_CATEGORIES: DriftCategory[] = [
  { id: 'social', label: 'Social media', hint: 'Instagram, TikTok, Reddit and the like.', defaultOn: true,
    apps: ['instagram', 'tiktok', 'snapchat', 'facebook'],
    sites: ['instagram.com', 'tiktok.com', 'facebook.com', 'x.com', 'twitter.com', 'snapchat.com', 'reddit.com', 'pinterest.com', 'tumblr.com', 'threads.net', 'bsky.app', '9gag.com'],
    words: ['instagram', 'tiktok', 'facebook', 'reddit', 'twitter', 'snapchat', 'pinterest', 'tumblr', '9gag'] },
  { id: 'video', label: 'Video and streaming', hint: 'YouTube, Netflix, Twitch. Study videos are allowed through the study words below.', defaultOn: true,
    apps: ['netflix', 'plex', 'primevideo', 'disneyplus', 'twitch'],
    sites: ['youtube.com', 'youtu.be', 'netflix.com', 'twitch.tv', 'primevideo.com', 'disneyplus.com', 'hulu.com', 'crunchyroll.com', 'max.com', 'dailymotion.com'],
    words: ['youtube', 'netflix', 'twitch', 'prime video', 'disney+', 'crunchyroll'] },
  { id: 'games', label: 'Games', hint: 'Launchers, popular games and browser game sites.', defaultOn: true,
    apps: ['steam', 'steamwebhelper', 'epicgameslauncher', 'valorant', 'valorant-win64-shipping', 'leagueclient', 'league of legends', 'riotclientservices', 'fortniteclient-win64-shipping', 'minecraft', 'minecraftlauncher', 'robloxplayerbeta', 'roblox', 'genshinimpact', 'battle.net', 'dota2', 'cs2', 'overwatch', 'gta5', 'eldenring', 'rocketleague', 'apexlegends', 'r5apex', 'hearthstone', 'ubisoftconnect', 'origin', 'eadesktop', 'gog galaxy'],
    sites: ['roblox.com', 'store.steampowered.com', 'poki.com', 'crazygames.com', 'miniclip.com', 'kongregate.com', 'itch.io', 'chess.com', 'lichess.org'],
    words: ['steam', 'roblox', 'poki', 'crazygames', 'minecraft'] },
  { id: 'shopping', label: 'Shopping', hint: 'Online shops and deal sites.', defaultOn: false,
    apps: [], sites: ['amazon.com', 'amazon.de', 'ebay.com', 'ebay.de', 'aliexpress.com', 'temu.com', 'shein.com', 'zalando.de', 'vinted.de', 'otto.de', 'etsy.com'],
    words: ['amazon', 'ebay', 'aliexpress', 'temu', 'shein', 'zalando', 'vinted', 'etsy'] },
  { id: 'news', label: 'News and gossip', hint: 'News sites and feeds.', defaultOn: false,
    apps: [], sites: ['bild.de', 'spiegel.de', 'zeit.de', 'focus.de', 'tagesschau.de', 'cnn.com', 'bbc.com', 'bbc.co.uk', 'nytimes.com', 'theguardian.com', 'foxnews.com', 'dailymail.co.uk'],
    words: ['bild.de', 'spiegel', 'tagesschau', 'cnn', 'bbc news'] },
  { id: 'chat', label: 'Chat apps', hint: 'Off by default, because study groups use them too.', defaultOn: false,
    apps: ['whatsapp', 'telegram', 'signal', 'discord', 'messenger', 'slack', 'skype'],
    sites: ['web.whatsapp.com', 'web.telegram.org', 'discord.com', 'messenger.com', 'app.slack.com'],
    words: ['whatsapp', 'telegram', 'discord', 'messenger'] },
];

export const BROWSERS = ['brave', 'chrome', 'msedge', 'firefox', 'opera', 'operagx', 'vivaldi', 'arc', 'safari', 'zen', 'librewolf', 'duckduckgo', 'waterfox', 'chromium', 'thorium', 'google chrome', 'microsoft edge'];
/** Windows that mean nothing (the taskbar, the lock screen, switching windows). They neither start nor end a drift. */
export const NEUTRAL = ['explorer', 'searchhost', 'searchapp', 'startmenuexperiencehost', 'shellexperiencehost', 'lockapp', 'applicationframehost', 'textinputhost', 'taskmgr', 'dwm', 'finder', 'loginwindow', 'systemuiserver', 'dock'];
const OWN = ['study-with-sarang', 'study with sarang', 'studywithsarang', 'electron'];

export interface DriftSettings {
  enabled: boolean;
  focusOnly: boolean;        // Only while a focus block is running
  graceSec: number;          // How long you may stay before it counts (an alt-tab is not a drift)
  cooldownMin: number;       // Minimum time between two alerts
  categories: Partial<Record<DriftCategoryId, boolean>>;
  blockApps: string;         // Your own, comma separated
  blockSites: string;
  blockWords: string;        // Words in a window title that count as drift
  allowApps: string;         // Never drift
  allowSites: string;
  studyWords: string;        // A title with one of these words counts as study
  titleMatch: boolean;       // Use the window title of browsers when the helper is not connected
  // what to do
  onNote: boolean;           // Write a message in the notification list
  onSystem: boolean;         // Also show a system notification (it shows even when this window is hidden)
  onToast: boolean;
  onMark: boolean;           // Count it as a distraction in the block
  onPause: boolean;          // Pause the focus timer
  onChime: boolean;
  onSoundPause: boolean;     // Pause the soundscape
  // extension
  helper: boolean;           // Accept the browser helper
  port: number;
  token: string;
  // ai
  ai: boolean;
  aiSendTitle: boolean;      // Also send the window title (otherwise only the app name or website)
  aiPerHour: number;
}

export const DEFAULT_STUDY_WORDS = 'lecture, tutorial, lesson, course, khan academy, crash course, explained, revision, past paper, mark scheme, ib, igcse, gcse, a level, cbse, physics, chemistry, biology, mathematics, calculus, algebra';
export const DEFAULT_PORT = 47615;
const defaultCategories = () => Object.fromEntries(DRIFT_CATEGORIES.map((c) => [c.id, c.defaultOn])) as Record<DriftCategoryId, boolean>;

export const defaultDrift: DriftSettings = {
  enabled: false, focusOnly: true, graceSec: 20, cooldownMin: 3, categories: defaultCategories(),
  blockApps: '', blockSites: '', blockWords: '', allowApps: '', allowSites: '', studyWords: DEFAULT_STUDY_WORDS, titleMatch: true,
  onNote: true, onSystem: true, onToast: true, onMark: true, onPause: false, onChime: false, onSoundPause: false,
  helper: false, port: DEFAULT_PORT, token: '', ai: false, aiSendTitle: false, aiPerHour: 12,
};

const flag = (v: unknown, f: boolean) => (typeof v === 'boolean' ? v : f);
const num = (v: unknown, f: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : f);
const text = (v: unknown, f: string) => (typeof v === 'string' ? v.replace(/[^\p{L}\p{N} ,._\-+!/]/gu, '').slice(0, 800) : f);
export function sanitizeDrift(raw: unknown): DriftSettings {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = defaultDrift;
  const cr = r.categories && typeof r.categories === 'object' ? (r.categories as Record<string, unknown>) : {};
  const categories = defaultCategories();
  for (const c of DRIFT_CATEGORIES) if (typeof cr[c.id] === 'boolean') categories[c.id] = cr[c.id] as boolean;
  return {
    enabled: flag(r.enabled, d.enabled), focusOnly: flag(r.focusOnly, d.focusOnly), graceSec: num(r.graceSec, d.graceSec, 3, 600), cooldownMin: num(r.cooldownMin, d.cooldownMin, 1, 120), categories,
    blockApps: text(r.blockApps, d.blockApps), blockSites: text(r.blockSites, d.blockSites), blockWords: text(r.blockWords, d.blockWords),
    allowApps: text(r.allowApps, d.allowApps), allowSites: text(r.allowSites, d.allowSites), studyWords: text(r.studyWords, d.studyWords), titleMatch: flag(r.titleMatch, d.titleMatch),
    onNote: flag(r.onNote, d.onNote), onSystem: flag(r.onSystem, d.onSystem), onToast: flag(r.onToast, d.onToast), onMark: flag(r.onMark, d.onMark), onPause: flag(r.onPause, d.onPause), onChime: flag(r.onChime, d.onChime), onSoundPause: flag(r.onSoundPause, d.onSoundPause),
    helper: flag(r.helper, d.helper), port: num(r.port, d.port, 1024, 65535), token: typeof r.token === 'string' && /^[a-f0-9]{32,64}$/.test(r.token) ? r.token : '',
    ai: flag(r.ai, d.ai), aiSendTitle: flag(r.aiSendTitle, d.aiSendTitle), aiPerHour: num(r.aiPerHour, d.aiPerHour, 1, 120),
  };
}

export const splitList = (value: string) => value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
/** "Brave Browser.exe" and "brave" both become "brave". */
export const normApp = (name: string) => name.toLowerCase().replace(/\.exe$/, '').replace(/\.app$/, '').replace(/ browser$/, '').trim();
export const isBrowser = (app: string) => BROWSERS.includes(normApp(app));
export function normHost(value: string): string {
  let v = value.trim().toLowerCase();
  if (!v) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(v)) { try { v = new URL(v).hostname; } catch { return ''; } }
  v = v.replace(/^www\./, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  return /^[a-z0-9.-]+$/.test(v) ? v : '';
}
export const hostMatches = (host: string, site: string) => { const s = normHost(site); return !!s && !!host && (host === s || host.endsWith(`.${s}`)); };
const wordIn = (title: string, word: string) => { const w = word.trim().toLowerCase(); if (!w) return false; const t = title.toLowerCase(); if (/^[a-z0-9]+$/.test(w)) return new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(t); return t.includes(w); };

export interface Sample { src: 'window' | 'tab'; app: string; title: string; host: string; at: number; browser?: string }
export type Verdict = 'drift' | 'ok' | 'unknown' | 'neutral';
export interface Judgement { verdict: Verdict; label: string; category: string; why: string }

/** What one thing on the screen is. Pure. */
export function classify(s: { app: string; title: string; host: string; viaTab: boolean }, settings: DriftSettings, aiCache?: ReadonlyMap<string, 'drift' | 'ok'>): Judgement {
  const app = normApp(s.app); const host = normHost(s.host); const title = s.title ?? '';
  const label = host || app || 'unknown';
  if (!app && !host) return { verdict: 'neutral', label, category: '', why: 'nothing to judge' };
  if (OWN.some((own) => app.includes(own)) || NEUTRAL.includes(app)) return { verdict: app && OWN.some((own) => app.includes(own)) ? 'ok' : 'neutral', label, category: '', why: 'this app or the desktop' };
  if (splitList(settings.allowApps).includes(app)) return { verdict: 'ok', label, category: '', why: 'on your allowed apps' };
  if (host && splitList(settings.allowSites).some((site) => hostMatches(host, site))) return { verdict: 'ok', label, category: '', why: 'on your allowed sites' };
  const browser = isBrowser(app);
  const studyHit = splitList(settings.studyWords).find((word) => wordIn(title, word));
  if (studyHit && (browser || host)) return { verdict: 'ok', label, category: '', why: `the title has the study word "${studyHit}"` };
  if (splitList(settings.blockApps).includes(app)) return { verdict: 'drift', label, category: 'your list', why: 'on your blocked apps' };
  if (host && splitList(settings.blockSites).some((site) => hostMatches(host, site))) return { verdict: 'drift', label, category: 'your list', why: 'on your blocked sites' };
  const blockWord = splitList(settings.blockWords).find((word) => wordIn(title, word));
  if (blockWord) return { verdict: 'drift', label, category: 'your list', why: `the title has "${blockWord}"` };
  for (const c of DRIFT_CATEGORIES) {
    if (!settings.categories[c.id]) continue;
    if (c.apps.includes(app)) return { verdict: 'drift', label, category: c.label, why: `${c.label}: the app ${app}` };
    if (host && c.sites.some((site) => hostMatches(host, site))) return { verdict: 'drift', label, category: c.label, why: `${c.label}: the site ${host}` };
    if (browser && !s.viaTab && settings.titleMatch) { const w = c.words.find((word) => wordIn(title, word)); if (w) return { verdict: 'drift', label: w, category: c.label, why: `${c.label}: the window title mentions ${w} (best guess)` }; }
  }
  const cached = aiCache?.get(aiKey(app, host));
  if (cached) return { verdict: cached === 'drift' ? 'drift' : 'ok', label, category: cached === 'drift' ? 'AI second opinion' : '', why: 'the AI decided earlier' };
  return { verdict: 'unknown', label, category: '', why: 'not on any list' };
}
export const aiKey = (app: string, host: string) => (host ? `h:${normHost(host)}` : `a:${normApp(app)}`);

export interface DriftEvent { at: number; label: string; app: string; host: string; category: string; why: string; seconds: number; firstOfEpisode: boolean; source: 'rules' | 'helper' | 'ai' }

export interface TrackerDeps {
  now: () => number;
  settings: () => DriftSettings;
  focusActive: () => boolean;   // a focus block is running
  onDrift: (event: DriftEvent) => void;
  aiCache?: ReadonlyMap<string, 'drift' | 'ok'>;
  onUnknown?: (key: string, sample: { app: string; host: string; title: string }) => void;
}
const TAB_FRESH_MS = 90_000;

/** Turns a stream of samples into alerts: grace time, one alert per cooldown, one "episode" per stay. */
export function createDriftTracker(deps: TrackerDeps) {
  let win: Sample | null = null; let tab: Sample | null = null;
  let key = ''; let since = 0; let episode = 0; let lastAlert = 0; let alertedEpisode = -1; let last: Judgement = { verdict: 'neutral', label: '', category: '', why: '' };
  let viaTab = false; let asked = '';
  const allowed = new Set<string>();

  function current(): { app: string; title: string; host: string; viaTab: boolean } | null {
    if (!win && !tab) return null;
    const now = deps.now();
    const tabOk = tab && tab.host && now - tab.at <= TAB_FRESH_MS && deps.settings().helper;
    if (win && isBrowser(win.app)) return tabOk ? { app: win.app, title: win.title || tab!.title, host: tab!.host, viaTab: true } : { app: win.app, title: win.title, host: '', viaTab: false };
    if (win) return { app: win.app, title: win.title, host: '', viaTab: false };
    return tabOk ? { app: tab!.browser ?? 'browser', title: tab!.title, host: tab!.host, viaTab: true } : null;
  }

  function evaluate() {
    const s = deps.settings(); const now = deps.now();
    const cur = current();
    if (!s.enabled || !cur) { key = ''; since = 0; last = { verdict: 'neutral', label: '', category: '', why: '' }; return; }
    const j = classify(cur, s, deps.aiCache);
    viaTab = cur.viaTab;
    if (j.verdict === 'neutral') return; // The taskbar, the lock screen: keep what we had.
    const nextKey = `${normApp(cur.app)}|${normHost(cur.host)}|${j.verdict}`;
    if (nextKey !== key) { key = nextKey; since = now; episode += 1; asked = ''; }
    last = j;
    if (j.verdict === 'unknown' && deps.onUnknown && now - since >= s.graceSec * 1000 && asked !== key) { asked = key; deps.onUnknown(aiKey(cur.app, cur.host), { app: normApp(cur.app), host: normHost(cur.host), title: cur.title }); }
    if (j.verdict !== 'drift') return;
    if (now - since < s.graceSec * 1000) return;
    if (s.focusOnly && !deps.focusActive()) return;
    if (allowed.has(`${normApp(cur.app)}|${normHost(cur.host)}`)) return;
    if (lastAlert && now - lastAlert < s.cooldownMin * 60_000) return;
    lastAlert = now;
    const first = alertedEpisode !== episode; alertedEpisode = episode;
    deps.onDrift({ at: now, label: j.label, app: normApp(cur.app), host: normHost(cur.host), category: j.category, why: j.why, seconds: Math.round((now - since) / 1000), firstOfEpisode: first, source: j.category === 'AI second opinion' ? 'ai' : viaTab ? 'helper' : 'rules' });
  }

  return {
    feed(sample: Sample) { if (sample.src === 'tab') tab = sample; else win = sample; evaluate(); },
    clearTab() { tab = null; evaluate(); },
    tick: evaluate,
    /** "Allow this for now": this app or site no longer counts until the app restarts. */
    allowNow() { const cur = current(); if (cur) allowed.add(`${normApp(cur.app)}|${normHost(cur.host)}`); },
    allowedNow: () => [...allowed],
    resetAllowed() { allowed.clear(); },
    state: () => ({ judgement: last, since, key, viaTab, window: win, tab }),
    reset() { win = null; tab = null; key = ''; since = 0; lastAlert = 0; allowed.clear(); },
  };
}

// ---------------------------------------------------------------------------------------------- the AI second opinion
export function buildDriftPrompt(input: { app: string; host: string; title: string; subject: string; goal: string; sendTitle: boolean }): { system: string; user: string } {
  const system = 'You help a student stay focused. Decide whether what is on their screen is probably a distraction from studying. Judge only from the app name, website and optional title you are given. If it could plausibly be study material or a study tool, say it is not a distraction. Reply with JSON only: {"drift": true|false, "reason": "at most 12 words"}.';
  const lines = [`App: ${input.app || 'unknown'}`, input.host ? `Website: ${input.host}` : '', input.sendTitle && input.title ? `Window title: ${input.title.slice(0, 120)}` : '', input.subject ? `Studying: ${input.subject}` : '', input.goal ? `Goal for this block: ${input.goal.slice(0, 120)}` : ''].filter(Boolean);
  return { system, user: lines.join('\n') };
}
export function parseDriftReply(raw: string): { drift: boolean; reason: string } | null {
  const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { const p = JSON.parse(raw.slice(start, end + 1)) as { drift?: unknown; reason?: unknown }; if (typeof p.drift !== 'boolean') return null; return { drift: p.drift, reason: typeof p.reason === 'string' ? p.reason.replace(/[^\p{L}\p{N} ,.'\-]/gu, '').slice(0, 120) : '' }; } catch { return null; }
}
/** A rolling limit: at most `perHour` questions in any hour. */
export function createHourLimiter(perHour: () => number, now: () => number) {
  const stamps: number[] = [];
  return { allow() { const t = now(); while (stamps.length && t - stamps[0] > 3_600_000) stamps.shift(); if (stamps.length >= perHour()) return false; stamps.push(t); return true; } };
}

// ---------------------------------------------------------------------------------------------- the log
export interface DriftLogEntry { at: number; label: string; category: string; why: string; seconds: number; source: DriftEvent['source']; subject?: string }
const LOG = 'study-with-sarang:drift-log';
export const MAX_LOG = 300;
export function readDriftLog(): DriftLogEntry[] { try { const v = JSON.parse(localStorage.getItem(LOG) ?? '[]') as unknown; return Array.isArray(v) ? (v as DriftLogEntry[]).filter((e) => e && typeof e.at === 'number' && typeof e.label === 'string').slice(-MAX_LOG) : []; } catch { return []; } }
export function addDriftLog(entry: DriftLogEntry) { try { localStorage.setItem(LOG, JSON.stringify([...readDriftLog(), entry].slice(-MAX_LOG))); window.dispatchEvent(new Event('swa-drift-log')); } catch { /* Full storage. */ } }
export function clearDriftLog() { try { localStorage.removeItem(LOG); window.dispatchEvent(new Event('swa-drift-log')); } catch { /* Ignore. */ } }
/** "Instagram: 4 times, YouTube: 2 times", most common first. */
export function topDrifts(log: DriftLogEntry[], limit = 5): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of log) map.set(e.label, (map.get(e.label) ?? 0) + 1);
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}
export function randomToken(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes); else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
