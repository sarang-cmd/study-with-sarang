import { getPlan, setPending, todosDoneSince } from '../lib/plan';
import { clearBreakIdea, emitBlockEnd, hasAskListener, newBreakIdea, requestAskStart } from '../lib/session';
import { appInFront } from '../lib/notifications';
import { getPrefs } from '../lib/prefs';
import { emitAutomation } from '../lib/automations';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSound } from './SoundContext';
import { playChime } from '../lib/synth';
import { newId } from '../lib/mix';
import { MIN_LOGGED_SECONDS, clock, defaultTimerSettings, readRecentTasks, readSessions, readTimerSettings, rememberTask, sanitizeSessions, sanitizeTimerSettings, writeSessions, writeTimerSettings } from '../lib/tracking';
import type { Phase, SessionEntry, TimerMode, TimerSettings } from '../lib/tracking';
import { notify } from '../components/ui/toast';
import { feedback } from '../lib/feedback';

const RUNTIME_KEY = 'study-with-sarang:timer-runtime';
const BASE_TITLE = 'Study with Sarang - Flow, focus and ambient sound';

interface Runtime {
  mode: TimerMode; phase: Phase; running: boolean;
  endAt: number | null; remainingMs: number;
  activeBefore: number; runStart: number | null;
  segmentStartedAt: string | null;
  cycle: number; task: string; distractions: number; tabAways: number;
}

function phaseMs(mode: TimerMode, phase: Phase, settings: TimerSettings): number {
  if (mode === 'countdown') return settings.countdownMin * 60_000;
  if (mode === 'stopwatch') return 0;
  return (phase === 'focus' ? settings.focusMin : phase === 'short' ? settings.shortMin : settings.longMin) * 60_000;
}

function freshRuntime(mode: TimerMode, settings: TimerSettings, task = ''): Runtime {
  return { mode, phase: 'focus', running: false, endAt: null, remainingMs: phaseMs(mode, 'focus', settings), activeBefore: 0, runStart: null, segmentStartedAt: null, cycle: 0, task, distractions: 0, tabAways: 0 };
}

function readRuntime(settings: TimerSettings): Runtime {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RUNTIME_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return freshRuntime('pomodoro', settings);
    const r = raw as Record<string, unknown>;
    const mode: TimerMode = r.mode === 'countdown' || r.mode === 'stopwatch' ? r.mode : 'pomodoro';
    const phase: Phase = r.phase === 'short' || r.phase === 'long' ? r.phase : 'focus';
    const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    const running = r.running === true && typeof r.runStart === 'number' && (mode === 'stopwatch' || typeof r.endAt === 'number');
    return {
      mode, phase, running,
      endAt: running && mode !== 'stopwatch' ? finite(r.endAt, Date.now()) : null,
      remainingMs: Math.max(0, finite(r.remainingMs, phaseMs(mode, phase, settings))),
      activeBefore: Math.max(0, finite(r.activeBefore, 0)), runStart: running ? finite(r.runStart, Date.now()) : null,
      segmentStartedAt: typeof r.segmentStartedAt === 'string' ? r.segmentStartedAt : null,
      cycle: Math.max(0, Math.min(8, Math.round(finite(r.cycle, 0)))), task: typeof r.task === 'string' ? r.task.slice(0, 60) : '',
      distractions: Math.max(0, Math.round(finite(r.distractions, 0))), tabAways: Math.max(0, Math.round(finite(r.tabAways, 0))),
    };
  } catch { return freshRuntime('pomodoro', settings); }
}

interface TimerValue {
  settings: TimerSettings; setSettings: (patch: Partial<TimerSettings>) => void;
  mode: TimerMode; phase: Phase; running: boolean; task: string; cycle: number;
  seconds: number; totalSeconds: number; progress: number; activeSeconds: number;
  distractions: number; tabAways: number; hasSegment: boolean;
  setMode: (mode: TimerMode) => void; setTask: (task: string) => void;
  start: (force?: boolean) => void; startNow: () => void; pause: () => void; toggle: () => void; reset: () => void; skip: () => void; finish: () => void;
  markDistraction: () => void;
  sessions: SessionEntry[]; setGoalOutcome: (id: string, goalMet: SessionEntry['goalMet']) => void; rateSession: (id: string, focus: number) => void; deleteSession: (id: string) => void; clearSessions: () => void;
  mergeSessions: (incoming: unknown) => number; replaceSettings: (raw: unknown) => void;
  recentTasks: string[];
}

