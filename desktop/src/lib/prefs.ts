import { useSyncExternalStore } from 'react';
import { defaultNeural, sanitizeNeural, type NeuralSettings } from './neural';
import { defaultAgent, sanitizeAgent, type AgentSettings } from './agent';
import { defaultCalendar, sanitizeCalendar, type CalendarSettings } from './calendar';
import { defaultDrift, sanitizeDrift, type DriftSettings } from './drift';
import { defaultAutoPause, sanitizeAutoPause, type AutoPauseSettings } from './autoPause';
import { defaultDiscord, sanitizeDiscord, type DiscordSettings } from './discord';
import { defaultCalm, sanitizeCalm, type CalmSettings } from './calm';
import { defaultFlow, sanitizeFlow, type FlowSettings } from './flow';
import { defaultRec, sanitizeRec, type RecSettings } from './recordings';
import { defaultSession, sanitizeSession, type SessionSettings } from './session';
import { sanitizeLevel, sanitizeShow, type FeatureMap, type UiLevel } from './uiLevel';

/** Display and feedback choices for this device. Kept in this browser (or this computer), never synced. */
export type LayoutId = 'new' | 'legacy';
import { normalizeIconId, type IconId } from './iconSet';
export type { IconId };
export type Loudness = 'gentle' | 'balanced' | 'loud' | 'max';
export const LOUDNESS_BOOST: Record<Loudness, number> = { gentle: 0, balanced: .8, loud: 1.6, max: 2.6 };
export interface Prefs {
  layout: LayoutId;
  appIcon: IconId;           // Web: the tab icon. Desktop: the window, taskbar and tray icon (stored by the shell).
  toasts: boolean;           // A small message for quick actions such as skip, next and reset
  uiSounds: boolean;         // A soft tick for the same actions
  customScrollbar: boolean;
  pauseKey: boolean;         // Web and non-Windows: Pause/Break toggles sound while this page is focused
  mediaKeys: boolean;        // Web: Play/Pause, Next and Stop media keys toggle sound while this page is focused
  zenGoal: boolean; zenTask: boolean; zenVisualizer: boolean; zenControls: boolean;
  achievements: boolean;     // Show the Achievements card and keep track of them
  achievementToasts: boolean; // A message and a chime when one unlocks
  uiLevel: UiLevel;          // Simple, Standard, Power or Custom: how much of the app is on screen
  uiPrev: UiLevel;           // Where the top bar switch returns to when you leave Simple
  uiShow: Partial<FeatureMap>; // Your own choices, used when the level is Custom
  loudness: Loudness;        // How far the top of the volume slider goes
  volumeCap: number;         // 20 to 100: the slider can never go past this share of the maximum
  fadeIn: number;            // Seconds, when sound starts
  fadeOut: number;           // Seconds, when sound pauses
  startPlaying: boolean;     // Start the sound as soon as the app opens
  mediaArtwork: boolean;     // Show the app icon in the Windows media flyout and other media controls
  autoPause: AutoPauseSettings; // Desktop only
  discord: DiscordSettings;     // Desktop only
  neural: NeuralSettings;       // Optional gentle rhythm layer ("neural lock"), off by default
  agent: AgentSettings;         // The assistant that can act in the app (needs your own AI key)
  calendar: CalendarSettings;   // Your study blocks as a calendar file or a private link
  drift: DriftSettings;         // Noticing distractions (desktop only: the front program and the browser helper)
  recordings: RecSettings;      // Real recordings for the ten classic sounds
  calm: CalmSettings;           // Breathing, scenes, grounding, wind-down
  flow: FlowSettings;           // The Flow voice helper (API keys are kept apart, see flowStore)
  mediaSeek: 'remaining' | 'elapsed' | 'off'; // What the seek bar in the Windows media flyout shows
  mediaTitle: 'phase' | 'mix' | 'both';       // What the flyout title says
  goalPrompt: boolean;          // After a block with a goal, ask whether it was reached
  advanced: boolean;            // Off (Essentials): a short, focused app. On: the full feature set (Settings > Advanced)
  essentialsSeen: boolean;      // The one-time "we simplified the app" note has been shown
  session: SessionSettings;     // The start question, wrap-up and break ideas
}
/** Test and migration helper: "?v2defaults" in the address opens the app with the 2.0 look (everything on, no session questions). */
export const V2_DEFAULTS = typeof location !== 'undefined' && /[?&]v2defaults\b/.test(location.search);
export const defaultPrefs: Prefs = {
  layout: 'new', appIcon: 'default', toasts: true, uiSounds: true, customScrollbar: true, pauseKey: true, mediaKeys: true,
  zenGoal: true, zenTask: true, zenVisualizer: true, zenControls: true, achievements: true, achievementToasts: true,
  uiLevel: 'power', uiPrev: 'standard', uiShow: {}, loudness: 'loud', volumeCap: 100, fadeIn: .25, fadeOut: .2, startPlaying: false, mediaArtwork: true,
  autoPause: { ...defaultAutoPause }, discord: { ...defaultDiscord }, drift: { ...defaultDrift, categories: { ...defaultDrift.categories } }, calendar: { ...defaultCalendar }, neural: { ...defaultNeural }, agent: { ...defaultAgent, groups: { ...defaultAgent.groups } },
  recordings: { ...defaultRec }, calm: { ...defaultCalm, custom: [...defaultCalm.custom] }, flow: { ...defaultFlow }, mediaSeek: 'remaining', mediaTitle: 'both', goalPrompt: true,
  advanced: V2_DEFAULTS, essentialsSeen: true,
  session: V2_DEFAULTS ? { ...defaultSession, askStart: false, wrapUp: false, breakIdeas: false, breakNotify: false, techniques: false, reviewLater: false, reviewDays: [...defaultSession.reviewDays] } : { ...defaultSession, reviewDays: [...defaultSession.reviewDays] },
};
export const PREFS_KEY = 'study-with-sarang:prefs';

