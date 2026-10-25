import { useSyncExternalStore } from 'react';
import { newId } from './mix';
import { sanitizeMacros, type MacroStep } from './macros';

/**
 * Automations: "when this happens, and only if that is true, do these steps". They run while the app is open (in a browser tab or the desktop app).
 * The steps are the same as macro steps, so anything a macro can do an automation can do, plus a message.
 */
export type TriggerId =
  | 'app-start' | 'timer-start' | 'timer-pause' | 'focus-start' | 'focus-end' | 'break-start' | 'break-end' | 'block-logged' | 'daily-goal' | 'distraction'
  | 'goal-met' | 'goal-missed' | 'sound-start' | 'sound-stop' | 'zen-open' | 'zen-close' | 'achievement' | 'at-time' | 'exam-days' | 'drift-detected';
export interface TriggerDef { id: TriggerId; label: string; group: 'Timer' | 'Goals' | 'Sound and views' | 'Time' | 'Other'; hint: string; param?: 'time' | 'minutes' | 'days'; desktopOnly?: boolean }
export const TRIGGERS: TriggerDef[] = [
  { id: 'focus-start', label: 'A focus block starts', group: 'Timer', hint: 'The timer starts a focus block.' },
  { id: 'focus-end', label: 'A focus block ends', group: 'Timer', hint: 'The pomodoro timer finishes or skips a focus block.', param: 'minutes' },
  { id: 'break-start', label: 'A break starts', group: 'Timer', hint: 'A short or long break begins.' },
  { id: 'break-end', label: 'A break ends', group: 'Timer', hint: 'Time to focus again.' },
  { id: 'timer-start', label: 'The timer starts or resumes', group: 'Timer', hint: 'Any block, any mode.' },
  { id: 'timer-pause', label: 'The timer is paused', group: 'Timer', hint: 'You pressed pause.' },
  { id: 'block-logged', label: 'A session is saved to your log', group: 'Timer', hint: 'Works for every timer mode. Optional: only if it was at least some minutes.', param: 'minutes' },
  { id: 'distraction', label: 'You mark a distraction', group: 'Timer', hint: 'You pressed "I drifted".' },
  { id: 'daily-goal', label: 'You reach your daily goal', group: 'Goals', hint: 'The first time today your focus time passes the goal.' },
  { id: 'goal-met', label: 'You meet a block goal', group: 'Goals', hint: 'You answered yes to "Did you reach your goal?".' },
  { id: 'goal-missed', label: 'You miss a block goal', group: 'Goals', hint: 'You answered partly or no.' },
  { id: 'exam-days', label: 'Days until your exams', group: 'Goals', hint: 'Fires once on the day when the countdown reaches this number.', param: 'days' },
  { id: 'sound-start', label: 'Sound starts', group: 'Sound and views', hint: 'Your soundscape starts playing.' },
  { id: 'sound-stop', label: 'Sound stops', group: 'Sound and views', hint: 'Your soundscape is paused.' },
  { id: 'zen-open', label: 'Zen view opens', group: 'Sound and views', hint: '' },
  { id: 'zen-close', label: 'Zen view closes', group: 'Sound and views', hint: '' },
  { id: 'at-time', label: 'At a time of day', group: 'Time', hint: 'Every day at this time (on the days you choose below) while the app is open.', param: 'time' },
  { id: 'app-start', label: 'The app opens', group: 'Other', hint: 'A moment after it starts.' },
  { id: 'achievement', label: 'You unlock an achievement', group: 'Other', hint: '' },
  { id: 'drift-detected', label: 'Drift is detected', group: 'Other', hint: 'The desktop app noticed a distracting app or site (set up under Drift detection).', desktopOnly: true },
];
const TRIGGER_IDS = TRIGGERS.map((t) => t.id);

export interface AutoEvent { type: TriggerId; at: number; data?: { minutes?: number; subject?: string; title?: string; days?: number; time?: string; outcome?: string } }
export interface Automation {
  id: string; name: string; enabled: boolean;
  trigger: { type: TriggerId; time: string; minutes: number; days: number };
  when: { weekdays: number[]; from: string; to: string; subject: string; sound: 'any' | 'playing' | 'silent'; timer: 'any' | 'running' | 'idle' };
  limit: 'always' | 'daily' | 'hourly';
  steps: MacroStep[]; createdAt: string;
}
export interface AutoContext { subject: string; soundPlaying: boolean; timerRunning: boolean }
export interface RunLog { id: string; name: string; at: number; trigger: TriggerId; note: string }

