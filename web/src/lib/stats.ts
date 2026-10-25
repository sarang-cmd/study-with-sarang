import { localDay, type SessionEntry, type TimerMode } from './tracking';
import type { SubjectProfile } from './subjects';

/** Pure number-crunching for the progress explorer: filters, the yearly heatmap, per-subject numbers and the extra charts. */
const DAY = 86_400_000;
const noon = (date: Date) => { const d = new Date(date); d.setHours(12, 0, 0, 0); return d; };
const addDays = (date: Date, n: number) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const mondayOf = (date: Date) => addDays(noon(date), -((date.getDay() + 6) % 7));
const dayOf = (s: SessionEntry) => localDay(new Date(s.startedAt));

// ---- filters ---------------------------------------------------------------------------------------------
export type StatsRange = '7' | '30' | '90' | '365' | 'all';
export interface StatsFilter { range: StatsRange; subject: string; mode: 'all' | TimerMode; completedOnly: boolean; minMin: number; goalOnly: boolean }
export const defaultFilter = (): StatsFilter => ({ range: '90', subject: '', mode: 'all', completedOnly: false, minMin: 0, goalOnly: false });
export function sanitizeFilter(raw: unknown): StatsFilter {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}; const d = defaultFilter();
  return {
    range: r.range === '7' || r.range === '30' || r.range === '365' || r.range === 'all' ? r.range : d.range,
    subject: typeof r.subject === 'string' ? r.subject.slice(0, 80) : '',
    mode: r.mode === 'pomodoro' || r.mode === 'countdown' || r.mode === 'stopwatch' ? r.mode : 'all',
    completedOnly: r.completedOnly === true, goalOnly: r.goalOnly === true,
    minMin: typeof r.minMin === 'number' && Number.isFinite(r.minMin) ? Math.max(0, Math.min(180, Math.round(r.minMin))) : 0,
  };
}
export const NO_SUBJECT = '__none__';
export function rangeStart(range: StatsRange, now = new Date()): Date | null { return range === 'all' ? null : addDays(noon(now), -(Number(range) - 1)); }
/** Applies everything except the date range (the heatmap has its own). */
export function filterSessions(sessions: SessionEntry[], f: StatsFilter, now = new Date(), withRange = true): SessionEntry[] {
  const from = withRange ? rangeStart(f.range, now) : null; const fromDay = from ? localDay(from) : '';
  return sessions.filter((s) => {
    if (fromDay && dayOf(s) < fromDay) return false;
    if (f.subject === NO_SUBJECT ? s.subject !== '' : f.subject && s.subject !== f.subject) return false;
    if (f.mode !== 'all' && s.mode !== f.mode) return false;
    if (f.completedOnly && !s.completed) return false;
    if (f.goalOnly && !s.goal) return false;
    if (f.minMin && s.seconds < f.minMin * 60) return false;
    return true;
  });
}
export const filterActive = (f: StatsFilter) => f.subject !== '' || f.mode !== 'all' || f.completedOnly || f.goalOnly || f.minMin > 0;

