import { localDay, type SessionEntry } from './tracking';

/** Pure number-crunching for the Tracking page. Everything works on the local session log, grouped by local day. */

const DAY = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const daysAgo = (now: Date, days: number) => { const d = startOfDay(now); d.setDate(d.getDate() - days); return d; };
const inWindow = (session: SessionEntry, from: Date, to: Date) => { const t = new Date(session.startedAt).getTime(); return t >= from.getTime() && t < to.getTime(); };

/** The last `days` days including today. */
export function recent(sessions: SessionEntry[], days: number, now = new Date()): SessionEntry[] {
  const from = daysAgo(now, days - 1), to = new Date(startOfDay(now).getTime() + DAY + 3_600_000);
  return sessions.filter((s) => inWindow(s, from, to));
}

export interface WeekdayTotal { index: number; seconds: number; sessions: number; days: number }
/** Focus seconds by weekday, Monday first, over the last `days` days. `days` counts how many of each weekday were in range. */
export function weekdayTotals(sessions: SessionEntry[], days = 84, now = new Date()): WeekdayTotal[] {
  const out: WeekdayTotal[] = Array.from({ length: 7 }, (_, index) => ({ index, seconds: 0, sessions: 0, days: 0 }));
  for (let step = 0; step < days; step++) out[(daysAgo(now, step).getDay() + 6) % 7].days++;
  for (const s of recent(sessions, days, now)) { const slot = out[(new Date(s.startedAt).getDay() + 6) % 7]; slot.seconds += s.seconds; slot.sessions++; }
  return out;
}

/** Focus seconds by the hour a session started (24 values). */
export function hourBuckets(sessions: SessionEntry[], days = 84, now = new Date()): number[] {
  const out = new Array<number>(24).fill(0);
  for (const s of recent(sessions, days, now)) out[new Date(s.startedAt).getHours()] += s.seconds;
  return out;
}
/** The best three-hour window as [startHour, endHour], or null with no data. */
export function peakWindow(buckets: number[]): [number, number] | null {
  let best = -1, at = 0;
  for (let h = 0; h < 24; h++) { const sum = buckets[h] + buckets[(h + 1) % 24] + buckets[(h + 2) % 24]; if (sum > best) { best = sum; at = h; } }
  return best > 0 ? [at, (at + 3) % 24] : null;
}

export interface MixTotal { name: string; seconds: number; sessions: number }
export function topMixes(sessions: SessionEntry[], limit = 5): MixTotal[] {
  const map = new Map<string, MixTotal>();
  for (const s of sessions) {
    const name = s.mixName.trim() || 'No sound';
    const item = map.get(name) ?? { name, seconds: 0, sessions: 0 };
    item.seconds += s.seconds; item.sessions++; map.set(name, item);
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name)).slice(0, limit);
}

export interface SessionAverages { count: number; avgSeconds: number; medianSeconds: number; longestSeconds: number }
export function sessionAverages(sessions: SessionEntry[]): SessionAverages {
  if (!sessions.length) return { count: 0, avgSeconds: 0, medianSeconds: 0, longestSeconds: 0 };
  const sorted = sessions.map((s) => s.seconds).sort((a, b) => a - b);
  const total = sorted.reduce((a, b) => a + b, 0);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { count: sorted.length, avgSeconds: Math.round(total / sorted.length), medianSeconds: Math.round(median), longestSeconds: sorted[sorted.length - 1] };
}

/** Share of sessions that ran to the end (0..1), or null with no sessions. */
export function completionRate(sessions: SessionEntry[]): number | null {
  return sessions.length ? sessions.filter((s) => s.completed).length / sessions.length : null;
}

/** Self-reported distractions per focused hour. Null until there are ten minutes to measure. */
export function distractionsPerHour(sessions: SessionEntry[]): number | null {
  const seconds = sessions.reduce((a, s) => a + s.seconds, 0);
  if (seconds < 600) return null;
  return Math.round((sessions.reduce((a, s) => a + s.distractions, 0) / (seconds / 3600)) * 10) / 10;
}

export interface WeekOverWeek { thisWeek: number; lastWeek: number; changePct: number | null }
/** The last 7 days against the 7 before them. */
export function weekOverWeek(sessions: SessionEntry[], now = new Date()): WeekOverWeek {
  const end = new Date(startOfDay(now).getTime() + DAY + 3_600_000), mid = daysAgo(now, 6), start = daysAgo(now, 13);
  let thisWeek = 0, lastWeek = 0;
  for (const s of sessions) { if (inWindow(s, mid, end)) thisWeek += s.seconds; else if (inWindow(s, start, mid)) lastWeek += s.seconds; }
  return { thisWeek, lastWeek, changePct: lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null };
}

export interface GoalDays { hit: number; of: number; streak: number }
/** Days that reached the daily goal in the last `days` days, and the current run of such days (today may still be open). */
export function goalDays(sessions: SessionEntry[], goalMinutes: number, days = 30, now = new Date()): GoalDays {
  if (goalMinutes <= 0) return { hit: 0, of: days, streak: 0 };
  const totals = new Map<string, number>();
  for (const s of sessions) { const day = localDay(s.startedAt); totals.set(day, (totals.get(day) ?? 0) + s.seconds); }
  const goal = goalMinutes * 60;
  let hit = 0;
  for (let step = 0; step < days; step++) if ((totals.get(localDay(daysAgo(now, step))) ?? 0) >= goal) hit++;
  let streak = 0, step = (totals.get(localDay(daysAgo(now, 0))) ?? 0) >= goal ? 0 : 1;
  while (step < 3650 && (totals.get(localDay(daysAgo(now, step))) ?? 0) >= goal) { streak++; step++; }
  return { hit, of: days, streak };
}

export interface MonthTotal { seconds: number; activeDays: number; sessions: number; daysSoFar: number }
export function monthTotal(sessions: SessionEntry[], now = new Date()): MonthTotal {
  const days = new Set<string>(); let seconds = 0, count = 0;
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) { seconds += s.seconds; count++; days.add(localDay(d)); }
  }
  return { seconds, activeDays: days.size, sessions: count, daysSoFar: now.getDate() };
}

// ------------------------------------------------------------------------------------------ heatmap
export const HEAT_MIN_WEEKS = 12, HEAT_MAX_WEEKS = 53;
/** How many week columns fit a card of `width` px with square cells of at least `minCell` px. Cells then grow to fill. */
export function heatWeeksFor(width: number, gap = 3, minCell = 11, labelWidth = 0): number {
  const usable = Math.max(0, width - labelWidth);
  const weeks = Math.floor((usable + gap) / (minCell + gap));
  return Math.max(HEAT_MIN_WEEKS, Math.min(HEAT_MAX_WEEKS, weeks));
}
/** Columns of 7 days (Monday first), ending with the current week. */
export function heatGrid(totals: Map<string, number>, weeks: number, now = new Date()): { day: string; seconds: number; future: boolean }[][] {
  const today = new Date(now); today.setHours(12, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7);
  const columns: { day: string; seconds: number; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: { day: string; seconds: number; future: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start); date.setDate(start.getDate() + w * 7 + d);
      const key = localDay(date);
      column.push({ day: key, seconds: totals.get(key) ?? 0, future: date > today });
    }
    columns.push(column);
  }
  return columns;
}
export const heatLevel = (seconds: number) => (seconds <= 0 ? 0 : seconds < 25 * 60 ? 1 : seconds < 60 * 60 ? 2 : seconds < 120 * 60 ? 3 : 4);
