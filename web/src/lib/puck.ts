import { useSyncExternalStore } from 'react';

/**
 * The puck: a small floating control for the timer and the sound.
 * In the page it appears when you scroll away from the controls; on the desktop it can also float above every other window.
 * Everything about it is a setting: what it shows, which buttons it has, what the big button does, where it sits and when it appears.
 */
export type PuckAction = 'timer' | 'skip' | 'sound' | 'next' | 'drift' | 'reset' | 'finish' | 'zen' | 'app' | 'volup' | 'voldown';
export type PuckInfo = 'title' | 'clock' | 'phase' | 'subject' | 'goal' | 'ring' | 'daily' | 'todos';
export type PuckPage = 'off' | 'scrolled' | 'always';
export type PuckDesk = 'off' | 'away' | 'running' | 'always';
export type PuckCorner = 'bl' | 'br' | 'tl' | 'tr';
export type PuckSize = 'small' | 'normal' | 'large';
export type PuckMain = 'timer' | 'sound' | 'zen';
export type PuckLabelClick = 'zen' | 'app' | 'none';

export const PUCK_ACTIONS: { id: PuckAction; label: string; hint: string; command: string; desktopOnly?: boolean }[] = [
  { id: 'timer', label: 'Start or pause the timer', hint: 'Play and pause for the timer.', command: 'timer.toggle' },
  { id: 'skip', label: 'Skip to the next block', hint: 'Jump to the next focus or break block.', command: 'timer.skip' },
  { id: 'sound', label: 'Sound on or off', hint: 'Play or pause your soundscape (or the study room video).', command: 'sound.toggle' },
  { id: 'next', label: 'Next sound variation', hint: 'Another variation of the current mix.', command: 'sound.next' },
  { id: 'drift', label: 'I drifted', hint: 'Mark a distraction in this block.', command: 'timer.drift' },
  { id: 'reset', label: 'Reset the timer', hint: 'Back to the start of the block.', command: 'timer.reset' },
  { id: 'finish', label: 'Finish and log', hint: 'End a stopwatch or countdown and save it.', command: 'timer.finish' },
  { id: 'volup', label: 'Volume up', hint: '5 percent louder.', command: 'volume.up' },
  { id: 'voldown', label: 'Volume down', hint: '5 percent quieter.', command: 'volume.down' },
  { id: 'zen', label: 'Zen view', hint: 'Open or close Zen.', command: 'zen.toggle' },
  { id: 'app', label: 'Open the app window', hint: 'Bring the main window to the front.', command: 'window.show', desktopOnly: true },
];
export const PUCK_INFO: { id: PuckInfo; label: string; hint: string }[] = [
  { id: 'title', label: 'Mix or scene name', hint: 'What is playing.' }, { id: 'clock', label: 'Clock', hint: 'Time left (or elapsed, for the stopwatch).' },
  { id: 'phase', label: 'Focus or break', hint: 'Which kind of block you are in.' }, { id: 'subject', label: 'Subject', hint: 'The subject chosen in the session plan.' },
  { id: 'goal', label: 'Goal for the block', hint: 'The goal you wrote, shortened.' }, { id: 'ring', label: 'Progress ring', hint: 'A ring around the big button.' },
  { id: 'daily', label: 'Daily goal', hint: 'How much of today\'s goal is done.' }, { id: 'todos', label: 'Open to-dos', hint: 'How many are left.' },
];
const ACTION_IDS = PUCK_ACTIONS.map((a) => a.id); const INFO_IDS = PUCK_INFO.map((i) => i.id);

export interface PuckSettings {
  page: PuckPage; desk: PuckDesk; actions: PuckAction[]; info: PuckInfo[]; main: PuckMain; labelClick: PuckLabelClick;
  corner: PuckCorner; size: PuckSize; opacity: number; idleHide: boolean; scrollAfter: number; grip: boolean;
}
export const defaultPuck: PuckSettings = {
  page: 'scrolled', desk: 'off', actions: ['skip', 'sound', 'next', 'zen'], info: ['title', 'clock', 'ring'], main: 'timer', labelClick: 'zen',
  corner: 'bl', size: 'normal', opacity: 100, idleHide: true, scrollAfter: 760, grip: true,
};
const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d);
const list = <T extends string>(v: unknown, allowed: readonly T[], d: T[], max: number): T[] => {
  if (!Array.isArray(v)) return [...d];
  const out: T[] = []; for (const x of v) if (typeof x === 'string' && (allowed as readonly string[]).includes(x) && !out.includes(x as T)) out.push(x as T);
  return out.slice(0, max);
};
const int = (v: unknown, min: number, max: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : d);
export function sanitizePuck(raw: unknown): PuckSettings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}; const d = defaultPuck;
  return {
    page: pick(r.page, ['off', 'scrolled', 'always'], d.page), desk: pick(r.desk, ['off', 'away', 'running', 'always'], d.desk),
    actions: list(r.actions, ACTION_IDS, d.actions, 8), info: list(r.info, INFO_IDS, d.info, 8), main: pick(r.main, ['timer', 'sound', 'zen'], d.main), labelClick: pick(r.labelClick, ['zen', 'app', 'none'], d.labelClick),
    corner: pick(r.corner, ['bl', 'br', 'tl', 'tr'], d.corner), size: pick(r.size, ['small', 'normal', 'large'], d.size), opacity: int(r.opacity, 40, 100, d.opacity),
    idleHide: typeof r.idleHide === 'boolean' ? r.idleHide : d.idleHide, scrollAfter: int(r.scrollAfter, 0, 3000, d.scrollAfter), grip: typeof r.grip === 'boolean' ? r.grip : d.grip,
  };
}

