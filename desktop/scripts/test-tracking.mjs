import assert from 'node:assert/strict';
import { loadModule } from './_load.mjs';

const t = await loadModule('src/lib/tracking.ts');
const entry = (id, iso, seconds, extra = {}) => ({ id, startedAt: iso, seconds, mode: 'pomodoro', task: '', completed: true, distractions: 0, tabAways: 0, mixName: 'Flow', ...extra });
const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).toISOString();
const now = new Date(2026, 9, 1, 15);

// Settings sanitizing
const s = t.sanitizeTimerSettings({ focusMin: 9999, shortMin: -4, cycles: 1, breakSound: 'weird', chime: 'yes', countdownMin: 12.4 });
assert.equal(s.focusMin, 180); assert.equal(s.shortMin, 1); assert.equal(s.cycles, 2); assert.equal(s.breakSound, 'duck'); assert.equal(s.chime, true); assert.equal(s.countdownMin, 12);
assert.deepEqual(t.sanitizeTimerSettings(null), t.defaultTimerSettings);

// Session sanitizing
const clean = t.sanitizeSessions([entry('a', at(2026, 9, 30), 1500), entry('a', at(2026, 9, 30), 99), { id: 'b', startedAt: 'nope', seconds: 5 }, entry('c', at(2026, 10, 1), 0), 'x', entry('d', at(2026, 10, 1), 600, { mode: 'bogus', distractions: 5000 })]);
assert.deepEqual(clean.map((x) => x.id), ['d', 'a']); assert.equal(clean[0].mode, 'pomodoro'); assert.equal(clean[0].distractions, 999);

// Day stats and streaks
const sessions = [entry('1', at(2026, 10, 1, 9), 1500, { task: 'Calculus' }), entry('2', at(2026, 10, 1, 11), 900, { distractions: 2 }), entry('3', at(2026, 9, 30), 3000, { task: 'Calculus' }), entry('4', at(2026, 9, 28), 600)];
const stats = t.dayStats(sessions, { '2026-10-01': 1234 }, 7, now);
assert.equal(stats.length, 7); assert.equal(stats.at(-1).day, '2026-10-01');
assert.equal(stats.at(-1).focusSeconds, 2400); assert.equal(stats.at(-1).sessions, 2); assert.equal(stats.at(-1).distractions, 2); assert.equal(stats.at(-1).listenSeconds, 1234);
assert.equal(stats.at(-2).focusSeconds, 3000); assert.equal(stats.at(-3).focusSeconds, 0);
assert.equal(t.focusStreak(sessions, now), 2, 'today and yesterday count, the gap on the 29th breaks it');
assert.equal(t.focusStreak(sessions, new Date(2026, 9, 2, 8)), 2, 'an unfinished day does not erase yesterday');
assert.equal(t.focusStreak([], now), 0);
const totals = t.taskTotals(sessions);
assert.deepEqual(totals[0], { task: 'Calculus', seconds: 4500, sessions: 2 }); assert(totals.some((x) => x.task === 'No label'));

// Formatting
assert.equal(t.clock(65), '01:05'); assert.equal(t.clock(3725), '1:02:05'); assert.equal(t.clock(-4), '00:00');
assert.equal(t.formatDuration(3725, true), '1h 2m'); assert.equal(t.formatDuration(90, true), '1m'); assert.equal(t.formatDuration(20, true), '20s');

// CSV is safe against spreadsheet formula injection and quoting
const csv = t.sessionsToCsv([entry('x', at(2026, 10, 1), 600, { task: '=HYPERLINK("http://evil")', mixName: 'a, "b"' })]);
const lines = csv.trim().split('\n');
assert.equal(lines[0], 'started_at,minutes,mode,label,completed,distractions,tab_aways,mix');
assert(lines[1].includes("\"'=HYPERLINK(\"\"http://evil\"\")\""), 'formula prefix is neutralized: ' + lines[1]);
assert(lines[1].includes('"a, ""b"""'));
assert.deepEqual(t.sanitizeListening({ '2026-10-01': 90, bad: 5, '2026-10-02': -3 }), { '2026-10-01': 90 });

console.log('Verified timer settings, session sanitizing, day stats, streaks, label totals, formatting and CSV safety.');
