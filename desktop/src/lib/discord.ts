/**
 * Discord Rich Presence (desktop only, off by default). It shows what you choose on your own Discord profile while
 * Discord is open on the same computer. The app talks to the Discord app on your PC, nothing goes to any server of ours.
 * You create the presence "application" yourself (free, Discord Developer Portal) so the name on your profile is yours.
 */
export interface DiscordSettings {
  enabled: boolean;
  appId: string;        // Advanced: your own Application ID. Empty uses the one built into the app, so there is nothing to set up.
  showMix: boolean;     // The name of the mix that is playing
  showTask: boolean;    // What you are working on, from the timer
  showTimer: boolean;   // A live countdown or elapsed clock
  showIdle: boolean;    // Keep a "Resting" status when nothing is playing
  showBreaks: boolean;  // Keep the status during timer breaks (off clears it, so breaks stay private)
  showCycle: boolean;   // "Block 2 of 4" next to the mix
  imageKey: string;     // Name of the picture under Rich Presence > Art Assets. Blank for none.
  largeText: string;    // The caption shown when someone hovers the picture
  smallImageKey: string; smallText: string; // An optional second, small picture (your own application only)
  activityType: 0 | 2 | 3; // 0 Playing (default), 2 Listening to, 3 Watching. Discord may show unsupported ones as Playing.
  customDetails: string; customState: string; // Your own wording. Placeholders: {mix} {task} {phase} {block} {blocks}
  buttonLabel: string; buttonUrl: string;     // One optional button (other people see it, you do not)
}
/** The Application ID built into the app. It names the status "Study with Sarang" and carries the app picture ("icon"). */
export const DEFAULT_APP_ID = '1557093339407458364';
export const defaultDiscord: DiscordSettings = {
  enabled: false, appId: '', showMix: true, showTask: false, showTimer: true, showIdle: false, showBreaks: true, showCycle: false,
  imageKey: 'icon', largeText: 'Study with Sarang', smallImageKey: '', smallText: '', activityType: 0, customDetails: '', customState: '', buttonLabel: '', buttonUrl: '',
};

/** The app logo as Discord shows it: the same picture as the window, tray and notifications (your chosen icon), loaded from the website. */
export const DISCORD_ART_BASE = 'https://study-with-sarang.vercel.app/';
export const discordArtUrl = (iconId = 'default') => `${DISCORD_ART_BASE}icons/${/^[a-z]+$/.test(iconId) ? iconId : 'default'}/art-512.png`;
export const isAppId = (value: string) => /^\d{17,20}$/.test(value.trim());
/** Your own ID if you entered one, otherwise the built-in one. */
export const effectiveAppId = (settings: Pick<DiscordSettings, 'appId'>) => (isAppId(settings.appId) ? settings.appId.trim() : DEFAULT_APP_ID);
export const usingOwnApp = (settings: Pick<DiscordSettings, 'appId'>) => isAppId(settings.appId) && settings.appId.trim() !== DEFAULT_APP_ID;

const plain = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
export const cleanButtonUrl = (v: unknown) => { const u = plain(v, 512); try { const url = new URL(u); return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : ''; } catch { return ''; } };

export function sanitizeDiscord(raw: unknown): DiscordSettings {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
  const d = defaultDiscord;
  const appId = typeof r.appId === 'string' ? r.appId.replace(/\D/g, '').slice(0, 20) : d.appId;
  return {
    enabled: flag(r.enabled, d.enabled),
    appId: appId === DEFAULT_APP_ID ? '' : appId,
    showMix: flag(r.showMix, d.showMix), showTask: flag(r.showTask, d.showTask), showTimer: flag(r.showTimer, d.showTimer), showIdle: flag(r.showIdle, d.showIdle),
    showBreaks: flag(r.showBreaks, d.showBreaks), showCycle: flag(r.showCycle, d.showCycle),
    imageKey: typeof r.imageKey === 'string' ? r.imageKey.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32) : d.imageKey,
    largeText: typeof r.largeText === 'string' ? plain(r.largeText, 64) : d.largeText,
    smallImageKey: typeof r.smallImageKey === 'string' ? r.smallImageKey.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32) : d.smallImageKey,
    smallText: plain(r.smallText, 64),
    activityType: r.activityType === 2 || r.activityType === 3 ? r.activityType : 0,
    customDetails: plain(r.customDetails, 60), customState: plain(r.customState, 60),
    buttonLabel: plain(r.buttonLabel, 32), buttonUrl: cleanButtonUrl(r.buttonUrl),
  };
}

