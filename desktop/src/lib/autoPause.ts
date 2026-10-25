/**
 * Auto-pause: optional, off by default. The sound keeps playing while you watch videos or listen to anything else.
 * Turn this on and the app reacts when you record, take a call or play something in another app.
 *
 * The desktop shell reports raw facts (which apps use the microphone, which recorders run, which apps play media).
 * Everything that decides what to do with them lives here, so it can be tested without Windows.
 */
export interface AutoPauseSettings {
  enabled: boolean;
  onMic: boolean;           // Another app is using the microphone: calls, dictation, recording
  onRecorder: boolean;      // Recording or streaming software is open
  onMedia: boolean;         // Another app is playing media (a video in a browser or player)
  action: 'pause' | 'lower';
  lowerTo: number;          // Percent of the current volume to keep when lowering (0 to 80)
  delaySec: number;         // Wait this long before acting, so a short notification sound does nothing
  resume: boolean;          // Pause only: start again when it ends (only if the app paused it)
  resumeDelaySec: number;   // Wait this long before resuming or restoring volume
  toast: boolean;           // Say what happened
  ignoreApps: string;       // Comma separated names of apps that never trigger it (music players, for example)
  recorders: string;        // Comma separated process names of recording software
}

export const DEFAULT_RECORDERS = 'obs64, obs32, obs, streamlabs obs, slobs, camtasia, camtasiarecorder, bandicam, xsplit, medal, outplayed, screenrec, loom, screenpresso, sharex';
export const DEFAULT_IGNORE = 'spotify, zunemusic, applemusic, itunes, tidal, deezer, musicbee, foobar2000, winamp';

export const defaultAutoPause: AutoPauseSettings = {
  enabled: false, onMic: true, onRecorder: true, onMedia: true, action: 'pause', lowerTo: 20, delaySec: 2,
  resume: true, resumeDelaySec: 4, toast: true, ignoreApps: DEFAULT_IGNORE, recorders: DEFAULT_RECORDERS,
};

const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
const num = (value: unknown, fallback: number, min: number, max: number) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback);
const list = (value: unknown, fallback: string) => (typeof value === 'string' ? value.replace(/[^\p{L}\p{N} ,._\-!]/gu, '').slice(0, 600) : fallback);

export function sanitizeAutoPause(raw: unknown): AutoPauseSettings {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = defaultAutoPause;
  return {
    enabled: flag(r.enabled, d.enabled), onMic: flag(r.onMic, d.onMic), onRecorder: flag(r.onRecorder, d.onRecorder), onMedia: flag(r.onMedia, d.onMedia),
    action: r.action === 'lower' ? 'lower' : 'pause', lowerTo: num(r.lowerTo, d.lowerTo, 0, 80), delaySec: num(r.delaySec, d.delaySec, 0, 30),
    resume: flag(r.resume, d.resume), resumeDelaySec: num(r.resumeDelaySec, d.resumeDelaySec, 0, 120), toast: flag(r.toast, d.toast),
    ignoreApps: list(r.ignoreApps, d.ignoreApps), recorders: list(r.recorders, d.recorders),
  };
}

/** What the desktop shell sees. Names are as Windows reports them. */
export interface ActivityState { mic: string[]; recorders: string[]; media: string[] }
export const emptyActivity: ActivityState = { mic: [], recorders: [], media: [] };

export const splitList = (text: string) => text.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);

/** Names of apps that belong to this app or to its helpers. They never count. */
const OWN = ['study-with-sarang', 'study with sarang', 'studywithsarang', 'com.sarang', 'powershell', 'electron'];
/** "C:#Program Files#Zoom#bin#Zoom.exe" (how Windows stores it) or "Pkg_123!App" becomes "Zoom" or "App". */
const friendly = (name: string) => {
  const unpacked = name.replace(/#/g, '\\');
  const afterBang = unpacked.includes('!') ? unpacked.slice(unpacked.lastIndexOf('!') + 1) : unpacked;
  return afterBang.replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').trim() || name;
};
const isOwn = (name: string) => OWN.some((own) => name.toLowerCase().includes(own));
const ignored = (name: string, ignore: string[]) => ignore.some((entry) => name.toLowerCase().includes(entry));

/** Short reasons, one per cause, for the toast and the settings page. Empty means nothing to react to. */
export function activeReasons(settings: AutoPauseSettings, activity: ActivityState): string[] {
  if (!settings.enabled) return [];
  const ignore = splitList(settings.ignoreApps);
  const keep = (names: string[]) => names.filter((name) => name && !isOwn(name) && !ignored(name, ignore));
  const out: string[] = [];
  if (settings.onMic) { const apps = keep(activity.mic); if (apps.length) out.push(`${friendly(apps[0])} is using the microphone`); }
  if (settings.onRecorder) { const wanted = splitList(settings.recorders); const apps = activity.recorders.filter((name) => wanted.includes(name.toLowerCase()) && !ignored(name, ignore)); if (apps.length) out.push(`${friendly(apps[0])} is open`); }
  if (settings.onMedia) { const apps = keep(activity.media); if (apps.length) out.push(`${friendly(apps[0])} is playing media`); }
  return out;
}

export type AutoPauseStep = 'pause' | 'lower' | 'resume' | 'restore' | null;

/**
 * The timing rules, with no clock and no audio of its own. Call step() about once a second.
 *  - Acts only after the cause has lasted delaySec.
 *  - Resumes only what it paused itself, and only when resume is on.
 *  - If you press play while it is holding the sound, your choice wins until the cause goes away.
 */
export class AutoPauseMachine {
  private since: number | null = null;
  private clearSince: number | null = null;
  private overridden = false;
  held: 'none' | 'paused' | 'lowered' = 'none';

  step(now: number, settings: AutoPauseSettings, wanted: boolean, playing: boolean): AutoPauseStep {
    if (!settings.enabled) return this.release(settings, true);
    if (wanted) {
      this.clearSince = null;
      if (this.held === 'paused' && playing) { this.held = 'none'; this.overridden = true; }
      if (this.held !== 'none' || this.overridden) return null;
      if (!playing) { this.since = null; return null; }
      if (this.since === null) this.since = now;
      if (now - this.since < settings.delaySec * 1000) return null;
      this.held = settings.action === 'lower' ? 'lowered' : 'paused';
      this.since = null;
      return settings.action === 'lower' ? 'lower' : 'pause';
    }
    this.since = null; this.overridden = false;
    if (this.held === 'none') { this.clearSince = null; return null; }
    if (this.clearSince === null) this.clearSince = now;
    if (now - this.clearSince < settings.resumeDelaySec * 1000) return null;
    return this.release(settings, false);
  }

  private release(settings: AutoPauseSettings, off: boolean): AutoPauseStep {
    const held = this.held;
    this.held = 'none'; this.since = null; this.clearSince = null; if (off) this.overridden = false;
    if (held === 'lowered') return 'restore';
    if (held === 'paused') return settings.resume || off ? 'resume' : null;
    return null;
  }
}