const secs = (value: unknown, fallback: number, max: number) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0.05, Math.min(max, Math.round(value * 100) / 100)) : fallback);
const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
export function sanitizePrefs(raw: unknown): Prefs {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const d = defaultPrefs;
  return {
    layout: r.layout === 'legacy' ? 'legacy' : r.layout === 'new' ? 'new' : d.layout,
    appIcon: normalizeIconId(r.appIcon),
    toasts: flag(r.toasts, d.toasts), uiSounds: flag(r.uiSounds, d.uiSounds), customScrollbar: flag(r.customScrollbar, d.customScrollbar), pauseKey: flag(r.pauseKey, d.pauseKey), mediaKeys: flag(r.mediaKeys, d.mediaKeys),
    zenGoal: flag(r.zenGoal, d.zenGoal), zenTask: flag(r.zenTask, d.zenTask), zenVisualizer: flag(r.zenVisualizer, d.zenVisualizer), zenControls: flag(r.zenControls, d.zenControls),
    achievements: flag(r.achievements, d.achievements), achievementToasts: flag(r.achievementToasts, d.achievementToasts),
    uiLevel: sanitizeLevel(r.uiLevel, d.uiLevel), uiPrev: sanitizeLevel(r.uiPrev, d.uiPrev) === 'simple' ? 'standard' : sanitizeLevel(r.uiPrev, d.uiPrev), uiShow: sanitizeShow(r.uiShow),
    loudness: r.loudness === 'gentle' || r.loudness === 'balanced' || r.loudness === 'max' ? r.loudness : 'loud',
    volumeCap: typeof r.volumeCap === 'number' && Number.isFinite(r.volumeCap) ? Math.max(20, Math.min(100, Math.round(r.volumeCap))) : d.volumeCap,
    fadeIn: secs(r.fadeIn, d.fadeIn, 10), fadeOut: secs(r.fadeOut, d.fadeOut, 10),
    startPlaying: flag(r.startPlaying, d.startPlaying), mediaArtwork: flag(r.mediaArtwork, d.mediaArtwork),
    autoPause: sanitizeAutoPause(r.autoPause), discord: sanitizeDiscord(r.discord), drift: sanitizeDrift(r.drift), calendar: sanitizeCalendar(r.calendar), agent: sanitizeAgent(r.agent), neural: sanitizeNeural(r.neural),
    recordings: sanitizeRec(r.recordings), calm: sanitizeCalm(r.calm), flow: sanitizeFlow(r.flow),
    mediaSeek: r.mediaSeek === 'elapsed' || r.mediaSeek === 'off' ? r.mediaSeek : 'remaining',
    mediaTitle: r.mediaTitle === 'phase' || r.mediaTitle === 'mix' ? r.mediaTitle : 'both',
    goalPrompt: flag(r.goalPrompt, d.goalPrompt),
    advanced: flag(r.advanced, d.advanced), essentialsSeen: flag(r.essentialsSeen, Object.keys(r).length === 0),
    session: sanitizeSession(r.session, d.session),
  };
}

function read(): Prefs { try { return sanitizePrefs(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')); } catch { return { ...defaultPrefs }; } }

let current: Prefs = typeof localStorage === 'undefined' ? { ...defaultPrefs } : read();
const listeners = new Set<() => void>();

export const getPrefs = () => current;
export function setPrefs(patch: Partial<Prefs>) {
  current = sanitizePrefs({ ...current, ...patch });
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(current)); } catch { /* Kept for this session. */ }
  listeners.forEach((listener) => listener());
}
export function resetPrefs() { setPrefs(sanitizePrefs({})); }
export function replacePrefs(raw: unknown) { setPrefs(sanitizePrefs(raw)); }

export function usePrefs(): [Prefs, typeof setPrefs] {
  const value = useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getPrefs, getPrefs);
  return [value, setPrefs];
}

/** The "05 / " prefix on section labels: shown in the classic single-column layout, dropped in the tabbed one. */
export const sectionNo = (n: string) => (getPrefs().layout === 'legacy' ? `${n} / ` : '');