export const MAX_AUTOMATIONS = 30;
const clean = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : '');
const hhmm = (v: unknown, fallback: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);
const optTime = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : '');
const int = (v: unknown, min: number, max: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : d);

export const newAutomation = (over: Partial<Automation> = {}): Automation => sanitizeAutomations([{ name: 'New automation', enabled: true, trigger: { type: 'focus-start' }, steps: [{ type: 'play', value: '' }], ...over }])[0];

export function sanitizeAutomations(raw: unknown): Automation[] {
  if (!Array.isArray(raw)) return [];
  const out: Automation[] = []; const seen = new Set<string>();
  for (const entry of raw.slice(0, MAX_AUTOMATIONS)) {
    if (!entry || typeof entry !== 'object') continue;
    const r = entry as Record<string, unknown>; const t = (r.trigger && typeof r.trigger === 'object' ? r.trigger : {}) as Record<string, unknown>; const w = (r.when && typeof r.when === 'object' ? r.when : {}) as Record<string, unknown>;
    let id = clean(r.id, 80); if (!/^[\w-]{1,80}$/.test(id) || seen.has(id)) id = newId(); seen.add(id);
    const type = TRIGGER_IDS.includes(t.type as TriggerId) ? (t.type as TriggerId) : 'focus-start';
    const days = Array.isArray(w.weekdays) ? [...new Set(w.weekdays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
    const steps = sanitizeMacros([{ id: 'x', name: 'x', steps: r.steps }])[0]?.steps ?? [];
    out.push({
      id, name: clean(r.name, 60) || 'Automation', enabled: r.enabled !== false,
      trigger: { type, time: hhmm(t.time, '22:00'), minutes: int(t.minutes, 0, 600, 0), days: int(t.days, 0, 730, 30) },
      when: { weekdays: days.length === 7 ? [] : days, from: optTime(w.from), to: optTime(w.to), subject: clean(w.subject, 80), sound: w.sound === 'playing' || w.sound === 'silent' ? w.sound : 'any', timer: w.timer === 'running' || w.timer === 'idle' ? w.timer : 'any' },
      limit: r.limit === 'daily' || r.limit === 'hourly' ? r.limit : 'always', steps: steps.slice(0, 20), createdAt: typeof r.createdAt === 'string' ? r.createdAt.slice(0, 40) : new Date().toISOString(),
    });
  }
  return out;
}

const minutesOf = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));
const dayKey = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

/** Does this event start this automation, given the conditions and when it last ran? Returns '' for yes, or the reason for no. */
export function whyNot(a: Automation, ev: AutoEvent, ctx: AutoContext, lastRun: number | undefined): string {
  if (!a.enabled) return 'off';
  if (a.trigger.type !== ev.type) return 'other trigger';
  if ((ev.type === 'focus-end' || ev.type === 'block-logged') && a.trigger.minutes > 0 && (ev.data?.minutes ?? 0) < a.trigger.minutes) return 'shorter than the minimum';
  if (ev.type === 'exam-days' && ev.data?.days !== a.trigger.days) return 'different number of days';
  if (ev.type === 'at-time' && ev.data?.time !== a.trigger.time) return 'other time';
  const d = new Date(ev.at);
  if (a.when.weekdays.length && !a.when.weekdays.includes(d.getDay())) return 'not on this weekday';
  if (a.when.from && a.when.to) {
    const m = d.getHours() * 60 + d.getMinutes(), f = minutesOf(a.when.from), t = minutesOf(a.when.to);
    const inside = f <= t ? m >= f && m < t : m >= f || m < t;
    if (!inside) return 'outside the time window';
  }
  if (a.when.subject && a.when.subject !== ctx.subject) return 'other subject';
  if (a.when.sound === 'playing' && !ctx.soundPlaying) return 'sound is off';
  if (a.when.sound === 'silent' && ctx.soundPlaying) return 'sound is on';
  if (a.when.timer === 'running' && !ctx.timerRunning) return 'timer is not running';
  if (a.when.timer === 'idle' && ctx.timerRunning) return 'timer is running';
  if (lastRun !== undefined) {
    if (a.limit === 'daily' && dayKey(lastRun) === dayKey(ev.at)) return 'already ran today';
    if (a.limit === 'hourly' && ev.at - lastRun < 3_600_000) return 'ran within the hour';
  }
  return '';
}