// ---- the yearly heatmap ------------------------------------------------------------------------------------
export type HeatMetric = 'time' | 'blocks' | 'goals' | 'todos' | 'drifts' | 'listen';
export const HEAT_METRICS: { id: HeatMetric; label: string; unit: string }[] = [
  { id: 'time', label: 'Focus time', unit: 'focus' }, { id: 'blocks', label: 'Blocks', unit: 'blocks' }, { id: 'goals', label: 'Goals reached', unit: 'goals reached' },
  { id: 'todos', label: 'To-dos done', unit: 'to-dos done' }, { id: 'drifts', label: 'Drifts', unit: 'drifts' }, { id: 'listen', label: 'Listening', unit: 'listening' },
];
export function heatValues(sessions: SessionEntry[], listening: Record<string, number>, metric: HeatMetric): Map<string, number> {
  const out = new Map<string, number>();
  if (metric === 'listen') { for (const [day, v] of Object.entries(listening)) if (v > 0) out.set(day, v); return out; }
  for (const s of sessions) {
    const add = metric === 'time' ? s.seconds : metric === 'blocks' ? (s.completed ? 1 : 0) : metric === 'goals' ? (s.goalMet === 'yes' ? 1 : 0) : metric === 'todos' ? s.todosDone : s.distractions;
    if (add) out.set(dayOf(s), (out.get(dayOf(s)) ?? 0) + add);
  }
  return out;
}
/** 0 to 4 by the rank of the day among your own non-zero days, so the map always uses its full range of shades. */
export function levelScale(values: Iterable<number>): (value: number) => 0 | 1 | 2 | 3 | 4 {
  const v = [...values].filter((x) => x > 0).sort((a, b) => a - b);
  if (!v.length) return () => 0;
  return (x) => {
    if (x <= 0) return 0;
    let lo = 0, hi = v.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (v[mid] <= x) lo = mid + 1; else hi = mid; }
    return Math.max(1, Math.min(4, Math.ceil((4 * lo) / v.length))) as 1 | 2 | 3 | 4;
  };
}
export type HeatView = 'rolling' | number;
export function heatViews(sessions: SessionEntry[], now = new Date()): { id: HeatView; label: string }[] {
  const years = new Set<number>([now.getFullYear()]); for (const s of sessions) years.add(new Date(s.startedAt).getFullYear());
  return [{ id: 'rolling', label: 'Last 12 months' }, ...[...years].filter((y) => Number.isFinite(y)).sort((a, b) => b - a).map((y) => ({ id: y as HeatView, label: String(y) }))];
}
/** The view to open with. The last 12 months, so it never starts as an empty new year; if nothing was studied in that time, the latest year with data. */
export function defaultHeatView(sessions: SessionEntry[], now = new Date()): HeatView {
  const from = localDay(addDays(noon(now), -364)); const hasRecent = sessions.some((s) => dayOf(s) >= from);
  if (hasRecent || !sessions.length) return 'rolling';
  return Math.max(...sessions.map((s) => new Date(s.startedAt).getFullYear()).filter(Number.isFinite));
}
export interface HeatCell { day: string; value: number; level: number; outside: boolean; future: boolean }
export interface HeatLayout { columns: HeatCell[][]; months: { index: number; label: string }[]; start: string; end: string; total: number; activeDays: number; days: number }
export function yearLayout(values: Map<string, number>, view: HeatView, now = new Date(), locale?: string): HeatLayout {
  const today = noon(now);
  const first = view === 'rolling' ? addDays(today, -364) : new Date(view, 0, 1, 12);
  const last = view === 'rolling' ? today : new Date(view, 11, 31, 12);
  const level = levelScale([...values].filter(([day]) => day >= localDay(first) && day <= localDay(last)).map(([, v]) => v));
  const columns: HeatCell[][] = []; let total = 0, activeDays = 0;
  for (let w = mondayOf(first); w <= last; w = addDays(w, 7)) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(w, d); const key = localDay(date); const outside = date < noon(first) || date > last; const v = outside ? 0 : values.get(key) ?? 0;
      if (!outside && date <= today) { total += v; if (v > 0) activeDays++; }
      col.push({ day: key, value: v, level: level(v), outside, future: date > today });
    }
    columns.push(col);
  }
  const months: { index: number; label: string }[] = []; let prev = -1;
  columns.forEach((col, index) => {
    const cell = col.find((c) => !c.outside); if (!cell) return;
    const m = new Date(`${cell.day}T12:00:00`).getMonth();
    if (m !== prev) { months.push({ index, label: new Date(`${cell.day}T12:00:00`).toLocaleDateString(locale, { month: 'short' }) }); prev = m; }
  });
  const days = Math.round((last.getTime() - first.getTime()) / DAY) + 1;
  return { columns, months: months.filter((m, i, all) => m.index < columns.length - 2 && !(all[i + 1] && all[i + 1].index - m.index < 3)), start: localDay(first), end: localDay(last), total, activeDays, days };
}