/** What the puck is told about the app, once a second. */
export interface PuckState {
  title: string; clock: string; phase: string; subject: string; goal: string; progress: number; daily: number | null; todos: number;
  timerRunning: boolean; hasSegment: boolean; soundPlaying: boolean; mode: 'pomodoro' | 'countdown' | 'stopwatch';
}
export const idlePuckState: PuckState = { title: '', clock: '--:--', phase: '', subject: '', goal: '', progress: 0, daily: null, todos: 0, timerRunning: false, hasSegment: false, soundPlaying: false, mode: 'pomodoro' };
export function sanitizePuckState(raw: unknown): PuckState {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const s = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n) : '');
  return {
    title: s(r.title, 60), clock: s(r.clock, 12) || '--:--', phase: s(r.phase, 24), subject: s(r.subject, 24), goal: s(r.goal, 120),
    progress: typeof r.progress === 'number' && Number.isFinite(r.progress) ? Math.max(0, Math.min(1, r.progress)) : 0,
    daily: typeof r.daily === 'number' && Number.isFinite(r.daily) ? Math.max(0, Math.min(1, r.daily)) : null, todos: int(r.todos, 0, 9999, 0),
    timerRunning: r.timerRunning === true, hasSegment: r.hasSegment === true, soundPlaying: r.soundPlaying === true,
    mode: r.mode === 'countdown' || r.mode === 'stopwatch' ? r.mode : 'pomodoro',
  };
}

/** The small buttons to draw, in the person's order, minus the big button's own action and the ones that make no sense right now. */
export function visibleActions(settings: PuckSettings, state: PuckState, desktop: boolean): PuckAction[] {
  const big = mainAction(settings);
  return settings.actions.filter((a) => {
    if (a === big) return false;
    if (a === 'app' && !desktop) return false;
    if (a === 'skip' && state.mode !== 'pomodoro') return false;
    if (a === 'finish' && state.mode === 'pomodoro') return false;
    return true;
  });
}
/** The action the big filled button performs. */
export function mainAction(settings: PuckSettings): PuckAction { return (settings.main === 'sound' ? 'sound' : settings.main === 'zen' ? 'zen' : 'timer'); }
export function commandFor(action: string): string | null { return PUCK_ACTIONS.find((a) => a.id === action)?.command ?? null; }
export const SIZES: Record<PuckSize, { button: number; icon: number; text: number; pad: number }> = { small: { button: 26, icon: 12, text: 10, pad: 6 }, normal: { button: 30, icon: 14, text: 11, pad: 8 }, large: { button: 38, icon: 17, text: 13, pad: 10 } };
const cap = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);
/** The words shown beside the buttons, in a stable order. */
export function puckLabels(settings: PuckSettings, state: PuckState): { key: PuckInfo; text: string }[] {
  const out: { key: PuckInfo; text: string }[] = [];
  for (const key of ['title', 'phase', 'subject', 'goal', 'clock', 'daily', 'todos'] as PuckInfo[]) {
    if (!settings.info.includes(key)) continue;
    const text = key === 'title' ? cap(state.title, 22) : key === 'clock' ? state.clock : key === 'phase' ? state.phase : key === 'subject' ? state.subject : key === 'goal' ? cap(state.goal, 28)
      : key === 'daily' ? (state.daily === null ? '' : `${Math.round(state.daily * 100)}% today`) : state.todos > 0 ? `${state.todos} to-do${state.todos === 1 ? '' : 's'}` : '';
    if (text) out.push({ key, text });
  }
  return out;
}
/** In the page: should the puck be on screen? */
export function pageVisible(settings: PuckSettings, scrollY: number, state: PuckState, zen: boolean): boolean {
  if (zen || settings.page === 'off') return false;
  if (settings.idleHide && !(state.soundPlaying || state.timerRunning)) return false;
  return settings.page === 'always' ? true : scrollY > settings.scrollAfter;
}
// ---- store (the page copy of the settings; the desktop shell receives a copy with every update) ------------
const KEY = 'study-with-sarang:puck';
let settings: PuckSettings = { ...defaultPuck };
try { if (typeof localStorage !== 'undefined') settings = sanitizePuck(JSON.parse(localStorage.getItem(KEY) ?? 'null')); } catch { /* defaults */ }
const listeners = new Set<() => void>(); const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getPuck = () => settings;
export const usePuck = () => useSyncExternalStore(subscribe, getPuck, getPuck);
export function setPuck(patch: Partial<PuckSettings>) { settings = sanitizePuck({ ...settings, ...patch }); try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* kept for this visit */ } emit(); }
