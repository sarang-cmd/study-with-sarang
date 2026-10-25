import { useEffect, useRef } from 'react';
import { useDesktop } from '../context/DesktopContext';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { addRunLog, clockEvent, createEngine, emitAutomation, getAutomations, lastRunOf, onAutomation, type Automation, type AutoEvent } from '../lib/automations';
import { getPlan } from '../lib/plan';
import { daysUntil, examDate, getProfile } from '../lib/subjects';
import { dayStats, readListening } from '../lib/tracking';

let runNowFn: ((a: Automation) => void) | null = null;
/** "Test now" in Settings: runs the steps right away, without waiting for the trigger. */
export function runAutomationNow(a: Automation) { runNowFn?.(a); }

/** Watches the app for things that happen (a block starts, the sound stops, a time of day) and runs the automations that asked for them. */
export function AutomationBridge({ zen }: { zen: boolean }) {
  const t = useTimer(); const sound = useSound(); const { runSteps } = useDesktop();
  const live = useRef({ t, sound, runSteps }); live.current = { t, sound, runSteps };
  const engine = useRef<ReturnType<typeof createEngine> | null>(null);
  const tokens = useRef<Record<string, number>>({});

  useEffect(() => {
    const run = (a: Automation) => {
      const mine = (tokens.current[a.id] = (tokens.current[a.id] ?? 0) + 1);
      void live.current.runSteps(a.steps, () => tokens.current[a.id] === mine, () => engine.current?.touch());
    };
    runNowFn = (a) => { addRunLog({ id: a.id, name: a.name, at: Date.now(), trigger: a.trigger.type, note: 'test run' }); run(a); };
    engine.current = createEngine({
      now: Date.now, getList: getAutomations, run, log: addRunLog, lastRun: lastRunOf,
      getCtx: () => ({ subject: getPlan().subject, soundPlaying: live.current.sound.playing, timerRunning: live.current.t.running }),
    });
    const stop = onAutomation((ev: AutoEvent) => { engine.current?.handle(ev); });
    const first = window.setTimeout(() => emitAutomation('app-start'), 2500);
    let minute = ''; let examDay = '';
    const tick = window.setInterval(() => {
      const c = clockEvent(Date.now(), minute); minute = c.minute;
      if (c.event) emitAutomation('at-time', c.event.data, c.event.at);
      const d = new Date(); const today = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (today !== examDay) {
        const left = daysUntil(examDate(getProfile()));
        if (left !== null && left >= 0) { examDay = today; emitAutomation('exam-days', { days: left }); }
      }
    }, 15_000);
    return () => { window.clearTimeout(first); window.clearInterval(tick); stop(); runNowFn = null; tokens.current = {}; };
  }, []);

  // ---- timer ------------------------------------------------------------------------------------------------
  const prev = useRef<{ running: boolean; phase: string; newest: string; distractions: number; playing: boolean; zen: boolean; day: number } | null>(null);
  useEffect(() => {
    const newest = t.sessions[0]?.id ?? '';
    const day = dayStats(t.sessions, readListening(), 1, new Date())[0]?.focusSeconds ?? 0;
    const p = prev.current;
    prev.current = { running: t.running, phase: t.phase, newest, distractions: t.distractions, playing: sound.playing, zen, day };
    if (!p) return;
    const fresh = newest && newest !== p.newest ? t.sessions[0] : null;
    const justEnded = fresh && Date.now() - Date.parse(fresh.startedAt) - fresh.seconds * 1000 < 180_000 ? fresh : null;
    const minutes = justEnded ? Math.round(justEnded.seconds / 60) : undefined;
    const subject = justEnded?.subject || getPlan().subject || undefined;
    const isBreak = (ph: string) => ph === 'short' || ph === 'long';
    if (p.phase !== t.phase && t.mode === 'pomodoro') {
      if (p.phase === 'focus' && isBreak(t.phase)) emitAutomation('focus-end', { minutes, subject });
      if (isBreak(p.phase) && t.phase === 'focus') emitAutomation('break-end');
    }
    if (!p.running && t.running) {
      emitAutomation('timer-start');
      emitAutomation(t.phase === 'focus' ? 'focus-start' : 'break-start');
    } else if (p.running && !t.running && p.phase === t.phase) emitAutomation('timer-pause');
    else if (p.running && t.running && p.phase !== t.phase) emitAutomation(t.phase === 'focus' ? 'focus-start' : 'break-start');
    if (justEnded) emitAutomation('block-logged', { minutes, subject });
    const goal = t.settings.dailyGoalMin * 60;
    if (goal > 0 && p.day < goal && day >= goal) emitAutomation('daily-goal');
    if (t.distractions > p.distractions) emitAutomation('distraction');
    if (!p.playing && sound.playing) emitAutomation('sound-start'); else if (p.playing && !sound.playing) emitAutomation('sound-stop');
    if (!p.zen && zen) emitAutomation('zen-open'); else if (p.zen && !zen) emitAutomation('zen-close');
  }, [t.running, t.phase, t.sessions, t.distractions, t.mode, t.settings.dailyGoalMin, sound.playing, zen]);
  return null;
}
