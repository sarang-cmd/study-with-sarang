import { useMemo } from 'react';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { phaseLabel } from '../components/TimerSection';
import { idlePuckState, type PuckState } from '../lib/puck';
import { usePlan, useTodos } from '../lib/plan';
import { useProfile } from '../lib/subjects';
import { useLive } from '../lib/studyRoom';
import { clock, dayStats, readListening, localDay } from '../lib/tracking';

/** Everything the puck can show, gathered in one place. It changes once a second while the timer runs. */
export function usePuckState(): PuckState {
  const sound = useSound(); const t = useTimer(); const plan = usePlan(); const todos = useTodos(); const profile = useProfile(); const live = useLive();
  const clockText = clock(t.mode === 'stopwatch' ? t.activeSeconds : t.seconds);
  const todayFocus = useMemo(() => {
    const today = dayStats(t.sessions, readListening(), 1, new Date())[0];
    return today && today.day === localDay(new Date()) ? today.focusSeconds : 0;
  }, [t.sessions, t.hasSegment]);
  const focusNow = todayFocus + (t.hasSegment && t.phase === 'focus' ? t.activeSeconds : 0);
  const goalMin = t.settings.dailyGoalMin;
  const subject = profile.subjects.find((u) => u.id === plan.subject);
  const open = todos.filter((x) => !x.done).length;
  return useMemo<PuckState>(() => ({
    ...idlePuckState,
    title: live.active && live.title ? live.title : sound.mix.name, clock: clockText, phase: phaseLabel(t.phase, t.mode), subject: subject?.short || subject?.name || '', goal: plan.goal,
    progress: t.progress, daily: goalMin > 0 ? Math.min(1, focusNow / 60 / goalMin) : null, todos: open,
    timerRunning: t.running, hasSegment: t.hasSegment, soundPlaying: live.active ? live.playing : sound.playing, mode: t.mode,
  }), [live.active, live.title, live.playing, sound.mix.name, sound.playing, clockText, t.phase, t.mode, t.running, t.hasSegment, t.progress, subject, plan.goal, goalMin, focusNow, open]);
}