export interface EngineDeps { now: () => number; getList: () => Automation[]; getCtx: () => AutoContext; run: (a: Automation, ev: AutoEvent) => void; log: (entry: RunLog) => void; lastRun: (id: string) => number | undefined; quietMs?: number; maxPerMinute?: number }
/** Decides which automations run for an event. It ignores events that an automation itself just caused (so a rule cannot trigger itself in a loop) and caps runs per minute. */
export function createEngine(deps: EngineDeps) {
  let lastActionAt = -1e12; const runs: number[] = [];
  const quiet = deps.quietMs ?? 1500, cap = deps.maxPerMinute ?? 30;
  return {
    /** Called by the step runner each time a step actually changes something. */
    touch() { lastActionAt = deps.now(); },
    handle(ev: AutoEvent): string[] {
      const fired: string[] = []; const ctx = deps.getCtx(); const now = deps.now();
      const matching = deps.getList().filter((a) => a.trigger.type === ev.type);
      if (!matching.length) return fired;
      if (now - lastActionAt < quiet) { for (const a of matching) if (a.enabled) deps.log({ id: a.id, name: a.name, at: now, trigger: ev.type, note: 'skipped: it came right after another automation step' }); return fired; }
      for (const a of matching) {
        const why = whyNot(a, ev, ctx, deps.lastRun(a.id));
        if (why) { if (why !== 'off' && why !== 'already ran today' && why !== 'ran within the hour' && why !== 'other time' && why !== 'different number of days') deps.log({ id: a.id, name: a.name, at: now, trigger: ev.type, note: `skipped: ${why}` }); continue; }
        while (runs.length && now - runs[0] > 60_000) runs.shift();
        if (runs.length >= cap) { deps.log({ id: a.id, name: a.name, at: now, trigger: ev.type, note: 'skipped: too many runs this minute' }); continue; }
        runs.push(now); fired.push(a.id);
        deps.log({ id: a.id, name: a.name, at: now, trigger: ev.type, note: 'ran' });
        deps.run(a, ev);
      }
      return fired;
    },
  };
}

/** Events for the clock: one per minute for "at a time of day". */
export function clockEvent(now: number, lastMinute: string): { event: AutoEvent | null; minute: string } {
  const d = new Date(now); const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const minute = `${dayKey(now)} ${time}`;
  return minute === lastMinute ? { event: null, minute } : { event: { type: 'at-time', at: now, data: { time } }, minute };
}

// ---- templates -------------------------------------------------------------------------------------------
export interface Template { id: string; name: string; hint: string; make: () => Automation }
const step = (type: MacroStep['type'], value = ''): MacroStep => ({ type, value });
export const TEMPLATES: Template[] = [
  { id: 'sound-with-focus', name: 'Sound starts with every focus block', hint: 'Starts your sound when a focus block starts.', make: () => newAutomation({ name: 'Sound with focus', trigger: { type: 'focus-start' } as Automation['trigger'], when: { sound: 'silent' } as Automation['when'], steps: [step('play')] }) },
  { id: 'pause-on-break', name: 'Pause the sound on breaks', hint: 'Silence during breaks, so they are real breaks.', make: () => newAutomation({ name: 'Quiet breaks', trigger: { type: 'break-start' } as Automation['trigger'], steps: [step('pause')] }) },
  { id: 'breathe-on-break', name: 'Breathing guide when a break starts', hint: 'Opens the breathing guide for the break.', make: () => newAutomation({ name: 'Breathe on break', trigger: { type: 'break-start' } as Automation['trigger'], steps: [step('breathe')] }) },
  { id: 'zen-with-focus', name: 'Open Zen for every focus block', hint: 'Zen opens when focus starts and closes when it ends.', make: () => newAutomation({ name: 'Zen while focusing', trigger: { type: 'focus-start' } as Automation['trigger'], steps: [step('zen-open')] }) },
  { id: 'daily-goal-message', name: 'Message when the daily goal is reached', hint: 'A short well done.', make: () => newAutomation({ name: 'Daily goal reached', trigger: { type: 'daily-goal' } as Automation['trigger'], steps: [step('notify', 'Daily goal reached. Nice work, you can stop here.')] }) },
  { id: 'evening-wind-down', name: 'Evening wind-down at 22:30', hint: 'A quiet reminder and the breathing guide.', make: () => newAutomation({ name: 'Evening wind-down', trigger: { type: 'at-time', time: '22:30' } as Automation['trigger'], steps: [step('notify', 'Time to wind down. Close the books for today.'), step('breathe')] }) },
  { id: 'missed-goal-breathe', name: 'A breath after a missed goal', hint: 'Be kind to yourself when a block did not go to plan.', make: () => newAutomation({ name: 'After a missed goal', trigger: { type: 'goal-missed' } as Automation['trigger'], steps: [step('notify', 'Not every block goes to plan. Take a breath, then pick one small next step.'), step('breathe')] }) },
  { id: 'exam-week', name: 'Reminder a week before exams', hint: 'Fires once, seven days before your exam date.', make: () => newAutomation({ name: 'One week to go', trigger: { type: 'exam-days', days: 7 } as Automation['trigger'], steps: [step('notify', 'One week until your exams. Review your plan in Progress.')] }) },
  { id: 'drift-breathe', name: 'When drift is detected, pause and breathe', hint: 'Desktop app: pauses the timer and opens the breathing guide.', make: () => newAutomation({ name: 'Drift response', trigger: { type: 'drift-detected' } as Automation['trigger'], steps: [step('timer-pause'), step('breathe')] }) },
];