export interface PresenceInput {
  playing: boolean;
  mixName: string;
  timerRunning: boolean;
  timerMode: 'pomodoro' | 'countdown' | 'stopwatch';
  phase: 'focus' | 'short' | 'long';
  seconds: number;  // Remaining (pomodoro, countdown) or elapsed (stopwatch)
  task: string;
  cycle?: number;   // The block you are on, starting at 1
  cycles?: number;  // Blocks before a long break
}
export interface DiscordActivity {
  type?: 0 | 2 | 3;
  details: string;
  state?: string;
  timestamps?: { start?: number; end?: number };
  assets?: { large_image?: string; large_text?: string; small_image?: string; small_text?: string };
  buttons?: { label: string; url: string }[];
}

const clip = (text: string, max = 100) => { const t = text.replace(/\s+/g, ' ').trim(); return t.length > max ? `${t.slice(0, max - 1)}\u2026` : t; };

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(mix|task|phase|block|blocks)\}/g, (_, k: string) => values[k] ?? '').replace(/\s+/g, ' ').replace(/\s*\u00b7\s*$/, '').trim();

/** What to show. Returns null to clear the status. Only what the privacy toggles allow ever leaves this function. */
export function buildActivity(settings: DiscordSettings, input: PresenceInput, now = Date.now(), iconId = 'default'): DiscordActivity | null {
  if (!settings.enabled) return null;
  const active = input.playing || input.timerRunning;
  if (!active && !settings.showIdle) return null;
  const breakPhase = input.phase !== 'focus' && input.timerMode === 'pomodoro';
  if (breakPhase && input.timerRunning && !settings.showBreaks) return null;
  const mix = active && settings.showMix && input.playing ? clip(input.mixName, 60) : '';
  const task = active && settings.showTask && input.timerRunning && !breakPhase ? clip(input.task, 60) : '';
  const phase = !active ? 'Resting' : input.timerRunning ? (breakPhase ? 'Taking a break' : 'Focusing') : 'Listening to ambient sound';
  const values = { mix, task, phase, block: input.cycle ? String(input.cycle) : '', blocks: input.cycles ? String(input.cycles) : '' };
  const details = (settings.customDetails && fill(settings.customDetails, values)) || phase;
  const activity: DiscordActivity = { details: clip(details, 100) };
  if (settings.activityType) activity.type = settings.activityType;
  let state = '';
  if (settings.customState) state = fill(settings.customState, values);
  else {
    const parts: string[] = [];
    if (mix) parts.push(mix);
    if (task) parts.push(task);
    if (active && settings.showCycle && input.timerRunning && input.timerMode === 'pomodoro' && !breakPhase && input.cycle && input.cycles) parts.push(`Block ${input.cycle} of ${input.cycles}`);
    state = parts.join(' \u00b7 ');
  }
  if (state) activity.state = clip(state, 100);
  if (active && settings.showTimer && input.timerRunning) {
    const ms = Math.max(0, input.seconds) * 1000;
    activity.timestamps = input.timerMode === 'stopwatch' ? { start: Math.floor((now - ms) / 1000) } : { end: Math.floor((now + ms) / 1000) };
  }
  const assets: NonNullable<DiscordActivity['assets']> = {};
  if (settings.imageKey) { assets.large_image = settings.imageKey === 'icon' && !usingOwnApp(settings) ? discordArtUrl(iconId) : settings.imageKey; assets.large_text = clip(settings.largeText || 'Study with Sarang', 64); }
  if (settings.smallImageKey) { assets.small_image = settings.smallImageKey; if (settings.smallText) assets.small_text = clip(settings.smallText, 64); }
  if (Object.keys(assets).length) activity.assets = assets;
  if (settings.buttonLabel && settings.buttonUrl) activity.buttons = [{ label: settings.buttonLabel, url: settings.buttonUrl }];
  return activity;
}

/** Identity of an activity, ignoring the clock, so the app only sends an update when something visible changed. */
export const activityKey = (activity: DiscordActivity | null) => (activity ? JSON.stringify({ ...activity, timestamps: activity.timestamps ? Object.keys(activity.timestamps) : null }) : 'none');
