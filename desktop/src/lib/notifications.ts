import { desktop } from './desktop';
import { getPrefs } from './prefs';

/**
 * The notification centre: a short history of what the app told you (unlocks, goals, reminders, drift, AI, updates),
 * so a message that faded away is never lost. It lives on this device only.
 */
export type NoteKind = 'achievement' | 'goal' | 'timer' | 'reminder' | 'drift' | 'ai' | 'system' | 'info';
export const NOTE_KINDS: { id: NoteKind; label: string; hint: string }[] = [
  { id: 'achievement', label: 'Achievements', hint: 'Badges you unlock.' },
  { id: 'goal', label: 'Goals and to-dos', hint: 'Session goals reached, to-dos finished, daily goal.' },
  { id: 'timer', label: 'Timer', hint: 'Blocks finished and breaks.' },
  { id: 'reminder', label: 'Reminders', hint: 'Calendar and study reminders.' },
  { id: 'drift', label: 'Drift', hint: 'Gentle nudges when you wander off.' },
  { id: 'ai', label: 'AI and Flow', hint: 'Answers and actions from the assistant.' },
  { id: 'system', label: 'App and updates', hint: 'Updates, sync, devices and errors.' },
  { id: 'info', label: 'Everything else', hint: 'Small confirmations.' },
];
export interface Note { id: string; at: number; kind: NoteKind; title: string; message: string; read: boolean; tier?: number; icon?: string; key?: string }
export type Celebrate = 'off' | 'subtle' | 'full';
export interface QuietHours { on: boolean; from: number; to: number } // minutes after midnight
export interface NotifySettings {
  celebrate: Celebrate;            // How an unlocked achievement is shown
  celebrateSeconds: number;        // How long the unlock card stays
  osAlerts: boolean;               // Also show a system notification while the app is in the background
  osWhen: 'away' | 'always';       // Away: only when this window is not the one you are using. Always: every time.
  history: number;                 // How many to keep
  kinds: Record<NoteKind, boolean>; // Which kinds are kept in the list
  quiet: QuietHours;               // No pop-ups and no sound in these hours (they are still listed)
  badge: boolean;                  // Unread number on the bell
}
export const defaultNotify: NotifySettings = {
  celebrate: 'full', celebrateSeconds: 7, osAlerts: true, osWhen: 'away', history: 100,
  kinds: { achievement: true, goal: true, timer: true, reminder: true, drift: true, ai: true, system: true, info: false },
  quiet: { on: false, from: 22 * 60, to: 7 * 60 }, badge: true,
};
const flag = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const int = (v: unknown, min: number, max: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : d);
export function sanitizeNotify(raw: unknown): NotifySettings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const d = defaultNotify;
  const k = r.kinds && typeof r.kinds === 'object' ? (r.kinds as Record<string, unknown>) : {};
  const q = r.quiet && typeof r.quiet === 'object' ? (r.quiet as Record<string, unknown>) : {};
  return {
    celebrate: r.celebrate === 'off' || r.celebrate === 'subtle' ? r.celebrate : r.celebrate === 'full' ? 'full' : d.celebrate,
    celebrateSeconds: int(r.celebrateSeconds, 3, 20, d.celebrateSeconds), osAlerts: flag(r.osAlerts, d.osAlerts), osWhen: r.osWhen === 'always' ? 'always' : 'away', history: int(r.history, 20, 500, d.history),
    kinds: Object.fromEntries(NOTE_KINDS.map(({ id }) => [id, flag(k[id], d.kinds[id])])) as Record<NoteKind, boolean>,
    quiet: { on: flag(q.on, d.quiet.on), from: int(q.from, 0, 1439, d.quiet.from), to: int(q.to, 0, 1439, d.quiet.to) },
    badge: flag(r.badge, d.badge),
  };
}

