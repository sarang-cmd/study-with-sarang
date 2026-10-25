import { localDay, type SessionEntry } from './tracking';

/**
 * Achievements are worked out from data the app already keeps (sessions, listening time, saved mixes, subjects, goals),
 * so they are never lost, can be recalculated on any device and cannot be gained by pressing buttons. Only the date each
 * one unlocked is stored, so a message appears once. Most of the later ones are meant to take weeks or months.
 */
export type AchievementCategory = 'focus' | 'streak' | 'sessions' | 'depth' | 'habits' | 'sound' | 'subjects' | 'goals';
export type IconKey =
  | 'sparkles' | 'hourglass' | 'brain' | 'mountain' | 'shield' | 'crown' | 'gem' | 'flame' | 'zap' | 'calendar' | 'anchor' | 'infinity'
  | 'layers' | 'castle' | 'trophy' | 'telescope' | 'rocket' | 'orbit' | 'feather' | 'flower' | 'sunrise' | 'moon' | 'party'
  | 'target' | 'medal' | 'headphones' | 'waveform' | 'sliders' | 'wand' | 'compass' | 'tags' | 'award'
  | 'book' | 'graduation' | 'checks' | 'crosshair' | 'sun' | 'clock' | 'flag' | 'dumbbell' | 'key' | 'star' | 'library' | 'puzzle' | 'trend' | 'eye' | 'ghost' | 'diamond';
export type MetricKey =
  | 'sessionsLogged' | 'focusHours' | 'longestStreak' | 'completedBlocks' | 'longestSessionMin' | 'cleanBlocks'
  | 'earlyBird' | 'nightOwl' | 'weekends' | 'goalDays' | 'listenHours' | 'savedMixes' | 'mixesUsed' | 'labels'
  | 'daysStudied' | 'bestDayHours' | 'bestWeekHours' | 'blocksInDay' | 'cleanRun' | 'cleanLong' | 'quietDays' | 'goalDayStreak' | 'comebacks'
  | 'subjectsStudied' | 'subjectHoursMax' | 'subjectsWith10h' | 'subjectsWith25h' | 'subjectsInDay' | 'subjectsInWeek'
  | 'goalsSet' | 'goalsReached' | 'goalRun' | 'todosDone'
  | 'midnight' | 'newYear' | 'elevenEleven';

export interface AchievementDef {
  id: string; title: string; text: string; category: AchievementCategory; tier: 1 | 2 | 3 | 4; icon: IconKey;
  metric: MetricKey; target: number; unit: string;
  /** Hidden until unlocked. */
  secret?: boolean;
}
export type Metrics = Record<MetricKey, number>;
export interface AchievementInput { sessions: SessionEntry[]; listening: Record<string, number>; savedMixes: number; goalMinutes: number; todosDone?: number }
export interface AchievementResult { def: AchievementDef; value: number; unlocked: boolean; progress: number }

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  focus: 'Focus time', streak: 'Streaks', sessions: 'Blocks', depth: 'Depth', habits: 'Habits', sound: 'Sound', subjects: 'Subjects', goals: 'Goals',
};

const a = (id: string, title: string, text: string, category: AchievementCategory, tier: 1 | 2 | 3 | 4, icon: IconKey, metric: MetricKey, target: number, unit: string, secret = false): AchievementDef =>
  ({ id, title, text, category, tier, icon, metric, target, unit, ...(secret ? { secret: true } : {}) });

