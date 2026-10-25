/** Spoken answers for "Flow, how long did I study today?" and friends. Pure text, so they are easy to test. */
import type { SessionEntry } from './tracking';
import { focusStreak } from './tracking';
import type { Todo } from './plan';

export interface AnswerData {
  now: Date; sessions: SessionEntry[]; goal: string; subject?: string; todos: Todo[]; examDays: number | null;
  timer: { mode: string; phase: string; running: boolean; seconds: number };
}

export function spokenDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 45) return 'less than a minute';
  const m = Math.round(total / 60), h = Math.floor(m / 60), rest = m % 60;
  if (h === 0) return `${m} minute${m === 1 ? '' : 's'}`;
  return `${h} hour${h === 1 ? '' : 's'}${rest ? ` ${rest} minute${rest === 1 ? '' : 's'}` : ''}`;
}
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function todaySeconds(sessions: SessionEntry[], now: Date): { seconds: number; blocks: number } {
  let seconds = 0, blocks = 0;
  for (const s of sessions) if (sameDay(new Date(s.startedAt), now)) { seconds += s.seconds; blocks += 1; }
  return { seconds, blocks };
}

export function answerInfo(kind: string, d: AnswerData): string {
  switch (kind) {
    case 'time': return `It is ${d.now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
    case 'date': return `Today is ${d.now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}.`;
    case 'today': {
      const t = todaySeconds(d.sessions, d.now);
      if (!t.blocks) return 'No study time logged yet today. A short block is a good way to start.';
      return `You studied ${spokenDuration(t.seconds)} today, in ${t.blocks} block${t.blocks === 1 ? '' : 's'}.`;
    }
    case 'streak': {
      const n = focusStreak(d.sessions, d.now);
      return n === 0 ? 'No streak right now. One session today starts one.' : `Your streak is ${n} day${n === 1 ? '' : 's'}.`;
    }
    case 'goal': return d.goal ? `Your goal: ${d.goal}.` : 'You have not set a goal yet. Say "set my goal to" and then the goal.';
    case 'todos': {
      const open = d.todos.filter((t) => !t.done);
      if (!open.length) return 'Your to-do list is empty.';
      const names = open.slice(0, 3).map((t) => t.text).join(', ');
      return `You have ${open.length} open to-do${open.length === 1 ? '' : 's'}: ${names}${open.length > 3 ? ', and more' : ''}.`;
    }
    case 'exam': {
      if (d.examDays === null) return 'No exam date is set. You can add it in Settings, Subjects.';
      if (d.examDays < 0) return 'Your exam period has already started.';
      if (d.examDays === 0) return 'Your exams start today.';
      return `${d.examDays} day${d.examDays === 1 ? '' : 's'} until your exams.`;
    }
    case 'left': {
      if (d.timer.mode === 'stopwatch') return `The stopwatch is at ${spokenDuration(d.timer.seconds)}.`;
      if (!d.timer.running && d.timer.seconds <= 0) return 'The timer is not running.';
      const what = d.timer.mode === 'pomodoro' ? (d.timer.phase === 'focus' ? ' of this focus block' : ' of this break') : '';
      return `${spokenDuration(d.timer.seconds)}${what} left${d.timer.running ? '' : ' (paused)'}.`;
    }
    default: return '';
  }
}