export function isQuiet(quiet: QuietHours, now = new Date()): boolean {
  if (!quiet.on || quiet.from === quiet.to) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return quiet.from < quiet.to ? minutes >= quiet.from && minutes < quiet.to : minutes >= quiet.from || minutes < quiet.to;
}
export const minutesLabel = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export function parseMinutes(text: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim()); if (!m) return fallback;
  const h = Number(m[1]), min = Number(m[2]); return h < 24 && min < 60 ? h * 60 + min : fallback;
}

// ---- the list ---------------------------------------------------------------------------------------
const KEY = 'study-with-sarang:notifications';
export function sanitizeNotes(raw: unknown, limit = 500): Note[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(NOTE_KINDS.map((k) => k.id)); const seen = new Set<string>(); const out: Note[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const n = item as Record<string, unknown>;
    if (typeof n.id !== 'string' || seen.has(n.id) || typeof n.at !== 'number' || !Number.isFinite(n.at)) continue;
    seen.add(n.id);
    out.push({
      id: n.id.slice(0, 60), at: n.at, kind: known.has(n.kind as NoteKind) ? (n.kind as NoteKind) : 'info',
      title: typeof n.title === 'string' ? n.title.slice(0, 120) : '', message: typeof n.message === 'string' ? n.message.slice(0, 400) : '',
      read: n.read === true, tier: typeof n.tier === 'number' ? int(n.tier, 1, 4, 1) : undefined, icon: typeof n.icon === 'string' ? n.icon.slice(0, 30) : undefined,
      key: typeof n.key === 'string' ? n.key.slice(0, 60) : undefined,
    });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}

let notes: Note[] = [];
let settings: NotifySettings = { ...defaultNotify };
try { if (typeof localStorage !== 'undefined') { const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null'); notes = sanitizeNotes(raw?.notes); settings = sanitizeNotify(raw?.settings); } } catch { /* Start empty. */ }
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
function save() { try { localStorage.setItem(KEY, JSON.stringify({ notes, settings })); } catch { /* Kept for this visit. */ } }
export const subscribeNotes = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getNotes = () => notes;
export const getNotifySettings = () => settings;
export function setNotifySettings(patch: Partial<NotifySettings>) { settings = sanitizeNotify({ ...settings, ...patch }); notes = notes.slice(0, settings.history); save(); emit(); }
export const unreadCount = (list: Note[] = notes) => list.filter((n) => !n.read).length;

let counter = 0;
export interface NewNote { kind: NoteKind; title: string; message: string; tier?: number; icon?: string; key?: string }
/** Adds to the list unless that kind is switched off, or the same message was just added. Returns the note, or null. */
export function addNote(input: NewNote, at = Date.now()): Note | null {
  if (!settings.kinds[input.kind]) return null;
  const dupe = notes.find((n) => n.key && n.key === input.key && n.message === input.message && at - n.at < 60_000);
  if (dupe) return null;
  const note: Note = { id: `${at.toString(36)}-${(counter++).toString(36)}`, at, read: false, kind: input.kind, title: input.title.slice(0, 120), message: input.message.slice(0, 400), tier: input.tier, icon: input.icon, key: input.key };
  notes = [note, ...notes].sort((a, b) => b.at - a.at).slice(0, settings.history);
  save(); emit();
  return note;
}
export function markRead(id: string, read = true) { notes = notes.map((n) => (n.id === id ? { ...n, read } : n)); save(); emit(); }
export function markAllRead() { if (!unreadCount()) return; notes = notes.map((n) => ({ ...n, read: true })); save(); emit(); }
export function removeNote(id: string) { notes = notes.filter((n) => n.id !== id); save(); emit(); }
export function clearNotes(kind?: NoteKind) { notes = kind ? notes.filter((n) => n.kind !== kind) : []; save(); emit(); }
export function resetNotesForTest() { notes = []; settings = { ...defaultNotify }; emit(); }

export type NoteFilter = 'all' | 'unread' | NoteKind;
export const filterNotes = (list: Note[], filter: NoteFilter) => list.filter((n) => (filter === 'all' ? true : filter === 'unread' ? !n.read : n.kind === filter));
/** "Today", "Yesterday", or a date, for grouping the list. */
export function dayLabel(at: number, now = new Date()): string {
  const d = new Date(at); const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((b - a) / 86_400_000);
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
export function groupByDay(list: Note[], now = new Date()): { label: string; items: Note[] }[] {
  const out: { label: string; items: Note[] }[] = [];
  for (const n of list) { const label = dayLabel(n.at, now); const last = out[out.length - 1]; if (last?.label === label) last.items.push(n); else out.push({ label, items: [n] }); }
  return out;
}
export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`; if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ---- unlock celebration bus -------------------------------------------------------------------------
export interface CelebrateItem { id: string; title: string; text: string; icon: string; tier: 1 | 2 | 3 | 4; category?: string }
const celebrants = new Set<(items: CelebrateItem[]) => void>();
let waiting: CelebrateItem[] = []; // unlocks that happened before the card was mounted (a start-up unlock) are shown once it is
export const onCelebrate = (fn: (items: CelebrateItem[]) => void) => { celebrants.add(fn); if (waiting.length) { const items = waiting; waiting = []; fn(items); } return () => { celebrants.delete(fn); }; };
export const celebrate = (items: CelebrateItem[]) => { if (!items.length) return; if (!celebrants.size) { waiting = [...waiting, ...items].slice(-20); return; } celebrants.forEach((fn) => fn(items)); };

/** A system notification when the app is in the background (the desktop shell shows its own; a browser needs permission). */
/** The app logo (your chosen icon) for a browser notification, so it carries the logo instead of a blank square. */
const notifyIcon = () => { try { const url = new URL(`icons/${getPrefs().appIcon}/art-256.png`, document.baseURI).href; return { icon: url, badge: url }; } catch { return {}; } };
/** True while you are using this window. A covered or minimised window is not "in front", even though the page may still count as visible. */
export const appInFront = () => typeof document !== 'undefined' && !document.hidden && document.hasFocus();
export function osNotify(title: string, body: string) {
  if (!settings.osAlerts || isQuiet(settings.quiet)) return;
  if (settings.osWhen === 'away' && appInFront()) return;
  try {
    if (desktop?.notify) { desktop.notify(title, body); return; }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body, silent: true, ...notifyIcon() });
  } catch { /* Optional. */ }
}
/** The Test button: shows one now and says what happened, in plain words. */
export async function testOsNotification(): Promise<{ ok: boolean; text: string }> {
  const title = 'Study with Sarang', body = 'This is a system notification. If you can read it, they work.';
  try {
    if (desktop?.notifyTest) {
      const r = await desktop.notifyTest(title, body);
      if (!r) return { ok: false, text: 'The app could not be reached.' };
      if (r.shown) return { ok: true, text: `Sent. If you do not see it, Windows may be hiding it: check Focus assist (do not disturb) and Settings > System > Notifications > ${'Study with Sarang'}.${r.shortcut === false ? ' No Start menu shortcut was found: install the app from its first-run window so Windows can show notifications.' : ''}` };
      return { ok: false, text: r.error || 'The system did not show it.' };
    }
    if (typeof Notification === 'undefined') return { ok: false, text: 'This browser has no notifications.' };
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return { ok: false, text: 'The browser blocked notifications for this site. Allow them in the address bar.' };
    new Notification(title, { body, silent: true, ...notifyIcon() }); return { ok: true, text: 'Sent.' };
  } catch (error) { return { ok: false, text: error instanceof Error ? error.message : 'It did not work.' }; }
}
export async function askOsPermission(): Promise<boolean> {
  if (desktop?.notify) return true;
  try { if (typeof Notification === 'undefined') return false; if (Notification.permission === 'granted') return true; return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}