export const ACHIEVEMENTS: AchievementDef[] = [
  a('first-light', 'First light', 'Log your first session.', 'focus', 1, 'sparkles', 'sessionsLogged', 1, 'sessions'),
  a('warm-up', 'Warm-up', 'Focus for 1 hour in total.', 'focus', 1, 'hourglass', 'focusHours', 1, 'h'),
  a('in-the-zone', 'In the zone', 'Focus for 10 hours in total.', 'focus', 2, 'brain', 'focusHours', 10, 'h'),
  a('full-day', 'A whole day', 'Focus for 24 hours in total.', 'focus', 2, 'sun', 'focusHours', 24, 'h'),
  a('deep-roots', 'Deep roots', 'Focus for 50 hours in total.', 'focus', 3, 'mountain', 'focusHours', 50, 'h'),
  a('centurion', 'Centurion', 'Focus for 100 hours in total.', 'focus', 3, 'shield', 'focusHours', 100, 'h'),
  a('titan', 'Titan', 'Focus for 250 hours in total.', 'focus', 4, 'crown', 'focusHours', 250, 'h'),
  a('legend', 'Legend', 'Focus for 500 hours in total.', 'focus', 4, 'gem', 'focusHours', 500, 'h'),
  a('thousand', 'The thousand', 'Focus for 1,000 hours in total.', 'focus', 4, 'diamond', 'focusHours', 1000, 'h'),
  a('days-30', 'Thirty days', 'Study on 30 different days.', 'focus', 2, 'calendar', 'daysStudied', 30, 'days'),
  a('days-100', 'Hundred days', 'Study on 100 different days.', 'focus', 3, 'calendar', 'daysStudied', 100, 'days'),
  a('days-250', 'Regular', 'Study on 250 different days.', 'focus', 4, 'calendar', 'daysStudied', 250, 'days'),

  a('spark', 'Spark', 'Focus on 3 days in a row.', 'streak', 1, 'flame', 'longestStreak', 3, 'days'),
  a('week-warrior', 'Week warrior', 'Focus on 7 days in a row.', 'streak', 2, 'zap', 'longestStreak', 7, 'days'),
  a('fortnight', 'Fortnight', 'Focus on 14 days in a row.', 'streak', 2, 'calendar', 'longestStreak', 14, 'days'),
  a('three-weeks', 'Three weeks', 'Focus on 21 days in a row.', 'streak', 3, 'flame', 'longestStreak', 21, 'days'),
  a('unbreakable', 'Unbreakable', 'Focus on 30 days in a row.', 'streak', 3, 'anchor', 'longestStreak', 30, 'days'),
  a('habit', 'A habit', 'Focus on 66 days in a row.', 'streak', 4, 'key', 'longestStreak', 66, 'days'),
  a('endless', 'Endless', 'Focus on 100 days in a row.', 'streak', 4, 'infinity', 'longestStreak', 100, 'days'),
  a('full-orbit', 'Full orbit', 'Focus on 365 days in a row.', 'streak', 4, 'orbit', 'longestStreak', 365, 'days', true),
  a('comeback', 'Comeback', 'Return after a week or more away and study 3 days in a row.', 'streak', 2, 'trend', 'comebacks', 1, 'returns'),
  a('comeback-3', 'Always back', 'Make 3 comebacks of 3 days or more after a week away.', 'streak', 3, 'trend', 'comebacks', 3, 'returns'),

  a('block-builder', 'Block builder', 'Finish 10 timer blocks.', 'sessions', 1, 'layers', 'completedBlocks', 10, 'blocks'),
  a('stacked', 'Stacked', 'Finish 50 timer blocks.', 'sessions', 2, 'castle', 'completedBlocks', 50, 'blocks'),
  a('hundred-club', 'Hundred club', 'Finish 100 timer blocks.', 'sessions', 3, 'trophy', 'completedBlocks', 100, 'blocks'),
  a('quarter-k', 'Quarter thousand', 'Finish 250 timer blocks.', 'sessions', 3, 'award', 'completedBlocks', 250, 'blocks'),
  a('five-hundred', 'Five hundred', 'Finish 500 timer blocks.', 'sessions', 4, 'award', 'completedBlocks', 500, 'blocks'),
  a('thousand-blocks', 'A thousand blocks', 'Finish 1,000 timer blocks.', 'sessions', 4, 'castle', 'completedBlocks', 1000, 'blocks'),
  a('eight-a-day', 'Full stack', 'Finish 8 blocks on one day.', 'sessions', 2, 'layers', 'blocksInDay', 8, 'blocks'),
  a('twelve-a-day', 'Relentless', 'Finish 12 blocks on one day.', 'sessions', 3, 'dumbbell', 'blocksInDay', 12, 'blocks'),

  a('deep-diver', 'Deep diver', 'One session of 60 minutes or more.', 'depth', 2, 'telescope', 'longestSessionMin', 60, 'min'),
  a('marathon', 'Marathon', 'One session of 90 minutes or more.', 'depth', 3, 'rocket', 'longestSessionMin', 90, 'min'),
  a('orbit', 'In orbit', 'One session of 3 hours or more.', 'depth', 4, 'orbit', 'longestSessionMin', 180, 'min'),
  a('clear-mind', 'Clear mind', 'Finish a 25 minute block without a single distraction.', 'depth', 1, 'feather', 'cleanBlocks', 1, 'blocks'),
  a('still-water', 'Still water', 'Finish 10 blocks of 25 minutes or more with no distractions.', 'depth', 3, 'flower', 'cleanBlocks', 10, 'blocks'),
  a('still-lake', 'Still lake', 'Finish 50 blocks of 25 minutes or more with no distractions.', 'depth', 4, 'flower', 'cleanBlocks', 50, 'blocks'),
  a('unbroken-hour', 'Unbroken hour', 'Study for an hour or more without marking a single distraction.', 'depth', 3, 'eye', 'cleanLong', 1, 'sessions'),
  a('unshaken', 'Unshaken', 'Ten blocks in a row with no distraction marked.', 'depth', 3, 'shield', 'cleanRun', 10, 'blocks'),
  a('unshaken-30', 'Unshakeable', 'Thirty blocks in a row with no distraction marked.', 'depth', 4, 'shield', 'cleanRun', 30, 'blocks'),
  a('long-day', 'A long day', 'Focus for 4 hours on a single day.', 'depth', 3, 'sun', 'bestDayHours', 4, 'h'),
  a('deep-day', 'A deep day', 'Focus for 6 hours on a single day.', 'depth', 4, 'mountain', 'bestDayHours', 6, 'h'),
  a('iron-will', 'Iron will', 'Focus for 8 hours on a single day.', 'depth', 4, 'dumbbell', 'bestDayHours', 8, 'h', true),
  a('good-week', 'A good week', 'Focus for 15 hours in one week.', 'depth', 2, 'calendar', 'bestWeekHours', 15, 'h'),
  a('big-week', 'A big week', 'Focus for 25 hours in one week.', 'depth', 3, 'rocket', 'bestWeekHours', 25, 'h'),
  a('huge-week', 'An enormous week', 'Focus for 40 hours in one week.', 'depth', 4, 'crown', 'bestWeekHours', 40, 'h'),
  a('quiet-days', 'Quiet minds', 'Have 10 days of an hour or more with no distraction marked.', 'depth', 3, 'feather', 'quietDays', 10, 'days'),
  a('quiet-days-30', 'A quiet year', 'Have 30 days of an hour or more with no distraction marked.', 'depth', 4, 'feather', 'quietDays', 30, 'days'),

  a('early-bird', 'Early bird', 'Start a session before 7 in the morning.', 'habits', 2, 'sunrise', 'earlyBird', 1, 'sessions'),
  a('dawn-patrol', 'Dawn patrol', 'Start 10 sessions before 7 in the morning.', 'habits', 3, 'sunrise', 'earlyBird', 10, 'sessions'),
  a('dawn-30', 'Sunrise club', 'Start 30 sessions before 7 in the morning.', 'habits', 4, 'sunrise', 'earlyBird', 30, 'sessions'),
  a('night-owl', 'Night owl', 'Start a session after 10 at night.', 'habits', 2, 'moon', 'nightOwl', 1, 'sessions'),
  a('night-shift', 'Night shift', 'Start 10 sessions after 10 at night.', 'habits', 3, 'moon', 'nightOwl', 10, 'sessions'),
  a('midnight-oil', 'Midnight oil', 'Study for 20 minutes or more between midnight and 4 in the morning.', 'habits', 2, 'ghost', 'midnight', 1, 'sessions', true),
  a('new-year', 'New year, new focus', 'Study on 1 January.', 'habits', 2, 'party', 'newYear', 1, 'days', true),
  a('eleven-eleven', 'Make a wish', 'Start a session at 11:11.', 'habits', 1, 'star', 'elevenEleven', 1, 'sessions', true),
  a('weekend-warrior', 'Weekend warrior', 'Focus on both Saturday and Sunday of the same weekend.', 'habits', 2, 'party', 'weekends', 1, 'weekends'),
  a('weekend-4', 'Weekend regular', 'Focus on both days of 4 weekends.', 'habits', 3, 'party', 'weekends', 4, 'weekends'),
  a('weekend-12', 'No days off', 'Focus on both days of 12 weekends.', 'habits', 4, 'party', 'weekends', 12, 'weekends'),
  a('on-target', 'On target', 'Reach your daily goal once.', 'habits', 1, 'target', 'goalDays', 1, 'days'),
  a('goal-getter', 'Goal getter', 'Reach your daily goal on 7 days.', 'habits', 2, 'medal', 'goalDays', 7, 'days'),
  a('goal-machine', 'Goal machine', 'Reach your daily goal on 30 days.', 'habits', 3, 'trophy', 'goalDays', 30, 'days'),
  a('goal-100', 'Hundred on target', 'Reach your daily goal on 100 days.', 'habits', 4, 'trophy', 'goalDays', 100, 'days'),
  a('perfect-week', 'Perfect week', 'Reach your daily goal 7 days in a row.', 'habits', 3, 'crosshair', 'goalDayStreak', 7, 'days'),
  a('perfect-month', 'Perfect month', 'Reach your daily goal 30 days in a row.', 'habits', 4, 'crosshair', 'goalDayStreak', 30, 'days'),

  a('good-listener', 'Good listener', 'Listen to your sounds for 10 hours in total.', 'sound', 1, 'headphones', 'listenHours', 10, 'h'),
  a('sound-sage', 'Sound sage', 'Listen to your sounds for 100 hours in total.', 'sound', 3, 'waveform', 'listenHours', 100, 'h'),
  a('sound-master', 'Sound master', 'Listen to your sounds for 300 hours in total.', 'sound', 4, 'waveform', 'listenHours', 300, 'h'),
  a('mixologist', 'Mixologist', 'Save your first mix.', 'sound', 1, 'sliders', 'savedMixes', 1, 'mixes'),
  a('sound-designer', 'Sound designer', 'Save 5 mixes.', 'sound', 2, 'wand', 'savedMixes', 5, 'mixes'),
  a('sound-library', 'Sound library', 'Save 12 mixes.', 'sound', 3, 'library', 'savedMixes', 12, 'mixes'),
  a('explorer', 'Explorer', 'Focus with 3 different mixes.', 'sound', 1, 'compass', 'mixesUsed', 3, 'mixes'),
  a('connoisseur', 'Connoisseur', 'Focus with 8 different mixes.', 'sound', 3, 'compass', 'mixesUsed', 8, 'mixes'),
  a('many-hats', 'Many hats', 'Study 5 different subjects (labels).', 'sound', 2, 'tags', 'labels', 5, 'labels'),

  a('all-rounder', 'All-rounder', 'Study 3 different subjects on one day.', 'subjects', 2, 'puzzle', 'subjectsInDay', 3, 'subjects'),
  a('well-rounded', 'Well rounded', 'Study 5 different subjects in one week.', 'subjects', 3, 'puzzle', 'subjectsInWeek', 5, 'subjects'),
  a('full-set', 'The full set', 'Log study time in 6 different subjects.', 'subjects', 2, 'graduation', 'subjectsStudied', 6, 'subjects'),
  a('subject-25', 'Getting serious', 'Spend 25 hours on a single subject.', 'subjects', 2, 'book', 'subjectHoursMax', 25, 'h'),
  a('subject-100', 'Specialist', 'Spend 100 hours on a single subject.', 'subjects', 3, 'book', 'subjectHoursMax', 100, 'h'),
  a('subject-250', 'Master of one', 'Spend 250 hours on a single subject.', 'subjects', 4, 'graduation', 'subjectHoursMax', 250, 'h'),
  a('every-subject', 'Every subject counts', 'Spend 10 hours on each of 6 subjects.', 'subjects', 3, 'library', 'subjectsWith10h', 6, 'subjects'),
  a('every-subject-25', 'Balanced to the end', 'Spend 25 hours on each of 6 subjects.', 'subjects', 4, 'library', 'subjectsWith25h', 6, 'subjects'),

  a('aim-hit', 'Aimed and hit', 'Set a goal for a block and reach it.', 'goals', 1, 'crosshair', 'goalsReached', 1, 'goals'),
  a('planner', 'Planner', 'Set a goal for 25 blocks.', 'goals', 2, 'flag', 'goalsSet', 25, 'blocks'),
  a('goals-10', 'On a roll', 'Reach 10 block goals.', 'goals', 2, 'target', 'goalsReached', 10, 'goals'),
  a('goals-50', 'Sharp aim', 'Reach 50 block goals.', 'goals', 3, 'target', 'goalsReached', 50, 'goals'),
  a('goals-150', 'Never misses', 'Reach 150 block goals.', 'goals', 4, 'crosshair', 'goalsReached', 150, 'goals'),
  a('sharpshooter', 'Sharpshooter', 'Reach your goal in 5 blocks in a row.', 'goals', 3, 'crosshair', 'goalRun', 5, 'goals'),
  a('todo-10', 'Ticking along', 'Tick off 10 to-dos.', 'goals', 1, 'checks', 'todosDone', 10, 'to-dos'),
  a('todo-50', 'Getting things done', 'Tick off 50 to-dos.', 'goals', 2, 'checks', 'todosDone', 50, 'to-dos'),
  a('todo-200', 'List slayer', 'Tick off 200 to-dos.', 'goals', 3, 'checks', 'todosDone', 200, 'to-dos'),
  a('todo-500', 'Unstoppable list', 'Tick off 500 to-dos.', 'goals', 4, 'checks', 'todosDone', 500, 'to-dos'),
];

