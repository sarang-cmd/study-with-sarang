import { useMemo } from 'react';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { dayStats, focusStreak, formatDuration } from '../lib/tracking';
import { weekOverWeek } from '../lib/insights';

const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });

/** The short version of Progress for the Simple level: today, the streak and the last seven days. */
export function TrackingSummary() {
  const { sessions, settings } = useTimer();
  const { listening } = useSound();
  const stats = useMemo(() => dayStats(sessions, listening, 7), [sessions, listening]);
  const today = stats[stats.length - 1];
  const streak = focusStreak(sessions);
  const week = useMemo(() => weekOverWeek(sessions), [sessions]);
  const max = Math.max(1, ...stats.map((d) => d.focusSeconds));
  const goal = settings.dailyGoalMin * 60;
  return <section id="tracking" aria-labelledby="tracking-heading" className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7">
    <h2 id="tracking-heading" className="text-[26px] font-semibold leading-tight tracking-tight">Your week</h2>
    <p className="mt-2 text-[12px] leading-relaxed text-muted">A short summary. Switch the interface level to Standard or Power in Settings for the full dashboard.</p>
    <div className="mt-6 grid grid-cols-3 gap-3 text-center">
      <div className="rounded-xl border border-line bg-canvas p-4"><p className="font-mono text-[22px] font-semibold tabular-nums">{formatDuration(today.focusSeconds, true)}</p><p className="mt-1 text-[11px] text-muted">Today{goal ? ` of ${formatDuration(goal, true)}` : ''}</p></div>
      <div className="rounded-xl border border-line bg-canvas p-4"><p className="font-mono text-[22px] font-semibold tabular-nums">{streak}</p><p className="mt-1 text-[11px] text-muted">Day streak</p></div>
      <div className="rounded-xl border border-line bg-canvas p-4"><p className="font-mono text-[22px] font-semibold tabular-nums">{formatDuration(week.thisWeek, true)}</p><p className="mt-1 text-[11px] text-muted">This week</p></div>
    </div>
    <div className="mt-6 flex h-28 items-end gap-2" role="img" aria-label={`Focus time over the last seven days. Today ${formatDuration(today.focusSeconds, true)}.`}>
      {stats.map((d) => <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5"><div className="w-full rounded-md bg-ink" style={{ height: `${Math.max(3, (d.focusSeconds / max) * 84)}px`, opacity: d.focusSeconds ? 1 : .2 }} /><span className="text-[10px] text-muted">{weekday(d.day)}</span></div>)}
    </div>
  </section>;
}