// ---- per subject -----------------------------------------------------------------------------------------
export interface SubjectStat {
  id: string; seconds: number; share: number; blocks: number; sessions: number; avgSeconds: number; goalsSet: number; goalsYes: number; goalRate: number | null;
  todosDone: number; drifts: number; driftPerHour: number | null; lastAt: string | null; daysSince: number | null; weekSeconds: number; prevSeconds: number; trend: number | null; weeklyMin: number; weekShare: number | null;
}
export function subjectStats(sessions: SessionEntry[], profile: SubjectProfile, now = new Date()): SubjectStat[] {
  const ids = new Set<string>(profile.subjects.filter((u) => !u.archived).map((u) => u.id)); for (const s of sessions) if (s.subject) ids.add(s.subject);
  const total = sessions.reduce((sum, s) => sum + s.seconds, 0) || 1;
  const weekFrom = localDay(mondayOf(now)); const recentFrom = localDay(addDays(noon(now), -29)); const prevFrom = localDay(addDays(noon(now), -59));
  return [...ids].map((id): SubjectStat => {
    const own = sessions.filter((s) => s.subject === id);
    const seconds = own.reduce((sum, s) => sum + s.seconds, 0); const goals = own.filter((s) => s.goal);
    const yes = goals.filter((s) => s.goalMet === 'yes').length; const answered = goals.filter((s) => s.goalMet !== '').length;
    const drifts = own.reduce((sum, s) => sum + s.distractions, 0);
    const lastAt = own.length ? own.reduce((m, s) => (s.startedAt > m ? s.startedAt : m), own[0].startedAt) : null;
    const weekSeconds = own.filter((s) => dayOf(s) >= weekFrom).reduce((sum, s) => sum + s.seconds, 0);
    const recentS = own.filter((s) => dayOf(s) >= recentFrom).reduce((sum, s) => sum + s.seconds, 0);
    const prevS = own.filter((s) => dayOf(s) >= prevFrom && dayOf(s) < recentFrom).reduce((sum, s) => sum + s.seconds, 0);
    const weeklyMin = profile.subjects.find((u) => u.id === id)?.weeklyMin ?? 0;
    return {
      id, seconds, share: seconds / total, blocks: own.filter((s) => s.completed).length, sessions: own.length, avgSeconds: own.length ? seconds / own.length : 0,
      goalsSet: goals.length, goalsYes: yes, goalRate: answered ? yes / answered : null, todosDone: own.reduce((sum, s) => sum + s.todosDone, 0), drifts,
      driftPerHour: seconds >= 600 ? Math.round((drifts / (seconds / 3600)) * 10) / 10 : null, lastAt,
      daysSince: lastAt ? Math.max(0, Math.round((noon(now).getTime() - noon(new Date(lastAt)).getTime()) / DAY)) : null,
      weekSeconds, prevSeconds: prevS, trend: prevS > 0 ? Math.round(((recentS - prevS) / prevS) * 100) : null, weeklyMin, weekShare: weeklyMin > 0 ? weekSeconds / (weeklyMin * 60) : null,
    };
  }).sort((a, b) => b.seconds - a.seconds);
}
/** Time per subject for each of the last `weeks` weeks (Monday first), oldest first. */
export function weeklyBySubject(sessions: SessionEntry[], weeks: number, now = new Date()): { weekStart: string; bySubject: Map<string, number>; total: number }[] {
  const start = addDays(mondayOf(now), -(weeks - 1) * 7); const out = Array.from({ length: weeks }, (_, i) => ({ weekStart: localDay(addDays(start, i * 7)), bySubject: new Map<string, number>(), total: 0 }));
  for (const s of sessions) {
    const idx = Math.floor((mondayOf(new Date(s.startedAt)).getTime() - start.getTime()) / (7 * DAY) + 0.01); if (idx < 0 || idx >= weeks) continue;
    out[idx].bySubject.set(s.subject, (out[idx].bySubject.get(s.subject) ?? 0) + s.seconds); out[idx].total += s.seconds;
  }
  return out;
}

