import assert from 'node:assert/strict';
import { loadModule } from './_load.mjs';

const i = await loadModule('src/lib/insights.ts');
const s = (id, iso, seconds, extra = {}) => ({ id, startedAt: iso, seconds, mode: 'pomodoro', task: '', completed: true, distractions: 0, tabAways: 0, mixName: 'Flow', ...extra });
const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).toISOString();
const now = new Date(2026, 9, 4, 15); // Sunday 4 Oct 2026

// Weekday totals (Monday first): 28 Sep is a Monday, 4 Oct is a Sunday
const list = [s('a', at(2026, 9, 28, 9), 1500), s('b', at(2026, 9, 28, 20), 600), s('c', at(2026, 10, 4, 8), 3000), s('d', at(2026, 1, 1), 999)];
const wd = i.weekdayTotals(list, 84, now);
assert.equal(wd.length, 7); assert.equal(wd[0].seconds, 2100); assert.equal(wd[0].sessions, 2); assert.equal(wd[6].seconds, 3000);
assert.equal(wd.reduce((a, b) => a + b.days, 0), 84); assert.equal(wd[0].days, 12);

// Hour buckets and peak window
const hb = i.hourBuckets(list, 84, now);
assert.equal(hb.length, 24); assert.equal(hb[9], 1500); assert.equal(hb[20], 600); assert.equal(hb[8], 3000);
assert.deepEqual(i.peakWindow(hb), [7, 10]); assert.equal(i.peakWindow(new Array(24).fill(0)), null);

// Top mixes
const mixes = i.topMixes([s('1', at(2026, 10, 1), 100, { mixName: 'Rain' }), s('2', at(2026, 10, 2), 400, { mixName: 'Flow' }), s('3', at(2026, 10, 3), 50, { mixName: '' }), s('4', at(2026, 10, 3), 70, { mixName: 'Rain' })], 2);
assert.deepEqual(mixes.map((m) => [m.name, m.seconds, m.sessions]), [['Flow', 400, 1], ['Rain', 170, 2]]);

// Averages
assert.deepEqual(i.sessionAverages([]), { count: 0, avgSeconds: 0, medianSeconds: 0, longestSeconds: 0 });
const av = i.sessionAverages([s('a', at(2026, 10, 1), 600), s('b', at(2026, 10, 1), 1200), s('c', at(2026, 10, 1), 3600)]);
assert.equal(av.avgSeconds, 1800); assert.equal(av.medianSeconds, 1200); assert.equal(av.longestSeconds, 3600);
assert.equal(i.sessionAverages([s('a', at(2026, 10, 1), 10), s('b', at(2026, 10, 1), 20)]).medianSeconds, 15);

// Completion rate and distractions per hour
assert.equal(i.completionRate([]), null);
assert.equal(i.completionRate([s('a', at(2026, 10, 1), 60), s('b', at(2026, 10, 1), 60, { completed: false }), s('c', at(2026, 10, 1), 60), s('d', at(2026, 10, 1), 60)]), 0.75);
assert.equal(i.distractionsPerHour([s('a', at(2026, 10, 1), 300, { distractions: 5 })]), null);
assert.equal(i.distractionsPerHour([s('a', at(2026, 10, 1), 3600, { distractions: 3 }), s('b', at(2026, 10, 1), 3600, { distractions: 0 })]), 1.5);

// Week over week
const w = i.weekOverWeek([s('a', at(2026, 10, 4, 8), 3600), s('b', at(2026, 9, 28), 3600), s('c', at(2026, 9, 27), 3600), s('d', at(2026, 9, 21), 1800), s('e', at(2026, 8, 1), 9999)], now);
assert.equal(w.thisWeek, 7200); assert.equal(w.lastWeek, 5400); assert.equal(w.changePct, 33);
assert.equal(i.weekOverWeek([s('a', at(2026, 10, 4), 600)], now).changePct, null);

// Goal days: goal 60 min
const g = i.goalDays([s('a', at(2026, 10, 4), 3600), s('b', at(2026, 10, 3), 1800), s('c', at(2026, 10, 3), 1800), s('d', at(2026, 10, 2), 1200), s('e', at(2026, 10, 1), 4000)], 60, 30, now);
assert.equal(g.hit, 3); assert.equal(g.of, 30); assert.equal(g.streak, 2);
assert.equal(i.goalDays([s('a', at(2026, 10, 3), 3600)], 60, 30, now).streak, 1); // today still open
assert.equal(i.goalDays([s('a', at(2026, 10, 3), 3600)], 0, 30, now).hit, 0);

// Month total
const m = i.monthTotal([s('a', at(2026, 10, 1), 600), s('b', at(2026, 10, 1, 18), 600), s('c', at(2026, 10, 4), 600), s('d', at(2026, 9, 30), 600)], now);
assert.deepEqual(m, { seconds: 1800, activeDays: 2, sessions: 3, daysSoFar: 4 });

// Heatmap width and grid
assert.equal(i.heatWeeksFor(100), 12); assert.equal(i.heatWeeksFor(10000), 53); assert.equal(i.heatWeeksFor(14 * 30 - 3 + 0), 30);
const grid = i.heatGrid(new Map([['2026-10-04', 5000]]), 16, now);
assert.equal(grid.length, 16); assert.ok(grid.every((c) => c.length === 7));
assert.equal(grid[15][6].day, '2026-10-04'); assert.equal(grid[15][6].seconds, 5000); assert.equal(grid[15][6].future, false);
assert.equal(grid[0][0].day, '2026-06-15');
assert.equal(i.heatGrid(new Map(), 4, new Date(2026, 9, 1, 15))[3][3].future, false); assert.equal(i.heatGrid(new Map(), 4, new Date(2026, 9, 1, 15))[3][4].future, true);
assert.deepEqual([0, 1, 1499, 1500, 3600, 7200].map(i.heatLevel), [0, 1, 1, 2, 3, 4]);
console.log('PASS insights');