// ---- stores ---------------------------------------------------------------------------------------------
export const AUTOMATIONS_KEY = 'study-with-sarang:automations';
export const AUTOLOG_KEY = 'study-with-sarang:automation-log';
let list: Automation[] = [];
try { if (typeof localStorage !== 'undefined') list = sanitizeAutomations(JSON.parse(localStorage.getItem(AUTOMATIONS_KEY) ?? '[]')); } catch { /* none */ }
let log: RunLog[] = [];
try { if (typeof localStorage !== 'undefined') { const raw = JSON.parse(localStorage.getItem(AUTOLOG_KEY) ?? '[]'); if (Array.isArray(raw)) log = raw.filter((e) => e && typeof e.id === 'string' && typeof e.at === 'number').slice(0, 40).map((e) => ({ id: String(e.id), name: clean(e.name, 60), at: e.at, trigger: e.trigger, note: clean(e.note, 100) })); } } catch { /* none */ }
const listeners = new Set<() => void>(); const emit = () => listeners.forEach((f) => f());
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const getAutomations = () => list;
export const useAutomations = () => useSyncExternalStore(subscribe, getAutomations, getAutomations);
export const getAutoLog = () => log;
export const useAutoLog = () => useSyncExternalStore(subscribe, getAutoLog, getAutoLog);
export function setAutomations(update: Automation[] | ((cur: Automation[]) => Automation[])) {
  list = sanitizeAutomations(typeof update === 'function' ? update(list) : update);
  try { localStorage.setItem(AUTOMATIONS_KEY, JSON.stringify(list)); } catch { /* kept for this visit */ }
  emit();
}
export function addRunLog(entry: RunLog) {
  log = [entry, ...log].slice(0, 40);
  try { localStorage.setItem(AUTOLOG_KEY, JSON.stringify(log)); } catch { /* kept for this visit */ }
  emit();
}
export const lastRunOf = (id: string) => log.find((e) => e.id === id && e.note === 'ran')?.at;
export function clearAutoLog() { log = []; try { localStorage.removeItem(AUTOLOG_KEY); } catch { /* ignore */ } emit(); }
export function resetAutomationsForTest() { list = []; log = []; emit(); }

// ---- the event bus (buffers until the bridge is listening, like the celebration bus) ------------------------
let handler: ((ev: AutoEvent) => void) | null = null; const buffered: AutoEvent[] = [];
export function emitAutomation(type: TriggerId, data?: AutoEvent['data'], at = Date.now()) {
  const ev: AutoEvent = { type, at, data };
  if (handler) handler(ev); else { buffered.push(ev); if (buffered.length > 20) buffered.shift(); }
}
export function onAutomation(fn: (ev: AutoEvent) => void) { handler = fn; for (const ev of buffered.splice(0)) fn(ev); return () => { if (handler === fn) handler = null; }; }