// ---- the other charts ----------------------------------------------------------------------------------------
export function monthlyTotals(sessions: SessionEntry[], year: number): number[] {
  const out = new Array<number>(12).fill(0); for (const s of sessions) { const d = new Date(s.startedAt); if (d.getFullYear() === year) out[d.getMonth()] += s.seconds; } return out;
}
export function cumulativeHours(sessions: SessionEntry[], from: Date, to: Date): { day: string; hours: number }[] {
  const byDay = new Map<string, number>(); for (const s of sessions) byDay.set(dayOf(s), (byDay.get(dayOf(s)) ?? 0) + s.seconds);
  const before = [...byDay].filter(([d]) => d < localDay(from)).reduce((sum, [, v]) => sum + v, 0);
  const out: { day: string; hours: number }[] = []; let run = before;
  for (let d = noon(from); d <= to; d = addDays(d, 1)) { run += byDay.get(localDay(d)) ?? 0; out.push({ day: localDay(d), hours: run / 3600 }); }
  return out;
}
export const LENGTH_BUCKETS = ['Under 15', '15 to 25', '25 to 45', '45 to 60', '60 to 90', '90 plus'];
export function lengthHistogram(sessions: SessionEntry[]): number[] {
  const out = new Array<number>(6).fill(0);
  for (const s of sessions) { const m = s.seconds / 60; out[m < 15 ? 0 : m < 25 ? 1 : m < 45 ? 2 : m < 60 ? 3 : m < 90 ? 4 : 5]++; }
  return out;
}
/** Seconds for each weekday (Monday first) and starting hour. */
export function weekdayHourGrid(sessions: SessionEntry[]): number[][] {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const s of sessions) { const d = new Date(s.startedAt); grid[(d.getDay() + 6) % 7][d.getHours()] += s.seconds; }
  return grid;
}
export interface Streak { from: string; to: string; length: number }
export function streakHistory(sessions: SessionEntry[], limit = 5): Streak[] {
  const days = [...new Set(sessions.map(dayOf))].sort(); const runs: Streak[] = []; let cur: Streak | null = null; let prev = 0;
  for (const key of days) {
    const [y, m, d] = key.split('-').map(Number); const n = Math.round(Date.UTC(y, m - 1, d) / DAY);
    if (cur && n === prev + 1) { cur.to = key; cur.length++; } else { cur = { from: key, to: key, length: 1 }; runs.push(cur); }
    prev = n;
  }
  return runs.sort((a, b) => b.length - a.length || b.to.localeCompare(a.to)).slice(0, limit);
}
export function consistency(sessions: SessionEntry[], from: Date, to: Date): { activeDays: number; days: number; pct: number } {
  const fromKey = localDay(from), toKey = localDay(to); const active = new Set(sessions.map(dayOf).filter((k) => k >= fromKey && k <= toKey)).size;
  const days = Math.max(1, Math.round((noon(to).getTime() - noon(from).getTime()) / DAY) + 1);
  return { activeDays: active, days, pct: Math.round((active / days) * 100) };
}
export interface Records { bestDay: { day: string; seconds: number } | null; bestWeek: { weekStart: string; seconds: number } | null; longest: { at: string; seconds: number } | null; mostBlocks: { day: string; blocks: number } | null }
export function records(sessions: SessionEntry[]): Records {
  const days = new Map<string, number>(), weeks = new Map<string, number>(), blocks = new Map<string, number>();
  let longest: Records['longest'] = null;
  for (const s of sessions) {
    const k = dayOf(s); days.set(k, (days.get(k) ?? 0) + s.seconds); const w = localDay(mondayOf(new Date(s.startedAt))); weeks.set(w, (weeks.get(w) ?? 0) + s.seconds);
    if (s.completed) blocks.set(k, (blocks.get(k) ?? 0) + 1); if (!longest || s.seconds > longest.seconds) longest = { at: s.startedAt, seconds: s.seconds };
  }
  const top = <T extends string>(m: Map<T, number>) => [...m].sort((a, b) => b[1] - a[1])[0];
  const d = top(days), w = top(weeks), b = top(blocks);
  return { bestDay: d ? { day: d[0], seconds: d[1] } : null, bestWeek: w ? { weekStart: w[0], seconds: w[1] } : null, longest, mostBlocks: b ? { day: b[0], blocks: b[1] } : null };
}
/** Share of answered block goals that were reached, by week (Monday first), oldest first. Null when no goal was answered that week. */
export function goalRateByWeek(sessions: SessionEntry[], weeks: number, now = new Date()): (number | null)[] {
  const start = addDays(mondayOf(now), -(weeks - 1) * 7); const yes = new Array<number>(weeks).fill(0), all = new Array<number>(weeks).fill(0);
  for (const s of sessions) { if (!s.goal || s.goalMet === '') continue; const i = Math.floor((mondayOf(new Date(s.startedAt)).getTime() - start.getTime()) / (7 * DAY) + 0.01); if (i < 0 || i >= weeks) continue; all[i]++; if (s.goalMet === 'yes') yes[i]++; }
  return all.map((n, i) => (n ? yes[i] / n : null));
}