const weekKey = (date: Date) => { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7)); return localDay(d); };
const dayNumber = (key: string) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86_400_000); };
/** Runs of consecutive day keys: [firstDay, lastDay, length]. */
function dayRuns(keys: string[]): [number, number, number][] {
  const nums = [...new Set(keys.map(dayNumber))].sort((x, y) => x - y); const runs: [number, number, number][] = [];
  for (const n of nums) { const last = runs[runs.length - 1]; if (last && n === last[1] + 1) { last[1] = n; last[2] += 1; } else runs.push([n, n, 1]); }
  return runs;
}

export function computeMetrics({ sessions, listening, savedMixes, goalMinutes, todosDone = 0 }: AchievementInput): Metrics {
  const days = new Map<string, number>(); const dayBlocks = new Map<string, number>(); const dayDistract = new Map<string, number>();
  const weeks = new Map<string, number>(); const daySubjects = new Map<string, Set<string>>(); const weekSubjects = new Map<string, Set<string>>();
  const subjectSeconds = new Map<string, number>();
  const mixes = new Set<string>(), labels = new Set<string>();
  const weekendDays = new Map<string, Set<number>>();
  let seconds = 0, completed = 0, longest = 0, clean = 0, early = 0, night = 0, cleanLong = 0, midnight = 0, elevenEleven = 0, goalsSet = 0, goalsReached = 0, sessionTodos = 0;
  const newYearDays = new Set<string>();
  const ordered = [...sessions].sort((x, y) => x.startedAt.localeCompare(y.startedAt));
  let cleanRun = 0, cleanRunBest = 0, goalRun = 0, goalRunBest = 0;
  for (const s of ordered) {
    seconds += s.seconds;
    longest = Math.max(longest, s.seconds);
    if (s.completed) completed++;
    if (s.completed && s.seconds >= 25 * 60 && s.distractions === 0) clean++;
    if (s.seconds >= 3600 && s.distractions === 0) cleanLong++;
    sessionTodos += s.todosDone ?? 0;
    if (s.seconds >= 10 * 60) { if (s.distractions > 0) cleanRun = 0; else { cleanRun++; cleanRunBest = Math.max(cleanRunBest, cleanRun); } }
    if (s.goal) { goalsSet++; if (s.goalMet === 'yes') { goalsReached++; goalRun++; goalRunBest = Math.max(goalRunBest, goalRun); } else if (s.goalMet === 'partly' || s.goalMet === 'no') goalRun = 0; }
    const start = new Date(s.startedAt);
    if (Number.isNaN(start.getTime())) continue;
    const key = localDay(start); const wk = weekKey(start);
    days.set(key, (days.get(key) ?? 0) + s.seconds); weeks.set(wk, (weeks.get(wk) ?? 0) + s.seconds);
    dayDistract.set(key, (dayDistract.get(key) ?? 0) + s.distractions);
    if (s.completed) dayBlocks.set(key, (dayBlocks.get(key) ?? 0) + 1);
    const hour = start.getHours();
    if (s.seconds >= 10 * 60) { if (hour < 7) early++; if (hour >= 22) night++; if (start.getMonth() === 0 && start.getDate() === 1) newYearDays.add(key); }
    if (s.seconds >= 20 * 60 && hour < 4) midnight++;
    if (s.seconds >= 5 * 60 && start.getMinutes() === 11 && (hour === 11 || hour === 23)) elevenEleven++;
    if (s.mixName.trim()) mixes.add(s.mixName.trim().toLowerCase());
    if (s.task.trim()) labels.add(s.task.trim().toLowerCase());
    if (s.subject) {
      subjectSeconds.set(s.subject, (subjectSeconds.get(s.subject) ?? 0) + s.seconds);
      if (s.seconds >= 5 * 60) {
        (daySubjects.get(key) ?? daySubjects.set(key, new Set()).get(key)!).add(s.subject);
        (weekSubjects.get(wk) ?? weekSubjects.set(wk, new Set()).get(wk)!).add(s.subject);
      }
    }
    const dow = start.getDay();
    if (dow === 6 || dow === 0) {
      // A weekend belongs to the Saturday that starts it, so Sunday looks back one day.
      const saturday = new Date(start.getFullYear(), start.getMonth(), start.getDate() - (dow === 0 ? 1 : 0));
      const id = localDay(saturday);
      const set = weekendDays.get(id) ?? new Set<number>(); set.add(dow); weekendDays.set(id, set);
    }
  }
  const runs = dayRuns([...days.keys()]);
  const longestStreak = runs.reduce((best, r) => Math.max(best, r[2]), 0);
  let comebacks = 0; for (let i = 1; i < runs.length; i++) if (runs[i][0] - runs[i - 1][1] - 1 >= 7 && runs[i][2] >= 3) comebacks++;
  const goalSeconds = Math.max(1, goalMinutes) * 60;
  const goalKeys = [...days.entries()].filter(([, total]) => total >= goalSeconds).map(([key]) => key);
  const goalDayStreak = dayRuns(goalKeys).reduce((best, r) => Math.max(best, r[2]), 0);
  const listenSeconds = Object.values(listening).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const perSubject = [...subjectSeconds.values()];
  const max = (values: Iterable<number>) => { let m = 0; for (const v of values) m = Math.max(m, v); return m; };
  return {
    sessionsLogged: sessions.length, focusHours: seconds / 3600, longestStreak, completedBlocks: completed,
    longestSessionMin: longest / 60, cleanBlocks: clean, earlyBird: early, nightOwl: night,
    weekends: [...weekendDays.values()].filter((set) => set.has(6) && set.has(0)).length,
    goalDays: goalKeys.length, listenHours: listenSeconds / 3600, savedMixes: Math.max(0, savedMixes), mixesUsed: mixes.size, labels: labels.size,
    daysStudied: days.size, bestDayHours: max(days.values()) / 3600, bestWeekHours: max(weeks.values()) / 3600, blocksInDay: max(dayBlocks.values()),
    cleanRun: cleanRunBest, cleanLong, quietDays: [...days.entries()].filter(([key, total]) => total >= 3600 && (dayDistract.get(key) ?? 0) === 0).length,
    goalDayStreak, comebacks,
    subjectsStudied: perSubject.length, subjectHoursMax: max(perSubject) / 3600,
    subjectsWith10h: perSubject.filter((v) => v >= 36_000).length, subjectsWith25h: perSubject.filter((v) => v >= 90_000).length,
    subjectsInDay: max([...daySubjects.values()].map((set) => set.size)), subjectsInWeek: max([...weekSubjects.values()].map((set) => set.size)),
    goalsSet, goalsReached, goalRun: goalRunBest, todosDone: Math.max(sessionTodos, Math.max(0, todosDone)),
    midnight, newYear: newYearDays.size, elevenEleven,
  };
}

