/** Local-first time tracking. It stays in this browser unless the user turns on optional cloud sync. */

export type TimerMode = 'pomodoro' | 'countdown' | 'stopwatch';
export type Phase = 'focus' | 'short' | 'long';
export type BreakSound = 'keep' | 'duck' | 'pause';

export interface TimerSettings {
  focusMin: number; shortMin: number; longMin: number; cycles: number;
  autoNext: boolean; breakSound: BreakSound; syncSound: boolean;
  chime: boolean; notify: boolean; wakeLock: boolean;
  countdownMin: number; dailyGoalMin: number;
}
export const defaultTimerSettings: TimerSettings = {
  focusMin: 25, shortMin: 5, longMin: 15, cycles: 4, autoNext: true, breakSound: 'duck', syncSound: true,
  chime: true, notify: false, wakeLock: false, countdownMin: 50, dailyGoalMin: 120,
};

const num = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
const flag = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;

export function sanitizeTimerSettings(raw: unknown): TimerSettings {
  const d = defaultTimerSettings;
  if (!raw || typeof raw !== 'object') return { ...d };
  const s = raw as Record<string, unknown>;
  return {
    focusMin: num(s.focusMin, 1, 180, d.focusMin), shortMin: num(s.shortMin, 1, 60, d.shortMin), longMin: num(s.longMin, 1, 120, d.longMin),
    cycles: num(s.cycles, 2, 8, d.cycles), autoNext: flag(s.autoNext, d.autoNext),
    breakSound: s.breakSound === 'keep' || s.breakSound === 'pause' || s.breakSound === 'duck' ? s.breakSound : d.breakSound,
    syncSound: flag(s.syncSound, d.syncSound), chime: flag(s.chime, d.chime), notify: flag(s.notify, d.notify), wakeLock: flag(s.wakeLock, d.wakeLock),
    countdownMin: num(s.countdownMin, 1, 600, d.countdownMin), dailyGoalMin: num(s.dailyGoalMin, 0, 960, d.dailyGoalMin),
  };
}

export interface SessionEntry {
  id: string; startedAt: string; seconds: number; mode: TimerMode; task: string;
  completed: boolean; distractions: number; tabAways: number; mixName: string;
  /** 2.0: the subject id, the goal for the block, whether it was reached, and to-dos ticked off during it. */
  subject: string; goal: string; goalMet: '' | 'yes' | 'partly' | 'no'; todosDone: number;
  /** 2.1: how focused it felt, 1 to 5, from the wrap-up (0 = not asked). */
  focus?: number;
}

export const MIN_LOGGED_SECONDS = 30;
const SETTINGS_KEY = 'study-with-sarang:timer-settings';
const LOG_KEY = 'study-with-sarang:sessions';
const LISTEN_KEY = 'study-with-sarang:listening';
const GOAL_KEY = 'study-with-sarang:recent-tasks';

export function readTimerSettings(): TimerSettings {
  try { return sanitizeTimerSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')); } catch { return { ...defaultTimerSettings }; }
}
export function writeTimerSettings(settings: TimerSettings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Kept for this visit. */ } }

