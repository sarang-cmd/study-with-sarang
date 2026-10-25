import assert from 'node:assert/strict';
import { loadModule } from './_load.mjs';

const a = await loadModule('src/lib/achievements.ts');
const s = (id, iso, seconds, extra = {}) => ({ id, startedAt: iso, seconds, mode: 'pomodoro', task: '', completed: true, distractions: 0, tabAways: 0, mixName: '', ...extra });
const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).toISOString();
const input = (sessions, extra = {}) => ({ sessions, listening: {}, savedMixes: 0, goalMinutes: 60, ...extra });
const byId = (results, id) => results.find((r) => r.def.id === id);

// Definitions are unique and well formed
const ids = new Set(a.ACHIEVEMENTS.map((x) => x.id));
assert.equal(ids.size, a.ACHIEVEMENTS.length); assert.ok(a.ACHIEVEMENTS.length >= 30);
for (const d of a.ACHIEVEMENTS) { assert.ok(d.title && d.text && d.target > 0 && d.tier >= 1 && d.tier <= 4, d.id); assert.ok(a.CATEGORY_LABELS[d.category]); }

// Empty input unlocks nothing and does not crash
const empty = a.evaluateAchievements(input([]));
assert.equal(empty.filter((r) => r.unlocked).length, 0); assert.ok(empty.every((r) => r.progress === 0));

// Totals, streaks, depth
const list = [
  s('1', at(2026, 9, 28, 6), 3600, { task: 'Maths', mixName: 'Flow' }),       // Monday, early bird
  s('2', at(2026, 9, 29, 23), 1800, { task: 'maths ', mixName: 'Rain' }),     // night owl
  s('3', at(2026, 9, 30, 10), 5400, { task: 'Physics', mixName: 'flow' }),    // 90 min
  s('4', at(2026, 10, 3, 9), 1500, { task: 'Latin' }),                         // Saturday
  s('5', at(2026, 10, 4, 9), 1500, { distractions: 2 }),                       // Sunday, with distractions
];
const m = a.computeMetrics(input(list));
assert.equal(m.sessionsLogged, 5);
assert.ok(Math.abs(m.focusHours - 13800 / 3600) < 1e-9);
assert.equal(m.longestStreak, 3);            // 28, 29, 30 then a gap, then 3 and 4 (2)
assert.equal(m.longestSessionMin, 90);
assert.equal(m.earlyBird, 1); assert.equal(m.nightOwl, 1);
assert.equal(m.weekends, 1);                  // Sat 3 + Sun 4 of the same weekend
assert.equal(m.mixesUsed, 2);                 // flow and Flow are the same
assert.equal(m.labels, 3);                    // maths and "maths " are the same
assert.equal(m.cleanBlocks, 4);               // completed, >= 25 min, no distractions
assert.equal(m.completedBlocks, 5);

// Sunday alone is not a weekend; Saturday of one week and Sunday of the next do not pair
const lone = a.computeMetrics(input([s('a', at(2026, 10, 3), 900), s('b', at(2026, 10, 11), 900)]));
assert.equal(lone.weekends, 0);

// A short night session does not count as a habit
assert.equal(a.computeMetrics(input([s('a', at(2026, 10, 1, 5), 120)])).earlyBird, 0);

// Goal days use the daily goal
assert.equal(a.computeMetrics(input(list, { goalMinutes: 60 })).goalDays, 2);   // 28 (60 min) and 30 (90 min)
assert.equal(a.computeMetrics(input(list, { goalMinutes: 5 })).goalDays, 5);

// Unlock thresholds
const r = a.evaluateAchievements(input(list, { listening: { '2026-10-01': 40000, '2026-10-02': 40000 }, savedMixes: 1 }));
assert.ok(byId(r, 'first-light').unlocked); assert.ok(byId(r, 'warm-up').unlocked); assert.ok(!byId(r, 'in-the-zone').unlocked);
assert.ok(byId(r, 'spark').unlocked); assert.ok(!byId(r, 'week-warrior').unlocked);
assert.ok(byId(r, 'marathon').unlocked); assert.ok(!byId(r, 'orbit').unlocked);
assert.ok(byId(r, 'good-listener').unlocked); assert.ok(byId(r, 'mixologist').unlocked); assert.ok(!byId(r, 'sound-designer').unlocked);
assert.ok(byId(r, 'many-hats').progress === 0.6);
assert.ok(byId(r, 'early-bird').unlocked && byId(r, 'night-owl').unlocked && byId(r, 'weekend-warrior').unlocked);

// Corrupt data: NaN, negatives, bad dates
const bad = a.evaluateAchievements(input([s('x', 'not a date', 600), s('y', at(2026, 1, 1), 600)], { listening: { d: NaN }, savedMixes: -3 }));
assert.ok(bad.every((x) => Number.isFinite(x.value) && x.progress >= 0 && x.progress <= 1));

// First run seeds silently, later runs report only new unlocks, nothing repeats
const first = a.applyResults({ seeded: false, unlocked: {} }, r, new Date('2026-10-04T10:00:00Z'));
assert.equal(first.fresh.length, 0); assert.equal(first.store.seeded, true);
assert.equal(Object.keys(first.store.unlocked).length, r.filter((x) => x.unlocked).length);
const again = a.applyResults(first.store, r); assert.equal(again.fresh.length, 0);
const more = a.evaluateAchievements(input([...list, s('6', at(2026, 10, 5, 10), 4000)], { listening: { '2026-10-01': 80000 }, savedMixes: 1 }));
const later = a.applyResults(first.store, more, new Date('2026-10-05T10:00:00Z'));
assert.ok(later.fresh.some((d) => d.id === 'in-the-zone') === false);
assert.ok(later.fresh.length >= 0);
const big = a.evaluateAchievements(input(Array.from({ length: 12 }, (_, i) => s('b' + i, at(2026, 9, 1 + i, 10), 3600))));
const jump = a.applyResults({ seeded: true, unlocked: {} }, big);
assert.ok(jump.fresh.some((d) => d.id === 'in-the-zone')); assert.ok(jump.fresh.some((d) => d.id === 'spark'));
assert.equal(a.applyResults(jump.store, big).fresh.length, 0);

// The stored record is validated
const clean = a.sanitizeStore({ seeded: true, unlocked: { spark: '2026-10-04T10:00:00Z', nope: '2026-10-04T10:00:00Z', warmUp: 5, 'warm-up': 'garbage' } });
assert.deepEqual(Object.keys(clean.unlocked), ['spark']);
assert.deepEqual(a.sanitizeStore(null), { seeded: false, unlocked: {} }); assert.deepEqual(a.sanitizeStore([1, 2]), { seeded: false, unlocked: {} });
console.log('achievements: ok');