export function evaluateAchievements(input: AchievementInput): AchievementResult[] {
  const metrics = computeMetrics(input);
  return ACHIEVEMENTS.map((def) => {
    const value = metrics[def.metric];
    return { def, value, unlocked: value >= def.target, progress: Math.max(0, Math.min(1, value / def.target)) };
  });
}

// ---- what has been unlocked, remembered per device ------------------------------------------------
export interface UnlockStore { seeded: boolean; unlocked: Record<string, string> }
export const ACHIEVEMENTS_KEY = 'study-with-sarang:achievements';

export function sanitizeStore(raw: unknown): UnlockStore {
  const known = new Set(ACHIEVEMENTS.map((item) => item.id));
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const unlocked: Record<string, string> = {};
  if (r.unlocked && typeof r.unlocked === 'object' && !Array.isArray(r.unlocked)) {
    for (const [id, at] of Object.entries(r.unlocked as Record<string, unknown>)) if (known.has(id) && typeof at === 'string' && !Number.isNaN(Date.parse(at))) unlocked[id] = at;
  }
  return { seeded: r.seeded === true, unlocked };
}

export interface Update { store: UnlockStore; fresh: AchievementDef[] }
/**
 * Compares the current results with what was stored. The first run only records what is already earned, so an
 * existing time log does not cause a flood of messages. Later runs report only the ones that just unlocked.
 */
export function applyResults(store: UnlockStore, results: AchievementResult[], now = new Date()): Update {
  const unlocked = { ...store.unlocked };
  const fresh: AchievementDef[] = [];
  for (const result of results) {
    if (!result.unlocked || unlocked[result.def.id]) continue;
    unlocked[result.def.id] = now.toISOString();
    if (store.seeded) fresh.push(result.def);
  }
  return { store: { seeded: true, unlocked }, fresh };
}

export function readStore(): UnlockStore {
  try { return sanitizeStore(JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) ?? 'null')); } catch { return { seeded: false, unlocked: {} }; }
}
export function writeStore(store: UnlockStore) { try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(store)); } catch { /* Kept for this visit. */ } }