export function sanitizeSessions(raw: unknown): SessionEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SessionEntry[] = [];
  for (const entry of raw.slice(0, 5000)) {
    if (!entry || typeof entry !== 'object') continue;
    const s = entry as Record<string, unknown>;
    if (typeof s.id !== 'string' || seen.has(s.id)) continue;
    const started = typeof s.startedAt === 'string' ? new Date(s.startedAt) : null;
    if (!started || !Number.isFinite(started.getTime())) continue;
    const seconds = num(s.seconds, 0, 86_400, 0);
    if (!seconds) continue;
    seen.add(s.id);
    out.push({
      id: s.id.slice(0, 80), startedAt: started.toISOString(), seconds,
      mode: s.mode === 'countdown' || s.mode === 'stopwatch' ? s.mode : 'pomodoro',
      task: typeof s.task === 'string' ? s.task.slice(0, 60) : '', completed: s.completed === true,
      distractions: num(s.distractions, 0, 999, 0), tabAways: num(s.tabAways, 0, 999, 0),
      mixName: typeof s.mixName === 'string' ? s.mixName.slice(0, 60) : '',
      subject: typeof s.subject === 'string' ? s.subject.slice(0, 80) : '', goal: typeof s.goal === 'string' ? s.goal.slice(0, 160) : '',
      goalMet: s.goalMet === 'yes' || s.goalMet === 'partly' || s.goalMet === 'no' ? s.goalMet : '', todosDone: num(s.todosDone, 0, 99, 0),
      ...(num(s.focus, 0, 5, 0) > 0 ? { focus: num(s.focus, 0, 5, 0) } : {}),
    });
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
export function readSessions(): SessionEntry[] { try { return sanitizeSessions(JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]')); } catch { return []; } }
export function writeSessions(sessions: SessionEntry[]) { try { localStorage.setItem(LOG_KEY, JSON.stringify(sessions.slice(0, 5000))); } catch { /* Kept for this visit. */ } }

export function localDay(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function sanitizeListening(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [day, seconds] of Object.entries(raw as Record<string, unknown>).slice(0, 3700)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) { const value = num(seconds, 0, 86_400, 0); if (value) out[day] = value; }
  }
  return out;
}
export function readListening(): Record<string, number> { try { return sanitizeListening(JSON.parse(localStorage.getItem(LISTEN_KEY) ?? '{}')); } catch { return {}; } }
export function writeListening(value: Record<string, number>) { try { localStorage.setItem(LISTEN_KEY, JSON.stringify(value)); } catch { /* Kept for this visit. */ } }

export function readRecentTasks(): string[] {
  try { const raw: unknown = JSON.parse(localStorage.getItem(GOAL_KEY) ?? '[]'); return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string').slice(0, 12) : []; } catch { return []; }
}
export function rememberTask(task: string): string[] {
  const clean = task.trim().slice(0, 60);
  const next = clean ? [clean, ...readRecentTasks().filter((item) => item !== clean)].slice(0, 12) : readRecentTasks();
  try { localStorage.setItem(GOAL_KEY, JSON.stringify(next)); } catch { /* Not remembered. */ }
  return next;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface DayStat { day: string; focusSeconds: number; listenSeconds: number; sessions: number; distractions: number }

export function dayStats(sessions: SessionEntry[], listening: Record<string, number>, days: number, now = new Date()): DayStat[] {
  const byDay = new Map<string, DayStat>();
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let step = 0; step < days; step++) {
    const day = localDay(cursor);
    byDay.set(day, { day, focusSeconds: 0, listenSeconds: listening[day] ?? 0, sessions: 0, distractions: 0 });
    cursor.setDate(cursor.getDate() - 1);
  }
  for (const session of sessions) {
    const stat = byDay.get(localDay(session.startedAt));
    if (!stat) continue;
    stat.focusSeconds += session.seconds; stat.sessions++; stat.distractions += session.distractions;
  }
  return [...byDay.values()].reverse();
}

export function focusStreak(sessions: SessionEntry[], now = new Date()): number {
  const days = new Set(sessions.map((session) => localDay(session.startedAt)));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(localDay(cursor)) && count < 3650) { count++; cursor.setDate(cursor.getDate() - 1); }
  return count;
}

export function taskTotals(sessions: SessionEntry[]): { task: string; seconds: number; sessions: number }[] {
  const totals = new Map<string, { task: string; seconds: number; sessions: number }>();
  for (const session of sessions) {
    const key = session.task || 'No label';
    const entry = totals.get(key) ?? { task: key, seconds: 0, sessions: 0 };
    entry.seconds += session.seconds; entry.sessions++;
    totals.set(key, entry);
  }
  return [...totals.values()].sort((a, b) => b.seconds - a.seconds);
}

export function formatDuration(seconds: number, short = false): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60);
  if (hours) return short ? `${hours}h ${minutes}m` : `${hours} h ${minutes} min`;
  if (minutes) return short ? `${minutes}m` : `${minutes} min`;
  return `${total}${short ? 's' : ' sec'}`;
}
export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60), secs = total % 60;
  const mm = String(minutes).padStart(2, '0'), ss = String(secs).padStart(2, '0');
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

const csvCell = (value: string | number | boolean) => {
  let text = String(value);
  // Guard against spreadsheet formula injection from imported labels.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
export function sessionsToCsv(sessions: SessionEntry[]): string {
  const header = ['started_at', 'minutes', 'mode', 'label', 'completed', 'distractions', 'tab_aways', 'mix'];
  const rows = sessions.map((s) => [s.startedAt, (s.seconds / 60).toFixed(1), s.mode, s.task, s.completed, s.distractions, s.tabAways, s.mixName].map(csvCell).join(','));
  return [header.join(','), ...rows].join('\n') + '\n';
}

export function envelopeSessions(sessions: SessionEntry[]) {
  return { app: 'study-with-sarang', kind: 'sessions', version: 1, exportedAt: new Date().toISOString(), sessions };
}