const TimerContext = createContext<TimerValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const sound = useSound();
  const soundRef = useRef(sound); soundRef.current = sound;
  const [settings, setSettingsState] = useState(readTimerSettings);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const [runtime, setRuntime] = useState(() => readRuntime(readTimerSettings()));
  const rt = useRef(runtime);
  const [sessions, setSessions] = useState(readSessions);
  const sessionsRef = useRef(sessions); sessionsRef.current = sessions;
  const [recentTasks, setRecentTasks] = useState(readRecentTasks);
  const [, setTick] = useState(0);
  const pausedForBreak = useRef(false);
  const pausedByTimer = useRef(false); // sound that was stopped because the timer was paused

  const update = useCallback((patch: Partial<Runtime>) => {
    rt.current = { ...rt.current, ...patch };
    setRuntime(rt.current);
    try { localStorage.setItem(RUNTIME_KEY, JSON.stringify(rt.current)); } catch { /* Not resumable after reload. */ }
  }, []);
  useEffect(() => { writeSessions(sessions); }, [sessions]);
  useEffect(() => { writeTimerSettings(settings); }, [settings]);

  const activeMsNow = useCallback((limitAt?: number) => {
    const r = rt.current;
    if (!r.running || r.runStart === null) return r.activeBefore;
    const end = limitAt ?? Date.now();
    return r.activeBefore + Math.max(0, end - r.runStart);
  }, []);

  const commit = useCallback((completed: boolean, limitAt?: number) => {
    const r = rt.current;
    if (r.phase !== 'focus') return;
    const seconds = Math.round(activeMsNow(limitAt) / 1000);
    if (seconds < MIN_LOGGED_SECONDS) return;
    const plan = getPlan();
    const startedAt = r.segmentStartedAt ?? new Date(Date.now() - seconds * 1000).toISOString();
    const entry: SessionEntry = {
      id: newId(), startedAt, seconds, mode: r.mode, task: r.task.trim(),
      completed, distractions: r.distractions, tabAways: r.tabAways, mixName: soundRef.current.mix.name,
      subject: plan.subject, goal: plan.goal, goalMet: '', todosDone: todosDoneSince(startedAt),
    };
    setSessions((previous) => [entry, ...previous].slice(0, 5000));
    if (completed) emitBlockEnd({ sessionId: entry.id, seconds, goal: plan.goal, subject: plan.subject, task: r.task.trim(), mode: r.mode });
    if (plan.goal && getPrefs().goalPrompt && !getPrefs().session.wrapUp) setPending({ sessionId: entry.id, goal: plan.goal, subject: plan.subject, minutes: Math.round(seconds / 60) });
  }, [activeMsNow]);

  const notifyEnd = useCallback((title: string, message: string, kind: 'start' | 'end' | 'break') => {
    let text = message;
    if (kind === 'break' && getPrefs().session.breakIdeas) {
      const mins = title.startsWith('Long') ? settingsRef.current.longMin : settingsRef.current.shortMin;
      const idea = newBreakIdea(mins);
      if (getPrefs().session.breakNotify) text = `${message} Idea: ${idea.title.toLowerCase()}.`;
    } else if (kind !== 'break') clearBreakIdea();
    notify({ title, message: text, variant: 'success', id: 'timer-status', duration: 7000 });
    if (settingsRef.current.chime) playChime(kind);
    // The system notification comes from notify() above (see Settings > Notifications); no second browser notification here.
  }, []);

  const applySoundForPhase = useCallback((next: Phase) => {
    const s = settingsRef.current, player = soundRef.current;
    if (next === 'focus') {
      player.setBreakDuck(1);
      if (s.syncSound && pausedForBreak.current && !player.playing) void player.play();
      pausedForBreak.current = false;
    } else if (s.breakSound === 'pause') {
      if (player.playing) { player.pause(); pausedForBreak.current = true; }
    } else if (s.breakSound === 'duck') player.setBreakDuck(.3);
    else player.setBreakDuck(1);
  }, []);

  const complete = useCallback(() => {
    const r = rt.current, s = settingsRef.current;
    if (!r.running || r.endAt === null) return;
    const endedAt = r.endAt, now = Date.now();
    if (r.mode === 'countdown') {
      commit(true, endedAt);
      update({ ...freshRuntime('countdown', s, r.task), cycle: 0 });
      notifyEnd('Countdown complete', `${s.countdownMin} minutes finished. Nice work.`, 'end');
      return;
    }
    if (r.phase === 'focus') {
      commit(true, endedAt);
      const cycle = r.cycle + 1;
      const next: Phase = cycle >= s.cycles ? 'long' : 'short';
      const auto = s.autoNext;
      update({
        phase: next, cycle: next === 'long' ? 0 : cycle, running: auto, remainingMs: phaseMs('pomodoro', next, s),
        endAt: auto ? now + phaseMs('pomodoro', next, s) : null, runStart: auto ? now : null, activeBefore: 0,
        segmentStartedAt: null, distractions: 0, tabAways: 0,
      });
      notifyEnd(next === 'long' ? 'Long break' : 'Short break', next === 'long' ? `Set complete. Take ${s.longMin} minutes.` : `Focus block done. Rest for ${s.shortMin} minutes.`, 'break');
      applySoundForPhase(next);
    } else {
      const auto = s.autoNext;
      update({
        phase: 'focus', running: auto, remainingMs: phaseMs('pomodoro', 'focus', s),
        endAt: auto ? now + phaseMs('pomodoro', 'focus', s) : null, runStart: auto ? now : null, activeBefore: 0,
        segmentStartedAt: auto ? new Date().toISOString() : null, distractions: 0, tabAways: 0,
      });
      notifyEnd('Back to focus', auto ? 'Your next focus block has started.' : 'Press start when you are ready.', 'start');
      applySoundForPhase('focus');
    }
  }, [commit, update, notifyEnd, applySoundForPhase]);

  // Drive the clock from timestamps, so background tabs and reloads stay accurate.
  useEffect(() => {
    if (!runtime.running) return;
    const interval = window.setInterval(() => {
      setTick((value) => value + 1);
      const r = rt.current;
      if (r.running && r.endAt !== null && Date.now() >= r.endAt) complete();
    }, 250);
    return () => window.clearInterval(interval);
  }, [runtime.running, complete]);

  const start = useCallback((force?: boolean) => {
    const r = rt.current, s = settingsRef.current;
    if (r.running) return;
    // A fresh focus block: ask what it is for first, when you are looking at the app (a global shortcut from another window just starts).
    if (force !== true && r.phase === 'focus' && r.activeBefore === 0 && r.segmentStartedAt === null && getPrefs().session.askStart && hasAskListener() && appInFront()) { requestAskStart(true); return; }
    const now = Date.now();
    let remaining = r.remainingMs;
    if (r.mode !== 'stopwatch' && remaining <= 0) remaining = phaseMs(r.mode, r.phase, s);
    update({ running: true, runStart: now, endAt: r.mode === 'stopwatch' ? null : now + remaining, remainingMs: remaining,
      segmentStartedAt: r.segmentStartedAt ?? new Date(now).toISOString() });
    if (r.task.trim()) setRecentTasks(rememberTask(r.task));
    const player = soundRef.current;
    if (r.phase === 'focus') { player.setBreakDuck(1); if (s.syncSound && !player.playing) void player.play(); }
    else if (pausedByTimer.current && s.syncSound && s.breakSound !== 'pause' && !player.playing) void player.play();
    pausedByTimer.current = false;
    feedback(r.phase === 'focus' ? 'Timer started' : 'Break started', { sound: 'start', id: 'timer-quick' });
  }, [update]);

  const startNow = useCallback(() => start(true), [start]);

  const pause = useCallback(() => {
    const r = rt.current;
    if (!r.running) return;
    const now = Date.now();
    update({ running: false, activeBefore: activeMsNow(now), runStart: null, remainingMs: r.endAt === null ? r.remainingMs : Math.max(0, r.endAt - now), endAt: null });
    // Pausing the timer pauses the sound too (it comes back when the timer starts again). Follows "Start and pause sound with the timer".
    const player = soundRef.current;
    pausedByTimer.current = false;
    if (settingsRef.current.syncSound && player.playing) { player.pause(); pausedByTimer.current = true; }
    feedback('Timer paused', { sound: pausedByTimer.current ? null : 'pause', id: 'timer-quick' });
  }, [activeMsNow, update]);

  const reset = useCallback(() => {
    commit(false);
    update(freshRuntime(rt.current.mode, settingsRef.current, rt.current.task));
    soundRef.current.setBreakDuck(1); pausedForBreak.current = false; pausedByTimer.current = false;
    feedback('Timer reset', { sound: 'reset', id: 'timer-quick' });
  }, [commit, update]);

  const finish = useCallback(() => {
    const r = rt.current;
    commit(true);
    update(freshRuntime(r.mode, settingsRef.current, r.task));
    notify({ title: 'Session logged', message: 'It is saved in your time log in this browser.', variant: 'success', id: 'timer-status' });
  }, [commit, update]);

  const skip = useCallback(() => {
    const r = rt.current, s = settingsRef.current;
    if (r.mode !== 'pomodoro') return;
    const wasRunning = r.running, now = Date.now();
    if (r.phase === 'focus') commit(false);
    const next: Phase = r.phase === 'focus' ? 'short' : 'focus';
    update({ phase: next, running: wasRunning, remainingMs: phaseMs('pomodoro', next, s), endAt: wasRunning ? now + phaseMs('pomodoro', next, s) : null,
      runStart: wasRunning ? now : null, activeBefore: 0, segmentStartedAt: wasRunning && next === 'focus' ? new Date(now).toISOString() : null, distractions: 0, tabAways: 0 });
    applySoundForPhase(next);
    // Skipping gets the same toast and chime as a block that ends by itself.
    if (next === 'focus') notifyEnd('Back to focus', wasRunning ? 'Your next focus block has started.' : 'Press start when you are ready.', 'start');
    else notifyEnd('Short break', `Skipped ahead. Rest for ${s.shortMin} minutes.`, 'break');
  }, [commit, update, applySoundForPhase, notifyEnd]);

  const setMode = useCallback((mode: TimerMode) => {
    const r = rt.current;
    if (r.mode === mode) return;
    commit(false);
    update(freshRuntime(mode, settingsRef.current, r.task));
    soundRef.current.setBreakDuck(1); pausedForBreak.current = false;
  }, [commit, update]);

  const setTask = useCallback((task: string) => update({ task: task.slice(0, 60) }), [update]);

  const markDistraction = useCallback(() => {
    const r = rt.current;
    if (!r.running && r.activeBefore === 0) { notify({ title: 'Start a session first', message: 'Distractions are counted against a running session.', variant: 'default', id: 'distraction' }); return; }
    update({ distractions: r.distractions + 1 });
    notify({ title: `Noted (${r.distractions + 1} this session)`, message: 'Take a breath and go back to the task.', variant: 'default', id: 'distraction', duration: 2200 });
  }, [update]);

  // When settings change while idle, keep the idle clock in step.
  const setSettings = useCallback((patch: Partial<TimerSettings>) => {
    const next = sanitizeTimerSettings({ ...settingsRef.current, ...patch });
    settingsRef.current = next; setSettingsState(next);
    const r = rt.current;
    if (!r.running && r.activeBefore === 0 && r.mode !== 'stopwatch') update({ remainingMs: phaseMs(r.mode, r.phase, next) });
  }, [update]);
  const replaceSettings = useCallback((raw: unknown) => { setSettings(sanitizeTimerSettings(raw)); }, [setSettings]);

  const setGoalOutcome = useCallback((id: string, goalMet: SessionEntry['goalMet']) => { if (goalMet) emitAutomation(goalMet === 'yes' ? 'goal-met' : 'goal-missed'); setSessions((previous) => previous.map((item) => (item.id === id ? { ...item, goalMet } : item))); }, []);
  const rateSession = useCallback((id: string, focus: number) => setSessions((previous) => previous.map((item) => (item.id === id ? { ...item, focus: Math.max(0, Math.min(5, Math.round(focus))) || undefined } : item))), []);
    const deleteSession = useCallback((id: string) => setSessions((previous) => previous.filter((item) => item.id !== id)), []);
  const clearSessions = useCallback(() => setSessions([]), []);
  const mergeSessions = useCallback((incoming: unknown) => {
    const clean = sanitizeSessions(incoming);
    const known = new Set(sessionsRef.current.map((item) => item.id));
    const fresh = clean.filter((item) => !known.has(item.id));
    if (fresh.length) setSessions((previous) => [...previous, ...fresh].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 5000));
    return fresh.length;
  }, []);

  // Count a long absence from the tab against a running focus session.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      const r = rt.current;
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt && r.running && r.phase === 'focus' && Date.now() - hiddenAt >= 8000) update({ tabAways: r.tabAways + 1 });
      hiddenAt = 0;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [update]);

  // Keep the screen awake on request.
  useEffect(() => {
    if (!settings.wakeLock || !('wakeLock' in navigator) || !(runtime.running || sound.playing)) return;
    let sentinel: WakeLockSentinel | null = null, cancelled = false;
    const acquire = async () => { try { const lock = await navigator.wakeLock.request('screen'); if (cancelled) void lock.release(); else sentinel = lock; } catch { /* Denied or unsupported. */ } };
    void acquire();
    const reacquire = () => { if (!document.hidden) void acquire(); };
    document.addEventListener('visibilitychange', reacquire);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', reacquire); void sentinel?.release(); };
  }, [settings.wakeLock, runtime.running, sound.playing]);

  const now = Date.now();
  const r = runtime;
  const activeMs = r.running && r.runStart !== null ? r.activeBefore + Math.max(0, now - r.runStart) : r.activeBefore;
  const remainingNow = r.mode === 'stopwatch' ? 0 : r.running && r.endAt !== null ? Math.max(0, r.endAt - now) : r.remainingMs;
  const total = phaseMs(r.mode, r.phase, settings);
  const seconds = r.mode === 'stopwatch' ? Math.floor(activeMs / 1000) : Math.ceil(remainingNow / 1000);
  const progress = r.mode === 'stopwatch' ? 0 : total ? Math.min(1, Math.max(0, 1 - remainingNow / total)) : 0;

  useEffect(() => {
    document.title = r.running ? `${clock(seconds)} · ${r.phase === 'focus' ? 'Focus' : 'Break'} · Study with Sarang` : BASE_TITLE;
  }, [r.running, r.phase, seconds]);
  useEffect(() => () => { document.title = BASE_TITLE; }, []);

  const value: TimerValue = useMemo(() => ({
    settings, setSettings, mode: r.mode, phase: r.phase, running: r.running, task: r.task, cycle: r.cycle,
    seconds, totalSeconds: Math.round(total / 1000), progress, activeSeconds: Math.floor(activeMs / 1000),
    distractions: r.distractions, tabAways: r.tabAways, hasSegment: r.running || r.activeBefore > 0,
    setMode, setTask, start, startNow, pause, toggle: () => { if (rt.current.running) pause(); else start(); }, reset, skip, finish, markDistraction,
    sessions, setGoalOutcome, rateSession, deleteSession, clearSessions, mergeSessions, replaceSettings, recentTasks,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [settings, r, seconds, total, progress, activeMs, sessions, recentTasks, setSettings, setMode, setTask, start, startNow, pause, reset, skip, finish, markDistraction, setGoalOutcome, rateSession, deleteSession, clearSessions, mergeSessions, replaceSettings]);
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer(): TimerValue {
  const value = useContext(TimerContext);
  if (!value) throw new Error('TimerProvider is missing.');
  return value;
}
export { defaultTimerSettings };
