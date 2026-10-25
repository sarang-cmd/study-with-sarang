import { Clock, Coffee, Flag, Pause, Play, RotateCcw, SkipForward, Timer as TimerIcon, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSound } from '../context/SoundContext';
import { useFeatures } from '../hooks/useFeatures';
import { useTimer } from '../context/TimerContext';
import { clock, dayStats, formatDuration } from '../lib/tracking';
import type { TimerMode } from '../lib/tracking';
import { TimerSettingsForm } from './TimerSettingsForm';
import { sectionNo } from '../lib/prefs';
import { SessionPlan } from './SessionPlan';
import { BreakCoach } from './BreakCoach';

const modes: { id: TimerMode; label: string; icon: typeof Clock }[] = [
  { id: 'pomodoro', label: 'Pomodoro', icon: TimerIcon }, { id: 'countdown', label: 'Countdown', icon: Clock }, { id: 'stopwatch', label: 'Stopwatch', icon: Zap },
];

export function TimerRing({ progress, size = 220, stroke = 6, children }: { progress: number; size?: number; stroke?: number; children: ReactNode }) {
  const radius = (size - stroke) / 2, circumference = 2 * Math.PI * radius;
  return <div className="relative mx-auto" style={{ width: size, height: size }}>
    <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--ink))" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} style={{ transition: 'stroke-dashoffset .3s linear' }} />
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
  </div>;
}

export function phaseLabel(phase: string, mode: TimerMode) {
  if (mode === 'countdown') return 'Countdown';
  if (mode === 'stopwatch') return 'Counting up';
  return phase === 'focus' ? 'Focus' : phase === 'short' ? 'Short break' : 'Long break';
}

export function TimerSection() {
  const t = useTimer();
  const f = useFeatures();
  const { listening, mix } = useSound();
  const today = dayStats(t.sessions, listening, 1)[0];
  const goalSeconds = t.settings.dailyGoalMin * 60;
  const todayFocus = today.focusSeconds + (t.hasSegment && t.phase === 'focus' ? t.activeSeconds : 0);
  const goalProgress = goalSeconds ? Math.min(1, todayFocus / goalSeconds) : 0;
  const idle = !t.running && !t.hasSegment;
  const timeLabel = clock(t.seconds);


  return <section id="timer" aria-labelledby="timer-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
    <div className="flex items-start justify-between gap-4"><div><p className="section-label mb-3">{sectionNo('02')}Timer</p><h2 id="timer-heading" className="text-[26px] font-semibold leading-tight tracking-tight">Work in clear blocks.</h2><p className="calm-hide mt-2 text-[12px] leading-relaxed text-muted">Pomodoro, a custom countdown or an open stopwatch. Time is saved to your log automatically.</p></div><TimerIcon size={23} className="shrink-0 text-muted" /></div>

    {(f.timerModes || t.mode !== 'pomodoro') && <div className="mt-7 grid grid-cols-3 gap-1 rounded-full border border-line bg-raised p-1" role="group" aria-label="Timer mode">
      {modes.map((mode) => <button key={mode.id} type="button" aria-pressed={t.mode === mode.id} onClick={() => t.setMode(mode.id)}
        className={`flex h-9 items-center justify-center gap-1.5 rounded-full text-[11px] font-semibold transition-colors ${t.mode === mode.id ? 'bg-ink text-canvas' : 'text-muted hover:text-ink'}`}><mode.icon size={13} /> {mode.label}</button>)}
    </div>}

    <div className="mt-8">
      <TimerRing progress={t.mode === 'stopwatch' ? (t.activeSeconds % 3600) / 3600 : t.progress}>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">{phaseLabel(t.phase, t.mode)}{t.mode === 'pomodoro' && t.phase === 'focus' ? ` · ${t.cycle + 1}/${t.settings.cycles}` : ''}</p>
        <p role="timer" aria-label={`Time ${t.mode === 'stopwatch' ? 'elapsed' : 'remaining'}: ${timeLabel}`} className="mt-1 font-mono text-[46px] font-semibold tabular-nums leading-none tracking-[-0.06em]">{timeLabel}</p>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted">{t.phase === 'focus' ? <Flag size={11} /> : <Coffee size={11} />}{t.running ? 'Running' : t.hasSegment ? 'Paused' : 'Ready'}</p>
      </TimerRing>
    </div>

    {t.mode === 'pomodoro' && t.phase !== 'focus' && <div className="mt-5"><BreakCoach /></div>}

    <div className="mt-6">
      <label htmlFor="timer-task" className="text-[11px] font-semibold">What are you working on?</label>
      <input id="timer-task" type="text" list="recent-tasks" maxLength={60} value={t.task} onChange={(event) => t.setTask(event.target.value)} placeholder="e.g. Calculus past paper" className="field mt-2" autoComplete="off" />
      <datalist id="recent-tasks">{t.recentTasks.map((task) => <option key={task} value={task} />)}</datalist>
    </div>

    <div className="mt-5 flex flex-wrap items-center gap-2.5">
      <button type="button" onClick={t.toggle} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-6 text-[12px] font-semibold text-canvas">{t.running ? <Pause size={15} /> : <Play size={15} />} {t.running ? 'Pause' : t.hasSegment ? 'Resume' : 'Start'}</button>
      {t.mode === 'pomodoro' && <button type="button" onClick={t.skip} className="studio-button min-h-11" data-tip="Skip to the next block"><SkipForward size={14} /> Skip</button>}
      {t.mode !== 'pomodoro' && <button type="button" onClick={t.finish} disabled={!t.hasSegment} className="studio-button min-h-11" data-tip="Stop and save this session to your log"><Flag size={14} /> Finish and log</button>}
      <button type="button" onClick={t.reset} disabled={idle && t.phase === 'focus' && t.cycle === 0} className="studio-button min-h-11"><RotateCcw size={14} /> Reset</button>
      <button type="button" onClick={t.markDistraction} className="studio-button min-h-11" data-tip="Tap when your mind wanders (D)">I drifted{t.distractions > 0 && <span className="font-mono">{t.distractions}</span>}</button>
    </div>
    {t.tabAways > 0 && <p className="mt-3 text-[11px] text-muted">You left this tab {t.tabAways} {t.tabAways === 1 ? 'time' : 'times'} during this session.</p>}
    <p className="calm-hide mt-3 text-[11px] leading-relaxed text-muted">{t.mode === 'pomodoro' ? `Working on "${mix.name}" sound. ` : ''}Sessions shorter than 30 seconds are not logged.</p>

    {f.timerPlan && <div className="mt-6"><SessionPlan /></div>}

    {f.timerGoal && <div className="mt-6 rounded-xl border border-line bg-canvas p-4">
      <div className="flex items-center justify-between text-[11px] font-semibold"><span>Today&apos;s goal</span><span className="font-mono text-muted">{formatDuration(todayFocus, true)} / {goalSeconds ? formatDuration(goalSeconds, true) : 'no goal'}</span></div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-label="Daily focus goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goalProgress * 100)}><div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${goalProgress * 100}%` }} /></div>
    </div>}

    {f.timerSettings && <details className="mt-6 border-t border-line pt-5">
      <summary className="flex items-center justify-between gap-3 rounded-md text-[14px] font-semibold tracking-tight"><span>Timer settings</span><svg className="chevron text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></summary>
      <TimerSettingsForm />
    </details>}
  </section>;
}
