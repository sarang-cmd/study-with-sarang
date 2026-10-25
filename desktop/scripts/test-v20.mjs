import net from 'node:net';
// 2.0 tests, grouped by feature. Each group is added in the same step as the feature.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadModule } from './_load.mjs';

const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;
const src = (name) => `${root}src/lib/${name}.ts`;
let n = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n += 1; }, (error) => { console.error(`FAIL ${name}`); throw error; });

// ------------------------------------------------------------------ app icons
const iconSet = await loadModule(src('iconSet'));
const ids = require('../electron/icon-ids.cjs');
await ok('icons: same ids in page and shell', () => {
  assert.deepEqual([...iconSet.ICON_IDS], ids.IDS);
  assert.equal(iconSet.ICONS.length, 8);
  assert.equal(ids.pick('neon'), 'default'); assert.equal(ids.pick('moon'), 'moon');
  assert.equal(iconSet.isIconId('ring'), true); assert.equal(iconSet.isIconId('x'), false);
});
await ok('icons: every icon has every file the shell and page use', () => {
  for (const id of ids.IDS) {
    for (const f of ['icon.ico', 'icon.png', 'icon.svg', 'tray.png', 'trayTemplate.png', 'trayTemplate@2x.png']) assert.ok(fs.existsSync(`${root}assets/icons/${id}/${f}`), `${id}/${f}`);
    for (const s of [96, 128, 256, 512]) assert.ok(fs.existsSync(`${root}public/icons/${id}/art-${s}.png`), `art ${id} ${s}`);
    const ico = fs.readFileSync(`${root}assets/icons/${id}/icon.ico`);
    assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.readUInt16LE(4), 7, 'seven sizes in the .ico');
  }
});
await ok('icons: the packaged files list includes the icons (the old bug: default icon.ico was left out)', () => {
  const files = JSON.parse(fs.readFileSync(`${root}package.json`, 'utf8')).build.files;
  assert.ok(files.includes('assets/icon.ico')); assert.ok(files.includes('assets/icons/**/*'));
});
await ok('icons: svg builder', () => {
  const svg = iconSet.iconSvg('moon', { size: 40 });
  assert.match(svg, /width="40"/); assert.match(svg, /<rect/);
  assert.doesNotMatch(iconSet.iconSvg('moon', { template: true }), /<rect/);
  assert.match(iconSet.iconSvg('paper'), /#f3f3f1/);
  assert.equal(iconSet.iconDef('nope').id, 'default');
  assert.match(iconSet.iconDataUri('ring'), /^data:image\/svg\+xml,/);
});

// ------------------------------------------------------------------ notification centre
const nt = await loadModule(src('notifications'));
await ok('notifications: settings are sanitized', () => {
  const d = nt.sanitizeNotify(null);
  assert.equal(d.celebrate, 'full'); assert.equal(d.history, 100); assert.equal(d.kinds.info, false); assert.equal(d.kinds.achievement, true);
  const s = nt.sanitizeNotify({ celebrate: 'weird', history: 99999, celebrateSeconds: 1, kinds: { drift: false, nope: true }, quiet: { on: true, from: 5000, to: 30 } });
  assert.equal(s.celebrate, 'full'); assert.equal(s.history, 500); assert.equal(s.celebrateSeconds, 3); assert.equal(s.kinds.drift, false); assert.equal('nope' in s.kinds, false); assert.equal(s.quiet.from, 1439);
  assert.equal(nt.sanitizeNotify({ celebrate: 'off' }).celebrate, 'off');
});
await ok('notifications: quiet hours wrap past midnight', () => {
  const q = { on: true, from: 22 * 60, to: 7 * 60 };
  assert.equal(nt.isQuiet(q, new Date(2026, 9, 6, 23, 0)), true); assert.equal(nt.isQuiet(q, new Date(2026, 9, 6, 3, 0)), true); assert.equal(nt.isQuiet(q, new Date(2026, 9, 6, 12, 0)), false);
  assert.equal(nt.isQuiet({ ...q, on: false }, new Date(2026, 9, 6, 23, 0)), false);
  assert.equal(nt.isQuiet({ on: true, from: 9 * 60, to: 17 * 60 }, new Date(2026, 9, 6, 12, 0)), true);
  assert.equal(nt.parseMinutes('07:30', 0), 450); assert.equal(nt.parseMinutes('25:00', 9), 9); assert.equal(nt.minutesLabel(450), '07:30');
});
await ok('notifications: add, read, filter, group, clear', () => {
  nt.resetNotesForTest();
  const a = nt.addNote({ kind: 'achievement', title: 'Unlocked: Warm-up', message: 'Focus for 1 hour in total.', key: 'ach-warm-up' }, new Date(2026, 9, 6, 10, 0).getTime());
  assert.ok(a);
  assert.equal(nt.addNote({ kind: 'achievement', title: 'Unlocked: Warm-up', message: 'Focus for 1 hour in total.', key: 'ach-warm-up' }, new Date(2026, 9, 6, 10, 0, 30).getTime()), null, 'a repeat within a minute is ignored');
  assert.equal(nt.addNote({ kind: 'info', title: '', message: 'quiet kinds are not listed' }), null, 'info is off by default');
  nt.addNote({ kind: 'goal', title: 'Goal reached', message: 'Past paper done.' }, new Date(2026, 9, 5, 18, 0).getTime());
  assert.equal(nt.getNotes().length, 2); assert.equal(nt.unreadCount(), 2);
  nt.markRead(a.id); assert.equal(nt.unreadCount(), 1);
  assert.equal(nt.filterNotes(nt.getNotes(), 'unread').length, 1); assert.equal(nt.filterNotes(nt.getNotes(), 'goal').length, 1);
  const groups = nt.groupByDay(nt.getNotes(), new Date(2026, 9, 6, 12, 0));
  assert.deepEqual(groups.map((g) => g.label), ['Today', 'Yesterday']);
  nt.markAllRead(); assert.equal(nt.unreadCount(), 0);
  nt.clearNotes('goal'); assert.equal(nt.getNotes().length, 1); nt.clearNotes(); assert.equal(nt.getNotes().length, 0);
});
await ok('notifications: history limit and bad data', () => {
  nt.resetNotesForTest(); nt.setNotifySettings({ history: 20 });
  for (let i = 0; i < 30; i++) nt.addNote({ kind: 'system', title: `n${i}`, message: `m${i}` }, 1_000_000 + i);
  assert.equal(nt.getNotes().length, 20); assert.equal(nt.getNotes()[0].title, 'n29');
  assert.deepEqual(nt.sanitizeNotes('x'), []); assert.equal(nt.sanitizeNotes([{ id: 1 }, { id: 'a', at: 5, kind: 'weird', title: 7 }]).length, 1);
  assert.equal(nt.ago(1000, 1000 + 120_000), '2 min ago'); assert.equal(nt.ago(1000, 1500), 'just now');
});

// ------------------------------------------------------------------ subjects and curricula
const sj = await loadModule(src('subjects'));
await ok('subjects: curricula are complete and unique', () => {
  assert.deepEqual(sj.CURRICULA.map((c) => c.id), ['ib', 'gcse', 'igcse', 'cbse', 'alevel', 'ap', 'custom']);
  for (const c of sj.CURRICULA) {
    const names = c.subjects.map((x) => x.name); assert.equal(new Set(names).size, names.length, `${c.id} has duplicate names`);
    for (const d of c.subjects) { assert.ok(c.groups.includes(d.group), `${c.id}: ${d.name} group`); assert.ok(d.short.length >= 1 && d.short.length <= 5, `${c.id}: ${d.name} short`); }
  }
  const ib = sj.curriculum('ib'); assert.deepEqual(ib.stages, ['DP1', 'DP2']); assert.ok(ib.subjects.find((x) => x.name === 'Theory of Knowledge')?.core);
  assert.ok(ib.subjects.some((x) => x.name === 'Mathematics: Analysis and Approaches')); assert.equal(ib.levels, true);
  assert.equal(sj.curriculum('nope').id, 'custom');
});
await ok('subjects: choosing, levels, custom, archive, remove', () => {
  sj.resetSubjectsForTest();
  const ib = sj.curriculum('ib');
  const phys = ib.subjects.find((x) => x.name === 'Physics'); sj.toggleSubject(phys, 'ib', true); sj.toggleSubject(phys, 'ib', true);
  assert.equal(sj.getProfile().subjects.length, 1); assert.equal(sj.getProfile().subjects[0].level, 'HL');
  sj.updateSubject('ib:physics', { level: 'SL', weeklyMin: 90 }); assert.equal(sj.subjectLabel('ib:physics'), 'Physics SL'); assert.equal(sj.subjectShort('ib:physics'), 'PHY SL');
  assert.equal(sj.addCustomSubject('  Chess   club '), true); assert.equal(sj.addCustomSubject('chess club'), false, 'same slug is a duplicate');
  assert.equal(sj.addCustomSubject('   '), false);
  const mine = sj.getProfile().subjects.find((x) => x.custom); assert.equal(mine.name, 'Chess club'); assert.equal(mine.short, 'CC');
  sj.updateSubject(mine.id, { archived: true }); assert.equal(sj.activeSubjects().length, 1);
  sj.removeSubject(mine.id); assert.equal(sj.getProfile().subjects.length, 1);
  assert.equal(sj.subjectLabel('custom:gone-club'), 'gone club'); assert.equal(sj.subjectLabel(''), 'No subject');
});
await ok('subjects: IB notes are friendly and never block', () => {
  const mk = (n, hl) => Array.from({ length: n }, (_, i) => ({ curriculum: 'ib', core: false, archived: false, level: i < hl ? 'HL' : 'SL' }));
  assert.deepEqual(sj.ibNotes(mk(6, 3)), []); assert.equal(sj.ibNotes(mk(5, 3)).length, 1); assert.equal(sj.ibNotes(mk(6, 1)).length, 1); assert.equal(sj.ibNotes(mk(7, 5)).length, 2); assert.deepEqual(sj.ibNotes([]), []);
});
await ok('subjects: exam sessions and countdown', () => {
  const now = new Date(2026, 9, 6);
  const up = sj.upcomingSessions('ib', now, 4); assert.deepEqual(up.map((x) => x.label), ['November 2026', 'May 2027', 'November 2027', 'May 2028']);
  const p = sj.sanitizeProfile({ curriculum: 'ib', exam: { season: 'may', year: 2028, date: '' } });
  const d = sj.examDate(p); assert.equal(d.getFullYear(), 2028); assert.equal(d.getMonth(), 4);
  assert.equal(sj.daysUntil(new Date(2026, 9, 16), now), 10); assert.equal(sj.daysUntil(null, now), null);
  assert.equal(sj.examDate(sj.sanitizeProfile({ curriculum: 'ib', exam: { season: 'may', year: 2028, date: '2028-05-09' } })).getDate(), 9);
  assert.equal(sj.countdownLabel(10), '10 days to go'); assert.match(sj.countdownLabel(60), /60 days to go \(8 weeks\)/); assert.equal(sj.countdownLabel(0), 'Exams start today'); assert.equal(sj.countdownLabel(null), '');
  assert.equal(sj.examDate(sj.sanitizeProfile({ curriculum: 'custom' })), null);
});
await ok('subjects: bad stored data is cleaned', () => {
  const p = sj.sanitizeProfile({ curriculum: 'zzz', subjects: [{ id: 'a', name: 'X', level: 'QQ', weeklyMin: -5 }, { id: 'a', name: 'dupe' }, { id: 5 }, null], exam: { year: 99999, date: 'tomorrow' } });
  assert.equal(p.curriculum, 'ib'); assert.equal(p.subjects.length, 1); assert.equal(p.subjects[0].level, ''); assert.equal(p.subjects[0].weeklyMin, 0); assert.equal(p.exam.year, 0); assert.equal(p.exam.date, '');
});

// ------------------------------------------------------------------ session plan and to-dos
const pl = await loadModule(src('plan'));
await ok('plan: to-dos add, tick, edit, move, count', () => {
  pl.resetPlanForTest();
  const a = pl.addTodo('Past paper Q1 to Q5', 'ib:physics', new Date(2026, 9, 6, 10, 0)); const b = pl.addTodo('Flashcards', '', new Date(2026, 9, 6, 10, 1));
  assert.ok(a && b); assert.equal(pl.addTodo('   '), null);
  assert.deepEqual(pl.todoCounts(), { total: 2, done: 0, open: 2 }); assert.deepEqual(pl.todoCounts('ib:physics'), { total: 1, done: 0, open: 1 });
  const t = pl.toggleTodo(a.id, new Date(2026, 9, 6, 10, 30)); assert.equal(t.done, true);
  assert.equal(pl.todosDoneSince(new Date(2026, 9, 6, 10, 15).toISOString()), 1); assert.equal(pl.todosDoneSince(new Date(2026, 9, 6, 11, 0).toISOString()), 0);
  pl.toggleTodo(a.id); assert.equal(pl.getTodos()[0].doneAt, undefined);
  pl.editTodo(b.id, { text: 'Flashcards: topic 3' }); assert.equal(pl.getTodos()[1].text, 'Flashcards: topic 3');
  pl.moveTodo(b.id, -1); assert.equal(pl.getTodos()[0].id, b.id); pl.moveTodo(b.id, -1); assert.equal(pl.getTodos()[0].id, b.id);
  pl.toggleTodo(a.id); pl.clearDoneTodos(); assert.equal(pl.getTodos().length, 1); pl.removeTodo(b.id); assert.equal(pl.getTodos().length, 0);
});
await ok('plan: goal, pending prompt and sanitizing', () => {
  pl.resetPlanForTest();
  pl.setPlan({ subject: 'ib:physics', goal: 'x'.repeat(300) }); assert.equal(pl.getPlan().goal.length, 160); pl.setPlan({ goal: '' }); assert.equal(pl.getPlan().subject, 'ib:physics');
  pl.setPending({ sessionId: 's1', goal: 'g', subject: '', minutes: 25 }); assert.equal(pl.getPending().sessionId, 's1'); pl.setPending(null); assert.equal(pl.getPending(), null);
  assert.equal(pl.sanitizeTodos([{ id: 'a', text: ' hi ', done: true, doneAt: 'bad' }, { id: 'a', text: 'dupe' }, { id: 'b', text: '' }]).length, 1);
  assert.equal(pl.sanitizeTodos([{ id: 'a', text: 'hi', done: true, doneAt: '2026-10-06T10:00:00.000Z' }])[0].doneAt, '2026-10-06T10:00:00.000Z');
  assert.deepEqual(pl.sanitizePlan(5), { subject: '', goal: '' });
});
await ok('sessions keep subject, goal, outcome and to-dos done', async () => {
  const tr = await loadModule(src('tracking'));
  const [e] = tr.sanitizeSessions([{ id: 'a', startedAt: '2026-10-06T10:00:00.000Z', seconds: 1500, subject: 'ib:physics', goal: 'Q1 to Q5', goalMet: 'partly', todosDone: 3 }]);
  assert.equal(e.subject, 'ib:physics'); assert.equal(e.goal, 'Q1 to Q5'); assert.equal(e.goalMet, 'partly'); assert.equal(e.todosDone, 3);
  const [old] = tr.sanitizeSessions([{ id: 'b', startedAt: '2026-10-06T10:00:00.000Z', seconds: 60, goalMet: 'wow' }]);
  assert.equal(old.subject, ''); assert.equal(old.goalMet, ''); assert.equal(old.todosDone, 0);
});
await ok('sync merges subjects and to-dos', async () => {
  const sm = await loadModule(src('syncMerge'));
  assert.equal(sm.SYNC_KEYS['study-with-sarang:subjects'].kind, 'value'); assert.equal(sm.SYNC_KEYS['study-with-sarang:todos'].kind, 'items');
});

// ------------------------------------------------------------------ achievements 2.0
const ach = await loadModule(src('achievements'));
const ses = (id, y, m, d, h, min, seconds, extra = {}) => ({ id, startedAt: new Date(y, m - 1, d, h, min).toISOString(), seconds, mode: 'pomodoro', task: '', completed: true, distractions: 0, tabAways: 0, mixName: '', subject: '', goal: '', goalMet: '', todosDone: 0, ...extra });
const inp = (sessions, extra = {}) => ({ sessions, listening: {}, savedMixes: 0, goalMinutes: 60, ...extra });
await ok('achievements: many more, well formed, harder', () => {
  assert.ok(ach.ACHIEVEMENTS.length >= 90, `has ${ach.ACHIEVEMENTS.length}`);
  const ids = new Set(ach.ACHIEVEMENTS.map((x) => x.id)); assert.equal(ids.size, ach.ACHIEVEMENTS.length);
  const metrics = ach.computeMetrics(inp([]));
  for (const d of ach.ACHIEVEMENTS) { assert.ok(d.metric in metrics, `${d.id} metric ${d.metric}`); assert.ok(ach.CATEGORY_LABELS[d.category], d.id); assert.ok(d.title && d.text); }
  assert.ok(ach.ACHIEVEMENTS.filter((x) => x.tier === 4).length >= 25, 'plenty of top-tier ones');
  assert.ok(ach.ACHIEVEMENTS.filter((x) => x.secret).length >= 5);
  assert.equal(ach.evaluateAchievements(inp([])).filter((r) => r.unlocked).length, 0);
  for (const old of ['first-light', 'warm-up', 'in-the-zone', 'spark', 'many-hats', 'weekend-warrior', 'goal-machine']) assert.ok(ids.has(old), `${old} stays so earlier unlocks remain valid`);
});
await ok('achievements: days, week, streaks, comebacks', () => {
  const list = [];
  for (let d = 1; d <= 3; d++) list.push(ses(`a${d}`, 2026, 8, d, 9, 0, 1800));              // 3-day run
  for (let d = 20; d <= 23; d++) list.push(ses(`b${d}`, 2026, 8, d, 9, 0, 1800));             // after a gap of 16 days, 4-day run
  const m = ach.computeMetrics(inp(list));
  assert.equal(m.daysStudied, 7); assert.equal(m.longestStreak, 4); assert.equal(m.comebacks, 1);
  const short = ach.computeMetrics(inp([ses('x', 2026, 8, 1, 9, 0, 600), ses('y', 2026, 8, 20, 9, 0, 600), ses('z', 2026, 8, 21, 9, 0, 600)]));
  assert.equal(short.comebacks, 0, 'a two-day return is not a comeback');
  const week = ach.computeMetrics(inp([ses('1', 2026, 10, 5, 9, 0, 7200), ses('2', 2026, 10, 7, 9, 0, 7200), ses('3', 2026, 10, 11, 9, 0, 3600), ses('4', 2026, 10, 12, 9, 0, 3600)]));
  assert.ok(Math.abs(week.bestWeekHours - 5) < 1e-9, 'Monday to Sunday is one week'); assert.ok(Math.abs(week.bestDayHours - 2) < 1e-9);
});
await ok('achievements: depth, clean runs, goal day streak, quiet days', () => {
  const list = [ses('1', 2026, 10, 1, 9, 0, 1800), ses('2', 2026, 10, 1, 10, 0, 1800), ses('3', 2026, 10, 1, 11, 0, 1800, { distractions: 2 }), ses('4', 2026, 10, 1, 12, 0, 4000), ses('5', 2026, 10, 1, 13, 0, 4000), ses('6', 2026, 10, 1, 14, 0, 120, { distractions: 9 })];
  const m = ach.computeMetrics(inp(list));
  assert.equal(m.cleanRun, 2, 'a run resets on a distraction, short blocks do not matter'); assert.equal(m.cleanLong, 2); assert.equal(m.blocksInDay, 6); assert.equal(m.quietDays, 0);
  const days = [1, 2, 3, 5, 6].map((d) => ses(`d${d}`, 2026, 10, d, 9, 0, 3700));
  const g = ach.computeMetrics(inp(days)); assert.equal(g.goalDayStreak, 3); assert.equal(g.quietDays, 5); assert.equal(g.goalDays, 5);
});
await ok('achievements: subjects', () => {
  const list = [ses('1', 2026, 10, 5, 9, 0, 3600, { subject: 'ib:physics' }), ses('2', 2026, 10, 5, 10, 0, 3600, { subject: 'ib:chemistry' }), ses('3', 2026, 10, 5, 11, 0, 3600, { subject: 'ib:biology' }), ses('4', 2026, 10, 6, 11, 0, 3600, { subject: 'ib:biology' }), ses('5', 2026, 10, 8, 11, 0, 240, { subject: 'ib:history' })];
  const m = ach.computeMetrics(inp(list));
  assert.equal(m.subjectsStudied, 4); assert.equal(m.subjectsInDay, 3); assert.equal(m.subjectsInWeek, 3, 'a 4 minute block does not count toward the week variety');
  assert.ok(Math.abs(m.subjectHoursMax - 2) < 1e-9); assert.equal(m.subjectsWith10h, 0);
  const big = ach.computeMetrics(inp(Array.from({ length: 6 }, (_, i) => ses(`s${i}`, 2026, 9, 1 + i, 9, 0, 90_000, { subject: `ib:s${i}` }))));
  assert.equal(big.subjectsWith25h, 6); assert.equal(big.subjectsWith10h, 6);
});
await ok('achievements: goals and to-dos', () => {
  const g = (id, h, met) => ses(id, 2026, 10, 5, h, 0, 1500, { goal: 'aim', goalMet: met, todosDone: 2 });
  const list = [g('1', 8, 'yes'), g('2', 9, 'yes'), g('3', 10, 'partly'), g('4', 11, 'yes'), g('5', 12, 'yes'), g('6', 13, 'yes'), ses('7', 2026, 10, 5, 14, 0, 1500)];
  const m = ach.computeMetrics(inp(list));
  assert.equal(m.goalsSet, 6); assert.equal(m.goalsReached, 5); assert.equal(m.goalRun, 3); assert.equal(m.todosDone, 12);
  assert.equal(ach.computeMetrics(inp(list, { todosDone: 40 })).todosDone, 40, 'the list total counts when it is larger');
  assert.equal(ach.evaluateAchievements(inp(list)).find((r) => r.def.id === 'aim-hit').unlocked, true);
});
await ok('achievements: secret ones', () => {
  const m = ach.computeMetrics(inp([ses('1', 2026, 1, 1, 0, 30, 1500), ses('2', 2026, 3, 3, 23, 11, 600), ses('3', 2026, 3, 4, 2, 0, 600)]));
  assert.equal(m.newYear, 1); assert.equal(m.midnight, 1, 'only the 25 minute one counts'); assert.equal(m.elevenEleven, 1);
  assert.ok(ach.ACHIEVEMENTS.find((x) => x.id === 'iron-will').secret);
});

// ------------------------------------------------------------------ statistics
const st = await loadModule(src('stats'));
const NOW = new Date(2026, 9, 6, 12, 0); // Tuesday 6 October 2026
await ok('stats: filters', () => {
  const list = [
    ses('1', 2026, 10, 5, 9, 0, 1800, { subject: 'ib:physics', goal: 'g', goalMet: 'yes' }), ses('2', 2026, 10, 4, 9, 0, 600, { subject: 'ib:chemistry', completed: false, mode: 'stopwatch' }),
    ses('3', 2026, 7, 1, 9, 0, 3600, { subject: 'ib:physics' }), ses('4', 2026, 10, 6, 9, 0, 1500),
  ];
  const f = st.defaultFilter();
  assert.equal(st.filterSessions(list, f, NOW).length, 3, '90 days drops July');
  assert.equal(st.filterSessions(list, { ...f, range: 'all' }, NOW).length, 4); assert.equal(st.filterSessions(list, { ...f, range: '7' }, NOW).length, 3);
  assert.equal(st.filterSessions(list, { ...f, range: 'all', subject: 'ib:physics' }, NOW).length, 2);
  assert.equal(st.filterSessions(list, { ...f, range: 'all', subject: st.NO_SUBJECT }, NOW).length, 1);
  assert.equal(st.filterSessions(list, { ...f, range: 'all', mode: 'stopwatch' }, NOW).length, 1); assert.equal(st.filterSessions(list, { ...f, range: 'all', completedOnly: true }, NOW).length, 3);
  assert.equal(st.filterSessions(list, { ...f, range: 'all', goalOnly: true }, NOW).length, 1); assert.equal(st.filterSessions(list, { ...f, range: 'all', minMin: 20 }, NOW).length, 3);
  assert.equal(st.filterActive(f), false); assert.equal(st.filterActive({ ...f, minMin: 5 }), true);
  assert.deepEqual(st.sanitizeFilter({ range: 'x', mode: 'q', minMin: 9999, subject: 5 }), { ...f, minMin: 180 });
});
await ok('stats: heatmap layout for a year and for the last 12 months', () => {
  const values = new Map([['2026-10-05', 3600], ['2026-10-04', 1800], ['2026-03-01', 7200], ['2025-12-31', 600]]);
  const year = st.yearLayout(values, 2026, NOW);
  assert.equal(year.start, '2026-01-01'); assert.equal(year.end, '2026-12-31'); assert.equal(year.days, 365);
  assert.equal(year.activeDays, 3); assert.equal(year.total, 3600 + 1800 + 7200, 'the 2025 day is not counted');
  assert.ok(year.columns.every((c) => c.length === 7)); assert.equal(year.columns[0][0].day, '2025-12-29', 'weeks start on Monday');
  assert.equal(year.columns[0].filter((c) => c.outside).length, 3, 'three days of December pad the first column');
  assert.ok(year.columns.flat().filter((c) => c.future && !c.outside).length > 0);
  assert.equal(year.months[0].index, 0);
  const rolling = st.yearLayout(values, 'rolling', NOW);
  assert.equal(rolling.end, '2026-10-06'); assert.equal(rolling.start, '2025-10-07'); assert.equal(rolling.days, 365); assert.equal(rolling.total, 3600 + 1800 + 7200 + 600);
  const levels = new Set(year.columns.flat().map((c) => c.level)); assert.ok(levels.has(4) && levels.has(0));
  const past = st.yearLayout(new Map([['2024-02-29', 100]]), 2024, NOW); assert.equal(past.days, 366); assert.equal(past.columns.flat().filter((c) => c.future).length, 0);
});
await ok('stats: heat levels and metrics', () => {
  const scale = st.levelScale([10, 20, 30, 40, 50, 60, 70, 80]);
  assert.deepEqual([0, 10, 20, 40, 60, 80].map(scale), [0, 1, 1, 2, 3, 4]); assert.equal(st.levelScale([])(5), 0); assert.equal(st.levelScale([5])(5), 4);
  const list = [ses('1', 2026, 10, 5, 9, 0, 1800, { distractions: 2, todosDone: 3, goal: 'g', goalMet: 'yes' }), ses('2', 2026, 10, 5, 10, 0, 600, { completed: false })];
  assert.equal(st.heatValues(list, {}, 'time').get('2026-10-05'), 2400); assert.equal(st.heatValues(list, {}, 'blocks').get('2026-10-05'), 1); assert.equal(st.heatValues(list, {}, 'drifts').get('2026-10-05'), 2);
  assert.equal(st.heatValues(list, {}, 'todos').get('2026-10-05'), 3); assert.equal(st.heatValues(list, {}, 'goals').get('2026-10-05'), 1); assert.equal(st.heatValues(list, { '2026-10-01': 500, '2026-10-02': 0 }, 'listen').size, 1);
});
await ok('stats: year selector and the default view', () => {
  const list = [ses('a', 2024, 5, 1, 9, 0, 600), ses('b', 2026, 10, 1, 9, 0, 600)];
  assert.deepEqual(st.heatViews(list, NOW).map((v) => v.label), ['Last 12 months', '2026', '2024']);
  assert.equal(st.defaultHeatView(list, NOW), 'rolling');
  assert.equal(st.defaultHeatView([ses('a', 2024, 5, 1, 9, 0, 600)], NOW), 2024, 'nothing for a year: show the latest year that has data');
  assert.equal(st.defaultHeatView([], NOW), 'rolling');
  assert.deepEqual(st.heatViews([], NOW).map((v) => v.label), ['Last 12 months', '2026']);
});
await ok('stats: per-subject numbers', () => {
  const profile = sj.sanitizeProfile({ curriculum: 'ib', subjects: [{ id: 'ib:physics', name: 'Physics', level: 'HL', weeklyMin: 120 }, { id: 'ib:art', name: 'Visual Arts', level: 'SL' }] });
  const list = [
    ses('1', 2026, 10, 5, 9, 0, 3600, { subject: 'ib:physics', goal: 'g', goalMet: 'yes', todosDone: 2, distractions: 2 }), ses('2', 2026, 10, 6, 9, 0, 3600, { subject: 'ib:physics', goal: 'g', goalMet: 'no' }),
    ses('3', 2026, 9, 20, 9, 0, 1800, { subject: 'ib:physics' }), ses('4', 2026, 9, 5, 9, 0, 3600, { subject: 'ib:physics' }), ses('5', 2026, 10, 1, 9, 0, 1800, { subject: 'custom:chess' }),
  ];
  const stats = st.subjectStats(list, profile, NOW); const phys = stats.find((x) => x.id === 'ib:physics');
  assert.equal(stats[0].id, 'ib:physics'); assert.equal(stats.length, 3, 'chosen subjects and ones that only appear in the log');
  assert.equal(phys.seconds, 3600 * 3 + 1800); assert.equal(phys.goalsSet, 2); assert.equal(phys.goalRate, 0.5); assert.equal(phys.todosDone, 2); assert.equal(phys.drifts, 2);
  assert.equal(phys.weekSeconds, 7200, 'this week Monday 5 October'); assert.equal(phys.weekShare, 1); assert.equal(phys.daysSince, 0);
  assert.equal(stats.find((x) => x.id === 'ib:art').seconds, 0); assert.equal(stats.find((x) => x.id === 'ib:art').daysSince, null);
  assert.equal(phys.driftPerHour, 0.6); assert.equal(typeof phys.trend, 'number');
  const weekly = st.weeklyBySubject(list, 4, NOW); assert.equal(weekly.length, 4); assert.equal(weekly[3].weekStart, '2026-10-05'); assert.equal(weekly[3].total, 7200); assert.equal(weekly[3].bySubject.get('ib:physics'), 7200);
});
await ok('stats: charts', () => {
  const list = [ses('1', 2026, 10, 5, 9, 0, 3600), ses('2', 2026, 10, 6, 9, 0, 1800), ses('3', 2026, 9, 1, 20, 0, 5400), ses('4', 2026, 9, 2, 20, 0, 600)];
  assert.equal(st.monthlyTotals(list, 2026)[9], 5400); assert.equal(st.monthlyTotals(list, 2026)[8], 6000); assert.equal(st.monthlyTotals(list, 2025).every((v) => v === 0), true);
  assert.deepEqual(st.lengthHistogram(list), [1, 0, 1, 0, 1, 1]); // 10, 30, 60 and 90 minutes
  assert.deepEqual(st.weekdayHourGrid(list)[0][9], 3600); assert.equal(st.weekdayHourGrid(list)[1][9], 1800);
  const cum = st.cumulativeHours(list, new Date(2026, 8, 30, 12), NOW); assert.equal(cum.length, 7); assert.ok(Math.abs(cum[0].hours - 6000 / 3600) < 1e-9, 'sessions from 1 and 2 September are before the window'); assert.ok(Math.abs(cum[6].hours - (6000 + 3600 + 1800) / 3600) < 1e-9);
  const longList = [ses('1', 2026, 10, 1, 9, 0, 600), ses('2', 2026, 10, 2, 9, 0, 600), ses('3', 2026, 10, 3, 9, 0, 600), ses('4', 2026, 10, 5, 9, 0, 600), ses('5', 2026, 10, 6, 9, 0, 600), ses('6', 2026, 9, 1, 9, 0, 600)];
  const runs = st.streakHistory(longList); assert.deepEqual(runs.map((r) => r.length), [3, 2, 1]); assert.equal(runs[0].from, '2026-10-01'); assert.equal(runs[0].to, '2026-10-03');
  assert.deepEqual(st.consistency(longList, new Date(2026, 9, 1, 12), NOW), { activeDays: 5, days: 6, pct: 83 });
  const rec = st.records(longList); assert.equal(rec.bestDay.seconds, 600); assert.equal(rec.longest.seconds, 600); assert.equal(rec.mostBlocks.blocks, 1); assert.equal(st.records([]).bestDay, null);
  const rate = st.goalRateByWeek([ses('1', 2026, 10, 5, 9, 0, 600, { goal: 'a', goalMet: 'yes' }), ses('2', 2026, 10, 6, 9, 0, 600, { goal: 'a', goalMet: 'no' }), ses('3', 2026, 10, 7, 9, 0, 600, { goal: 'a' })], 3, NOW);
  assert.deepEqual(rate, [null, null, 0.5]);
});

// ------------------------------------------------------------------ study room
const room = await loadModule(src('studyRoom'));
await ok('study room: settings and scenes are sanitized', () => {
  const d = room.sanitizeRoom(undefined); assert.deepEqual(d, room.defaultRoom); assert.equal(d.on, false, 'off until someone turns it on');
  const r = room.sanitizeRoom({ on: true, volume: 500, dim: -4, blur: 99, fit: 'zoom', clock: 'tiny', follow: 'focus', next: 'shuffle', sound: 'mix', sceneId: 7 });
  assert.deepEqual([r.on, r.volume, r.dim, r.blur, r.fit, r.clock, r.follow, r.next, r.sound, r.sceneId], [true, 100, 0, 24, 'cover', 'big', 'focus', 'shuffle', 'mix', '']);
  const scenes = room.sanitizeScenes([
    { id: 'a', title: ' Rainy desk ', kind: 'youtube', url: 'https://www.youtube.com/watch?v=74cOUSKXMz0' }, { id: 'b', title: 'Clip', kind: 'url', url: 'https://example.com/a.mp4' },
    { id: 'c', title: 'File', kind: 'file', size: 1234 }, { id: 'a', title: 'duplicate', kind: 'file' }, { id: 'd', title: 'bad', kind: 'url', url: 'http://example.com/a.mp4' }, { id: 'e', title: 'bad', kind: 'url', url: 'javascript:alert(1)' }, null, 5,
  ]);
  assert.deepEqual(scenes.map((x) => [x.id, x.kind]), [['a', 'youtube'], ['b', 'url'], ['c', 'file']]); assert.equal(scenes[0].title, 'Rainy desk'); assert.equal(scenes[0].videoId, '74cOUSKXMz0'); assert.equal(scenes[2].url, '');
  assert.deepEqual(room.sanitizeScenes('x'), []);
});
await ok('study room: next scene, timer following, links and sizes', () => {
  const list = ['a', 'b', 'c'].map((id) => ({ id, title: id, kind: 'file', url: '', addedAt: 0 }));
  assert.equal(room.pickNext(list, 'a', 'loop-one').id, 'a'); assert.equal(room.pickNext(list, 'a', 'loop-all').id, 'b'); assert.equal(room.pickNext(list, 'c', 'loop-all').id, 'a');
  assert.equal(room.pickNext(list, 'c', 'stop'), null); assert.equal(room.pickNext(list, 'b', 'stop').id, 'c'); assert.equal(room.pickNext([], 'a', 'loop-all'), null);
  for (const r of [0, 0.3, 0.6, 0.99]) assert.notEqual(room.pickNext(list, 'b', 'shuffle', () => r).id, 'b', 'shuffle never repeats the scene that just ended');
  assert.equal(room.pickNext(list.slice(0, 1), 'a', 'shuffle').id, 'a'); assert.equal(room.pickNext(list, 'gone', 'loop-all').id, 'a');
  const t = (running, phase) => ({ running, phase });
  assert.equal(room.desiredPlayback('free', t(true, 'focus')), null); assert.equal(room.desiredPlayback('timer', t(true, 'short')), true); assert.equal(room.desiredPlayback('timer', t(false, 'focus')), false);
  assert.equal(room.desiredPlayback('focus', t(true, 'short')), false); assert.equal(room.desiredPlayback('focus', t(true, 'focus')), true);
  assert.equal(room.sceneFromLink('https://youtu.be/74cOUSKXMz0', '').title, 'YouTube 74cOUSKXMz0'); assert.equal(room.sceneFromLink('https://x.org/a.webm', 'Mine').kind, 'url'); assert.equal(room.sceneFromLink('ftp://x', ''), null);
  assert.deepEqual([room.sizeLabel(900), room.sizeLabel(5_400_000), room.sizeLabel(2_500_000_000)], ['1 KB', '5 MB', '2.5 GB']);
});
await ok('study room: add, rename, move, remove and choose the current scene', () => {
  room.resetRoomForTest();
  const a = room.addScene({ title: 'One', kind: 'url', url: 'https://example.com/1.mp4' }), b = room.addScene({ title: 'Two', kind: 'file', url: '', size: 10 }, 'file-2');
  assert.ok(a && b); assert.equal(room.getRoom().sceneId, a.id, 'the first scene is chosen automatically'); assert.equal(room.addScene({ title: 'x', kind: 'url', url: 'nope' }), null);
  room.renameScene(a.id, 'Renamed'); assert.equal(room.getScenes()[0].title, 'Renamed'); room.moveScene('file-2', -1); assert.equal(room.getScenes()[0].id, 'file-2'); room.moveScene('file-2', -1); assert.equal(room.getScenes()[0].id, 'file-2');
  assert.equal(room.currentScene(room.getScenes(), room.getRoom()).id, a.id); room.removeScene(a.id); assert.equal(room.getRoom().sceneId, 'file-2'); assert.equal(room.currentScene(room.getScenes(), room.getRoom()).id, 'file-2');
  room.removeScene('file-2'); assert.equal(room.currentScene(room.getScenes(), room.getRoom()), null);
});

// ------------------------------------------------------------------ puck
const puck = await loadModule(src('puck'));
const puckMain = require('../electron/puck.cjs');
await ok('puck: settings are sanitized and keep sensible defaults', () => {
  const d = puck.sanitizePuck(undefined); assert.equal(d.page, 'scrolled'); assert.equal(d.desk, 'off'); assert.equal(d.main, 'timer'); assert.ok(d.actions.includes('skip'), 'skip is there by default');
  const s = puck.sanitizePuck({ page: 'nope', desk: 'away', actions: ['sound', 'sound', 'bogus', 'zen'], info: ['clock', 'x'], opacity: 5, scrollAfter: 99999, size: 'large', corner: 'tr' });
  assert.equal(s.page, 'scrolled'); assert.equal(s.desk, 'away'); assert.deepEqual(s.actions, ['sound', 'zen']); assert.deepEqual(s.info, ['clock']); assert.equal(s.opacity, 40); assert.equal(s.scrollAfter, 3000); assert.equal(s.size, 'large'); assert.equal(s.corner, 'tr');
  assert.deepEqual(puck.sanitizePuck({ actions: [] }).actions, [], 'an empty list stays empty: nothing is forced');
  assert.deepEqual(puck.sanitizePuck({ actions: 'x' }).actions, puck.defaultPuck.actions);
});
await ok('puck: buttons follow the person\'s order, and skip only exists for the pomodoro timer', () => {
  const st = (mode) => ({ ...puck.idlePuckState, mode });
  const s = puck.sanitizePuck({ main: 'timer', actions: ['zen', 'timer', 'skip', 'finish', 'app', 'sound'] });
  assert.deepEqual(puck.visibleActions(s, st('pomodoro'), true), ['zen', 'skip', 'app', 'sound'], 'the big button\'s own action is not repeated; finish needs a stopwatch or countdown');
  assert.deepEqual(puck.visibleActions(s, st('stopwatch'), false), ['zen', 'finish', 'sound'], 'no app button in a browser');
  assert.equal(puck.mainAction(puck.sanitizePuck({ main: 'sound' })), 'sound'); assert.equal(puck.commandFor('skip'), 'timer.skip'); assert.equal(puck.commandFor('nope'), null);
  for (const a of puck.PUCK_ACTIONS) assert.equal(puckMain.ACTIONS[a.id], a.command, `the shell and the page agree on ${a.id}`);
});
await ok('puck: labels show only what was chosen and drop empty ones', () => {
  const state = { ...puck.idlePuckState, title: 'Rain on a window', clock: '18:42', phase: 'Focus', subject: 'Maths', goal: 'x'.repeat(60), daily: 0.6, todos: 1 };
  const all = puck.puckLabels(puck.sanitizePuck({ info: ['todos', 'daily', 'goal', 'subject', 'phase', 'clock', 'title'] }), state);
  assert.deepEqual(all.map((l) => l.key), ['title', 'phase', 'subject', 'goal', 'clock', 'daily', 'todos']); assert.equal(all.find((l) => l.key === 'todos').text, '1 to-do'); assert.equal(all.find((l) => l.key === 'daily').text, '60% today'); assert.ok(all.find((l) => l.key === 'goal').text.endsWith('…'));
  assert.deepEqual(puck.puckLabels(puck.sanitizePuck({ info: ['clock'] }), state).map((l) => l.text), ['18:42']); assert.deepEqual(puck.puckLabels(puck.sanitizePuck({ info: ['daily', 'todos'] }), { ...state, daily: null, todos: 0 }), []);
  assert.equal(puck.sanitizePuckState({ title: 'a\nb', progress: 9, daily: 'x' }).title, 'a b'); assert.equal(puck.sanitizePuckState({ progress: 9 }).progress, 1); assert.equal(puck.sanitizePuckState({ daily: 'x' }).daily, null);
});
await ok('puck: in the page it shows after scrolling, only while something runs, never in Zen', () => {
  const run = { ...puck.idlePuckState, timerRunning: true }, idle = puck.idlePuckState;
  const set = (o) => puck.sanitizePuck(o);
  assert.equal(puck.pageVisible(set({}), 900, run, false), true); assert.equal(puck.pageVisible(set({}), 100, run, false), false); assert.equal(puck.pageVisible(set({}), 900, idle, false), false);
  assert.equal(puck.pageVisible(set({ idleHide: false }), 900, idle, false), true); assert.equal(puck.pageVisible(set({ page: 'always' }), 0, run, false), true); assert.equal(puck.pageVisible(set({ page: 'off' }), 900, run, false), false);
  assert.equal(puck.pageVisible(set({ page: 'always' }), 0, run, true), false); assert.equal(puck.pageVisible(set({ scrollAfter: 0 }), 1, { ...idle, soundPlaying: true }, false), true);
});
await ok('puck shell: when the floating window shows', () => {
  const v = (o) => ({ foreground: false, active: true, idleHide: true, ...o });
  assert.equal(puckMain.deskVisible('off', v({})), false); assert.equal(puckMain.deskVisible('away', v({})), true); assert.equal(puckMain.deskVisible('away', v({ foreground: true })), false, 'hidden while this app is in front');
  assert.equal(puckMain.deskVisible('away', v({ active: false })), false, 'nothing running: hidden'); assert.equal(puckMain.deskVisible('away', v({ active: false, idleHide: false })), true);
  assert.equal(puckMain.deskVisible('running', v({ foreground: true })), true); assert.equal(puckMain.deskVisible('running', v({ active: false })), false);
  assert.equal(puckMain.deskVisible('always', v({ foreground: true, active: false, idleHide: false })), true); assert.equal(puckMain.deskVisible('always', v({ active: false })), false);
});
await ok('puck shell: corners, saved positions and a monitor that went away', () => {
  const area = { x: 0, y: 0, width: 1920, height: 1040 }, size = { width: 300, height: 60 };
  assert.deepEqual(puckMain.defaultPosition(area, size, 'bl'), { x: 16, y: 964 }); assert.deepEqual(puckMain.defaultPosition(area, size, 'tr'), { x: 1604, y: 16 });
  const two = [area, { x: 1920, y: 0, width: 1280, height: 1024 }];
  assert.deepEqual(puckMain.clampPosition({ x: 2000, y: 100 }, size, two), { x: 2000, y: 100 }, 'on the second monitor');
  assert.equal(puckMain.clampPosition({ x: 2000, y: 100 }, size, [area]), null, 'that monitor is gone: caller picks the default');
  assert.deepEqual(puckMain.clampPosition({ x: 1800, y: 1030 }, size, [area]), { x: 1620, y: 980 }, 'pulled back inside the screen');
  assert.equal(puckMain.clampPosition({ x: 1, y: 1 }, size, []), null); assert.equal(puckMain.clampPosition({ x: NaN, y: 1 }, size, [area]), null);
  assert.equal(puckMain.sanitizeSettings({ desk: 'x' }).desk, 'off'); assert.equal(puckMain.sanitizeSettings({ opacity: 3 }).opacity, 40); assert.equal(puckMain.sanitizeSettings({ idleHide: false }).idleHide, false);
});
await ok('puck shell: the window shows and hides on its own, is clicked, dragged, resized and remembered', () => {
  const made = [];
  class FakeWin {
    constructor(o) { this.o = o; this.bounds = { x: 0, y: 0, width: o.width, height: o.height }; this.shown = false; this.sent = []; this.destroyed = false; made.push(this);
      this.webContents = { id: 7, on: (ev, fn) => { if (ev === 'did-finish-load') this.finish = fn; }, setWindowOpenHandler() {}, send: (c, p) => this.sent.push([c, p]) }; }
    setAlwaysOnTop() {} loadURL() { return Promise.resolve(); } on() {} isDestroyed() { return this.destroyed; } setBounds(b) { this.bounds = { ...b }; } getBounds() { return { ...this.bounds }; }
    showInactive() { this.shown = true; } hide() { this.shown = false; } destroy() { this.destroyed = true; }
  }
  const screen = { getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }], getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }) };
  let saved = null; const store = { get: () => ({ puckPos: saved }), patch: (p) => { saved = p.puckPos; } }; const ran = [];
  const p = puckMain.createPuck({ BrowserWindow: FakeWin, screen, preload: 'x', url: 'x', store, onAction: (name, command) => ran.push([name, command]), isMac: false });
  const payload = (desk, active) => ({ state: { clock: '10:00' }, settings: { desk, corner: 'br' }, dark: true, active });
  p.update(payload('off', true)); assert.equal(made.length, 0, 'off: no window is even created');
  p.update(payload('away', true)); assert.equal(made.length, 1); assert.equal(made[0].shown, true, 'another app is in front: the puck shows');
  assert.deepEqual([made[0].o.focusable, made[0].o.alwaysOnTop, made[0].o.frame, made[0].o.skipTaskbar], [false, true, false, true], 'never takes focus, floats, no frame, no taskbar button');
  assert.deepEqual([made[0].bounds.x, made[0].bounds.y], [1920 - made[0].bounds.width - 16, 1040 - made[0].bounds.height - 16], 'first placed in the chosen corner');
  made[0].finish(); assert.deepEqual(made[0].sent.at(-1)[1].dark, true); assert.equal(made[0].sent.at(-1)[0], 'puck:state');
  p.setForeground(true); assert.equal(made[0].shown, false, 'coming back to the app hides it'); p.setForeground(false); assert.equal(made[0].shown, true);
  p.update(payload('away', false)); assert.equal(made[0].shown, false, 'nothing playing: hidden'); p.update(payload('always', true)); p.setForeground(true); assert.equal(made[0].shown, true);
  p.resize(280, 40); assert.deepEqual([made[0].bounds.width, made[0].bounds.height], [280 + puckMain.SHADOW, 40 + puckMain.SHADOW]); p.resize(99999, 9); assert.equal(made[0].bounds.width, 760); assert.equal(made[0].bounds.height, 33); p.resize(10, 1); assert.equal(made[0].bounds.height, 30);
  p.resize(280, 40); const b0 = made[0].getBounds(); p.drag('start', 100, 100); p.drag('move', 50, 20); assert.deepEqual([made[0].bounds.x, made[0].bounds.y], [b0.x - 50, b0.y - 80]); p.drag('end', 50, 20);
  assert.deepEqual([saved.x, saved.y], [b0.x - 50, b0.y - 80], 'the new place is saved');
  p.drag('start', 0, 0); p.drag('end', -99999, -99999); assert.ok(made[0].bounds.x >= 0 && made[0].bounds.y >= 0, 'cannot be dragged off every screen');
  p.drag('move', 5, 5); // no drag in progress: ignored
  p.run('timer'); p.run('zen'); p.run('bogus'); assert.deepEqual(ran, [['timer', 'timer.toggle'], ['zen', 'zen.toggle']], 'only known buttons run, and only as fixed commands');
  p.update(payload('off', true)); assert.equal(made[0].shown, false); p.resetPosition(); assert.equal(saved, null); p.destroy(); assert.equal(made[0].destroyed, true);
});

// ------------------------------------------------------------------ monitors and snapping
const mon = require('../electron/monitors.cjs');
const D = (id, label, x, w, h, internal = false, y = 0) => ({ id, label, internal, bounds: { x, y, width: w, height: h }, workArea: { x, y, width: w, height: h - 40 }, size: { width: w, height: h }, scaleFactor: 1 });
await ok('monitors: readable names, left to right, never "main" and "secondary"', () => {
  const two = [D(1, '', 0, 1920, 1080, true), D(2, 'Generic PnP Monitor', 1920, 2560, 1440)];
  const a = mon.describe(two, { primaryId: 1, currentId: 1 });
  assert.deepEqual(a.map((m) => m.name), ['Built-in screen', 'Right screen']); assert.equal(a[0].primary, true); assert.equal(a[1].where, 'right'); assert.equal(a[0].current, true);
  const named = mon.describe([D(1, 'DELL U2723QE', 0, 2560, 1440), D(2, 'DELL U2723QE', 2560, 2560, 1440)], { primaryId: 1, currentId: 2 });
  assert.deepEqual(named.map((m) => m.name), ['DELL U2723QE (1)', 'DELL U2723QE (2)'], 'two identical screens are told apart'); assert.notEqual(named[0].key, named[1].key); assert.equal(named[1].current, true);
  const nick = mon.describe(two, { primaryId: 1, currentId: 1, names: { [a[1].key]: 'Desk monitor' } }); assert.equal(nick[1].name, 'Desk monitor');
  const three = mon.describe([D(1, '', 0, 1000, 800), D(2, '', 1000, 1000, 800), D(3, '', 2000, 1000, 800)], { primaryId: 2 }); assert.deepEqual(three.map((m) => m.name), ['Left screen', 'Middle screen', 'Right screen']);
  assert.deepEqual(mon.describe([D(1, '', 0, 1000, 800)], { primaryId: 1 }).map((m) => m.name), ['Screen']);
  const above = mon.describe([D(1, '', 0, 1000, 800, false, 0), D(2, '', 0, 1000, 800, false, -800)], { primaryId: 1 }); assert.equal(above.find((m) => m.id === 2).where, 'above');
});
await ok('monitors: the saved settings are sanitized', () => {
  const c = mon.sanitizeConfig({ names: { a: 'x'.repeat(99), '': 'no' }, onlyOn: 'k', rules: [{ on: 'disconnect', then: 'format c:' }, { on: 'connect', monitor: 'k', then: 'snap:left', atStart: true }, null, 5] });
  assert.equal(c.names.a.length, 40); assert.equal(c.rules.length, 2); assert.equal(c.rules[0].then, 'none'); assert.equal(c.rules[0].moveTo, 'primary'); assert.equal(c.rules[1].moveTo, 'trigger'); assert.equal(c.rules[1].atStart, true); assert.equal(c.onlyOn, 'k');
  assert.equal(mon.sanitizeConfig(undefined).rules.length, 0); assert.equal(mon.sanitizeConfig({ rules: new Array(40).fill({}) }).rules.length, mon.MAX_RULES);
  assert.deepEqual(mon.sanitizeConfig({ seen: { k: { name: 'A', width: 5, height: 'x' } } }).seen.k, { name: 'A', width: 5, height: 0 });
  const settings = require('../electron/settings.cjs'); assert.deepEqual(settings.sanitize({}).monitors, { names: {}, seen: {}, onlyOn: '', rules: [] }); assert.equal(settings.sanitize({}).nativeControls, true, 'system buttons by default: they bring the Windows 11 snap layouts');
});
await ok('monitors: snap layouts fill exactly the part of the screen they name', () => {
  const wa = { x: 100, y: 50, width: 1000, height: 600 };
  const eq = (layout, want) => assert.deepEqual(mon.snapBounds(wa, layout), want, layout);
  eq('left', { x: 100, y: 50, width: 500, height: 600 }); eq('right', { x: 600, y: 50, width: 500, height: 600 }); eq('top', { x: 100, y: 50, width: 1000, height: 300 }); eq('bottom', { x: 100, y: 350, width: 1000, height: 300 });
  eq('topleft', { x: 100, y: 50, width: 500, height: 300 }); eq('bottomright', { x: 600, y: 350, width: 500, height: 300 }); eq('third-middle', { x: 433, y: 50, width: 333, height: 600 }); eq('third-right', { x: 766, y: 50, width: 334, height: 600 });
  const odd = { x: 0, y: 0, width: 1001, height: 601 }; assert.equal(mon.snapBounds(odd, 'left').width + mon.snapBounds(odd, 'right').width, 1001, 'two halves meet with no gap on an odd width');
  assert.equal(mon.snapBounds(odd, 'third-left').width + mon.snapBounds(odd, 'third-middle').width + mon.snapBounds(odd, 'third-right').width, 1001);
  assert.equal(mon.snapBounds(wa, 'nonsense'), null); assert.equal(mon.LAYOUTS.length, 12); for (const l of mon.LAYOUTS) assert.ok(mon.LAYOUT_LABELS[l] && mon.snapBounds(wa, l));
  const c = mon.snapBounds(wa, 'center'); assert.equal(c.x + c.width / 2, 600); assert.equal(c.y + c.height / 2, 350);
  const m = mon.moveInto({ x: 100, y: 100, width: 800, height: 600 }, { x: 0, y: 0, width: 1920, height: 1040 }, { x: 1920, y: 0, width: 1280, height: 500 });
  assert.deepEqual([m.width, m.height], [800, 500], 'shrunk to fit'); assert.ok(m.x >= 1920 && m.x + m.width <= 3200 && m.y >= 0);
});
await ok('monitors: rules say where the app goes and what happens next', () => {
  const list = mon.describe([D(1, '', 0, 1920, 1080, true), D(2, 'LG 4K', 1920, 3840, 2160)], { primaryId: 1, currentId: 1 });
  const lg = list[1].key, lap = list[0].key;
  const rules = mon.sanitizeConfig({ rules: [
    { id: 'a', on: 'connect', monitor: lg, moveTo: 'trigger', then: 'zen-full', atStart: true },
    { id: 'b', on: 'disconnect', monitor: lg, moveTo: 'primary', then: 'zen-off' },
    { id: 'c', on: 'connect', monitor: '', moveTo: 'keep', then: 'compact' },
    { id: 'd', enabled: false, on: 'connect', monitor: lg, then: 'zen' },
    { id: 'e', on: 'connect', monitor: lg, moveTo: 'gone|1x1|e', then: 'none' },
  ] }).rules;
  assert.deepEqual(mon.planRules(rules, { type: 'connect', key: lg }, list), [{ ruleId: 'a', target: lg, then: 'zen-full' }, { ruleId: 'c', target: null, then: 'compact' }], 'a disabled rule and a rule that points nowhere do nothing');
  assert.deepEqual(mon.planRules(rules, { type: 'connect', key: lap }, list).map((p) => p.ruleId), ['c'], 'a rule for one screen ignores other screens');
  assert.deepEqual(mon.planRules(rules, { type: 'disconnect', key: lg }, list), [{ ruleId: 'b', target: 'primary', then: 'zen-off' }]);
  assert.deepEqual(mon.planRules(rules, { type: 'start' }, list), [{ ruleId: 'a', target: lg, then: 'zen-full' }], 'at start only rules marked so, and only if that screen is connected');
  assert.deepEqual(mon.planRules(rules, { type: 'start' }, list.slice(0, 1)), [], 'screen not connected at start');
  assert.equal(mon.enforceTarget(lg, list, lap), lg); assert.equal(mon.enforceTarget(lg, list, lg), null); assert.equal(mon.enforceTarget('', list, lap), null); assert.equal(mon.enforceTarget(lg, list.slice(0, 1), lap), null, 'that screen is not connected: stay');
});

// ------------------------------------------------------------------ automations
const au = await loadModule(src('automations'));
const macrosLib = await loadModule(src('macros'));
await ok('automations: saved rules are sanitized and nothing is invented', () => {
  const [a] = au.sanitizeAutomations([{ id: 'a b', name: '  ', trigger: { type: 'nope', time: '25:00', minutes: 9999, days: -3 }, when: { weekdays: [1, 1, 9, 'x', 3], from: '9:00', to: '10:00', sound: 'loud' }, limit: 'weekly', steps: [{ type: 'play' }, { type: 'format-disk' }, { type: 'notify', value: 'x'.repeat(500) }, { type: 'snap', value: '../x' }] }]);
  assert.equal(a.trigger.type, 'focus-start'); assert.equal(a.trigger.time, '22:00'); assert.equal(a.trigger.minutes, 600); assert.equal(a.trigger.days, 0); assert.deepEqual(a.when.weekdays, [1, 3]); assert.equal(a.when.from, ''); assert.equal(a.when.sound, 'any'); assert.equal(a.limit, 'always'); assert.equal(a.name, 'Automation');
  assert.deepEqual(a.steps.map((s) => s.type), ['play', 'notify', 'snap']); assert.equal(a.steps[1].value.length, 120); assert.equal(a.steps[2].value, 'left'); assert.match(a.id, /^[\w-]+$/);
  assert.deepEqual(au.sanitizeAutomations('x'), []); assert.equal(au.sanitizeAutomations(new Array(50).fill({})).length, au.MAX_AUTOMATIONS);
  assert.deepEqual(au.sanitizeAutomations([{ when: { weekdays: [0, 1, 2, 3, 4, 5, 6] } }])[0].when.weekdays, [], 'all seven days means every day');
  const ids = au.sanitizeAutomations([{ id: 'same' }, { id: 'same' }]).map((x) => x.id); assert.notEqual(ids[0], ids[1]);
});
await ok('automations: macro steps gained the new actions, as commands', () => {
  assert.equal(macrosLib.stepCommand({ type: 'zen-open', value: '' }), 'zen.open'); assert.equal(macrosLib.stepCommand({ type: 'breathe', value: '' }), 'calm.breathe'); assert.equal(macrosLib.stepCommand({ type: 'snap', value: 'right' }), 'window.snap:right');
  assert.equal(macrosLib.stepCommand({ type: 'snap', value: 'x' }), null); assert.equal(macrosLib.stepCommand({ type: 'notify', value: 'hi' }), null, 'a message is handled by the runner, not as a command');
  const commands = require('../electron/commands.cjs'); for (const t of macrosLib.STEP_TYPES) { const c = macrosLib.stepCommand({ type: t.type, value: t.type === 'snap' ? 'left' : 'x' }); if (c && !t.type.startsWith('window-')) assert.ok(commands.parse(c), `the shell knows ${c}`); }
});
await ok('automations: conditions decide whether an event starts a rule', () => {
  const at = (h, m, d = 6) => new Date(2026, 9, d, h, m).getTime(); // 6 Oct 2026 is a Tuesday
  const base = au.newAutomation({ trigger: { type: 'focus-end', minutes: 25 }, steps: [{ type: 'play', value: '' }] });
  const ev = (o = {}) => ({ type: 'focus-end', at: at(10, 0), data: { minutes: 30 }, ...o });
  const ctx = { subject: 'ib:math-aa-hl', soundPlaying: false, timerRunning: true };
  assert.equal(au.whyNot(base, ev(), ctx, undefined), ''); assert.equal(au.whyNot(base, ev({ data: { minutes: 10 } }), ctx, undefined), 'shorter than the minimum'); assert.equal(au.whyNot(base, ev({ type: 'break-start' }), ctx, undefined), 'other trigger');
  assert.equal(au.whyNot({ ...base, enabled: false }, ev(), ctx, undefined), 'off');
  assert.equal(au.whyNot({ ...base, when: { ...base.when, weekdays: [2] } }, ev(), ctx, undefined), '', 'the day is a Tuesday (2)');
  assert.equal(au.whyNot({ ...base, when: { ...base.when, weekdays: [1, 3] } }, ev(), ctx, undefined), 'not on this weekday');
  const win = { ...base, when: { ...base.when, from: '09:00', to: '12:00' } }; assert.equal(au.whyNot(win, ev(), ctx, undefined), ''); assert.equal(au.whyNot(win, ev({ at: at(13, 0) }), ctx, undefined), 'outside the time window');
  const night = { ...base, when: { ...base.when, from: '22:00', to: '06:00' } }; assert.equal(au.whyNot(night, ev({ at: at(23, 30) }), ctx, undefined), ''); assert.equal(au.whyNot(night, ev({ at: at(3, 0) }), ctx, undefined), '', 'a window that crosses midnight'); assert.equal(au.whyNot(night, ev({ at: at(12, 0) }), ctx, undefined), 'outside the time window');
  assert.equal(au.whyNot({ ...base, when: { ...base.when, subject: 'ib:physics-hl' } }, ev(), ctx, undefined), 'other subject'); assert.equal(au.whyNot({ ...base, when: { ...base.when, sound: 'playing' } }, ev(), ctx, undefined), 'sound is off');
  assert.equal(au.whyNot({ ...base, when: { ...base.when, timer: 'idle' } }, ev(), ctx, undefined), 'timer is running');
  const daily = { ...base, limit: 'daily' }; assert.equal(au.whyNot(daily, ev(), ctx, at(8, 0)), 'already ran today'); assert.equal(au.whyNot(daily, ev(), ctx, at(8, 0, 5)), '', 'yesterday does not count');
  const hourly = { ...base, limit: 'hourly' }; assert.equal(au.whyNot(hourly, ev(), ctx, at(9, 30)), 'ran within the hour'); assert.equal(au.whyNot(hourly, ev(), ctx, at(8, 30)), '');
  const exam = au.newAutomation({ trigger: { type: 'exam-days', days: 7 } }); assert.equal(au.whyNot(exam, { type: 'exam-days', at: at(8, 0), data: { days: 7 } }, ctx), ''); assert.equal(au.whyNot(exam, { type: 'exam-days', at: at(8, 0), data: { days: 6 } }, ctx), 'different number of days');
  const clock = au.newAutomation({ trigger: { type: 'at-time', time: '22:30' } }); assert.equal(au.whyNot(clock, { type: 'at-time', at: at(22, 30), data: { time: '22:30' } }, ctx), ''); assert.equal(au.whyNot(clock, { type: 'at-time', at: at(22, 31), data: { time: '22:31' } }, ctx), 'other time');
});
await ok('automations: the engine never loops and caps runs', () => {
  let t = 1_000_000; const ran = [], logs = [], last = {};
  const list = [au.newAutomation({ id: 'a', trigger: { type: 'sound-start' }, steps: [{ type: 'pause', value: '' }] }), au.newAutomation({ id: 'b', trigger: { type: 'sound-stop' }, steps: [{ type: 'play', value: '' }] })];
  const engine = au.createEngine({ now: () => t, getList: () => list, getCtx: () => ({ subject: '', soundPlaying: false, timerRunning: false }), run: (a) => { ran.push(a.id); engine.touch(); }, log: (e) => { logs.push(e); if (e.note === 'ran') last[e.id] = e.at; }, lastRun: (id) => last[id] });
  assert.deepEqual(engine.handle({ type: 'sound-start', at: t }), ['a']);
  t += 200; assert.deepEqual(engine.handle({ type: 'sound-stop', at: t }), [], 'the stop that rule A caused does not start rule B'); assert.ok(logs.some((l) => l.id === 'b' && /right after another automation/.test(l.note)));
  t += 5000; assert.deepEqual(engine.handle({ type: 'sound-stop', at: t }), ['b'], 'a stop you cause yourself, later, does');
  assert.deepEqual(engine.handle({ type: 'zen-open', at: t }), [], 'no rule for that event');
  let n = 1_000_000_000; const many = []; const e2 = au.createEngine({ now: () => n, quietMs: 0, maxPerMinute: 3, getList: () => [au.newAutomation({ id: 'x', trigger: { type: 'distraction' } })], getCtx: () => ({ subject: '', soundPlaying: false, timerRunning: false }), run: () => many.push(n), log: () => undefined, lastRun: () => undefined });
  for (let i = 0; i < 6; i += 1) { n += 1000; e2.handle({ type: 'distraction', at: n }); } assert.equal(many.length, 3, 'at most three runs a minute'); n += 61_000; e2.handle({ type: 'distraction', at: n }); assert.equal(many.length, 4);
});
await ok('automations: the clock fires once per minute, and templates are all valid', () => {
  const t0 = new Date(2026, 9, 6, 22, 30, 5).getTime(); const a = au.clockEvent(t0, ''); assert.equal(a.event.data.time, '22:30'); assert.equal(au.clockEvent(t0 + 20_000, a.minute).event, null, 'same minute: nothing'); assert.equal(au.clockEvent(t0 + 60_000, a.minute).event.data.time, '22:31');
  assert.ok(au.TEMPLATES.length >= 8); for (const tpl of au.TEMPLATES) { const m = tpl.make(); assert.ok(m.steps.length > 0 && m.name, tpl.id); assert.deepEqual(au.sanitizeAutomations([m])[0].steps, m.steps, `${tpl.id} survives sanitizing`); }
  assert.equal(au.TEMPLATES.find((x) => x.id === 'evening-wind-down').make().trigger.time, '22:30');
  const keys = require('../electron/commands.cjs'); assert.ok(keys.parse('zen.open')); assert.ok(keys.parse('puck.toggle'));
});

// ------------------------------------------------------------------ drift detection
const dr = await loadModule(src('drift'));
const dd = (over = {}) => dr.sanitizeDrift({ enabled: true, ...over });
await ok('drift: rules judge apps, sites, titles, study words and your own lists', () => {
  const s = dd();
  const c = (o) => dr.classify({ app: '', title: '', host: '', viaTab: false, ...o }, s);
  assert.equal(c({ app: 'Steam.exe' }).verdict, 'drift', 'a launcher');
  assert.equal(c({ app: 'brave', host: 'www.instagram.com', viaTab: true }).verdict, 'drift', 'a site from the helper');
  assert.equal(c({ app: 'brave', host: 'm.youtube.com', viaTab: true }).verdict, 'drift', 'a subdomain');
  assert.equal(c({ app: 'brave', host: 'notyoutube.com', viaTab: true }).verdict, 'unknown', 'not a suffix trick');
  assert.equal(c({ app: 'brave', host: 'youtube.com', title: 'Khan Academy lecture on integrals', viaTab: true }).verdict, 'ok', 'study words win');
  assert.equal(c({ app: 'brave', title: 'Funny cats - YouTube - Brave' }).verdict, 'drift', 'title guess without the helper');
  assert.equal(dr.classify({ app: 'brave', title: 'Funny cats - YouTube', host: '', viaTab: false }, dd({ titleMatch: false })).verdict, 'unknown', 'title guess can be switched off');
  assert.equal(c({ app: 'brave', title: 'Instagram', host: 'docs.google.com', viaTab: true }).verdict, 'unknown', 'a known exact site beats a title word');
  assert.equal(c({ app: 'whatsapp' }).verdict, 'unknown', 'chat is off by default');
  assert.equal(dr.classify({ app: 'whatsapp', title: '', host: '', viaTab: false }, dd({ categories: { chat: true } })).verdict, 'drift');
  assert.equal(dr.classify({ app: 'steam', title: '', host: '', viaTab: false }, dd({ categories: { games: false } })).verdict, 'unknown', 'a group can be off');
  assert.equal(dr.classify({ app: 'steam', title: '', host: '', viaTab: false }, dd({ allowApps: 'Steam' })).verdict, 'ok', 'allowed apps win');
  assert.equal(dr.classify({ app: 'brave', title: '', host: 'reddit.com', viaTab: true }, dd({ allowSites: 'reddit.com' })).verdict, 'ok');
  assert.equal(dr.classify({ app: 'notepad', title: 'x', host: '', viaTab: false }, dd({ blockApps: 'notepad' })).verdict, 'drift');
  assert.equal(dr.classify({ app: 'word', title: 'memes.docx', host: '', viaTab: false }, dd({ blockWords: 'memes' })).verdict, 'drift');
  assert.equal(c({ app: 'explorer' }).verdict, 'neutral'); assert.equal(c({ app: 'Study with Sarang' }).verdict, 'ok');
  assert.equal(c({ app: 'code' }).verdict, 'unknown');
  const cache = new Map([['a:code', 'drift'], ['h:blog.example.com', 'ok']]);
  assert.equal(dr.classify({ app: 'code', title: '', host: '', viaTab: false }, s, cache).verdict, 'drift', 'an earlier AI answer is used');
  assert.equal(dr.classify({ app: 'brave', title: '', host: 'blog.example.com', viaTab: true }, s, cache).verdict, 'ok');
  assert.equal(dr.normHost('https://WWW.Example.com:8080/a?b'), 'example.com'); assert.equal(dr.normHost('bad host!'), '');
});
await ok('drift: the tracker waits, alerts once per cooldown, once per stay, and respects focus and "allow"', () => {
  let t = 1_000_000; let focus = true; const events = []; let settings = dd({ graceSec: 20, cooldownMin: 3 });
  const tr = dr.createDriftTracker({ now: () => t, settings: () => settings, focusActive: () => focus, onDrift: (e) => events.push(e) });
  const win = (app, title = '') => tr.feed({ src: 'window', app, title, host: '', at: t });
  win('steam'); t += 10_000; tr.tick(); assert.equal(events.length, 0, 'within the grace time');
  t += 11_000; tr.tick(); assert.equal(events.length, 1); assert.equal(events[0].firstOfEpisode, true); assert.equal(events[0].label, 'steam'); assert.equal(events[0].source, 'rules');
  t += 60_000; tr.tick(); assert.equal(events.length, 1, 'cooldown');
  t += 130_000; tr.tick(); assert.equal(events.length, 2); assert.equal(events[1].firstOfEpisode, false, 'the same stay');
  win('explorer'); t += 200_000; tr.tick(); assert.equal(events.length, 2, 'the taskbar does not end the stay and does not alert by itself');
});
await ok('drift: a short alt-tab does not count, focus-only and allow-for-now work, a new stay is a new episode', () => {
  let t = 5_000_000; let focus = false; const events = []; const settings = dd({ graceSec: 5, cooldownMin: 1 });
  const tr = dr.createDriftTracker({ now: () => t, settings: () => settings, focusActive: () => focus, onDrift: (e) => events.push(e) });
  const win = (app) => tr.feed({ src: 'window', app, title: '', host: '', at: t });
  win('steam'); t += 6_000; tr.tick(); assert.equal(events.length, 0, 'not during a break');
  focus = true; tr.tick(); assert.equal(events.length, 1, 'focus started while on steam');
  win('word'); t += 90_000; tr.tick(); win('steam'); t += 3_000; tr.tick(); assert.equal(events.length, 1, 'back on steam only 3 s');
  t += 3_000; tr.tick(); assert.equal(events.length, 2); assert.equal(events[1].firstOfEpisode, true, 'a new stay');
  tr.allowNow(); t += 120_000; tr.tick(); assert.equal(events.length, 2, 'allowed for now'); assert.deepEqual(tr.allowedNow(), ['steam|']);
  tr.resetAllowed(); t += 10_000; tr.tick(); assert.equal(events.length, 3);
  settings.enabled = false; t += 400_000; tr.tick(); assert.equal(events.length, 3, 'off means silent');
});
await ok('drift: the helper tab wins for browsers while fresh, then the title is used', () => {
  let t = 9_000_000; const events = []; const settings = dd({ graceSec: 5, cooldownMin: 1, helper: true });
  const tr = dr.createDriftTracker({ now: () => t, settings: () => settings, focusActive: () => true, onDrift: (e) => events.push(e) });
  tr.feed({ src: 'window', app: 'brave', title: 'Docs - Brave', host: '', at: t });
  tr.feed({ src: 'tab', app: 'brave', title: 'Feed', host: 'instagram.com', at: t, browser: 'brave' });
  t += 6_000; tr.tick(); assert.equal(events.length, 1); assert.equal(events[0].source, 'helper'); assert.equal(events[0].host, 'instagram.com');
  t += 100_000; tr.tick(); assert.equal(tr.state().viaTab, false, 'a stale tab report is not trusted');
  tr.feed({ src: 'window', app: 'chrome', title: 'Reddit - Chrome', host: '', at: t }); t += 6_000; tr.tick(); assert.equal(events.at(-1).source, 'rules');
  const seen = []; const t2 = dr.createDriftTracker({ now: () => t, settings: () => dd({ graceSec: 5, ai: true }), focusActive: () => true, onDrift: () => {}, onUnknown: (k, s) => seen.push([k, s.app]) });
  t2.feed({ src: 'window', app: 'code', title: 'x', host: '', at: t }); t += 6_000; t2.tick(); t2.tick(); assert.deepEqual(seen, [['a:code', 'code']], 'unknown things are offered to the AI once');
});
await ok('drift: settings are cleaned, the AI prompt hides titles by default, replies are parsed, questions are limited', () => {
  const s = dr.sanitizeDrift({ graceSec: 1, cooldownMin: 9999, port: 80, token: 'nope', blockApps: '<b>x</b>, y', categories: { chat: true, nope: true }, helper: 'yes' });
  assert.equal(s.graceSec, 3); assert.equal(s.cooldownMin, 120); assert.equal(s.port, 1024); assert.equal(s.token, ''); assert.equal(s.blockApps, 'bx/b, y'); assert.equal(s.categories.chat, true); assert.equal(s.helper, false);
  assert.equal(dr.sanitizeDrift({ token: 'a'.repeat(48) }).token, 'a'.repeat(48)); assert.equal(dr.randomToken().length, 48); assert.match(dr.randomToken(), /^[a-f0-9]{48}$/);
  const p = dr.buildDriftPrompt({ app: 'code', host: '', title: 'secret.txt', subject: 'physics hl', goal: 'finish waves', sendTitle: false });
  assert.ok(!p.user.includes('secret.txt')); assert.ok(p.user.includes('physics hl')); assert.ok(dr.buildDriftPrompt({ app: 'code', host: '', title: 'secret.txt', subject: '', goal: '', sendTitle: true }).user.includes('secret.txt'));
  assert.deepEqual(dr.parseDriftReply('Sure! {"drift": true, "reason": "a game <x>"}'), { drift: true, reason: 'a game x' }); assert.equal(dr.parseDriftReply('{"drift":"yes"}'), null); assert.equal(dr.parseDriftReply('no'), null);
  let t = 0; const lim = dr.createHourLimiter(() => 2, () => t); assert.deepEqual([lim.allow(), lim.allow(), lim.allow()], [true, true, false]); t += 3_600_001; assert.equal(lim.allow(), true);
  assert.deepEqual(dr.topDrifts([{ label: 'a' }, { label: 'b' }, { label: 'b' }]), [{ label: 'b', count: 2 }, { label: 'a', count: 1 }]);
});
const driftShell = require('../electron/drift.cjs');
await ok('drift helper server: only this computer, only the extension, only with the code', async () => {
  const cfg = { port: 47615, token: 'ab'.repeat(16) };
  const chk = (h) => driftShell.checkRequest({ host: '127.0.0.1:47615', origin: '', auth: `Bearer ${cfg.token}`, ...h }, cfg);
  assert.equal(chk({}), null); assert.equal(chk({ origin: 'chrome-extension://abc' }), null);
  assert.equal(chk({ origin: 'https://evil.example' }).status, 403, 'a web page cannot talk to it');
  assert.equal(chk({ host: 'evil.example:47615' }).status, 403, 'DNS rebinding is refused');
  assert.equal(chk({ auth: 'Bearer wrong' }).status, 401); assert.equal(chk({ auth: '' }).status, 401);
  assert.equal(driftShell.checkRequest({ host: '127.0.0.1:47615', origin: '', auth: 'Bearer ' }, { port: 47615, token: '' }).status, 401, 'no code set means no access');
  assert.deepEqual(driftShell.cleanTab({ host: 'WWW.Example.com', title: 'a\nb', browser: 'Brave' }), { host: 'example.com', title: 'a b', browser: 'brave' });
  assert.equal(driftShell.cleanTab({ host: 'bad host', title: '' }), null); assert.ok(driftShell.cleanTab({ incognito: true, host: 'x.com' }).ignored); assert.equal(driftShell.cleanTab('x'), null);
});
await ok('drift helper server: a real request over 127.0.0.1 reaches the page, a wrong one does not', async () => {
  const got = []; const statuses = [];
  const d = driftShell.createDrift({ dir: '/tmp/none', platform: 'linux', scriptSource: () => '', onSample: (x) => got.push(x), onStatus: (x) => statuses.push(x.helper) });
  const token = 'cd'.repeat(16); const port = await new Promise((resolve) => { const probe = net.createServer(); probe.listen(0, '127.0.0.1', () => { const { port: free } = probe.address(); probe.close(() => resolve(free)); }); });
  d.configure({ enabled: true, window: true, helper: true, port, token });
  await new Promise((r) => setTimeout(r, 200));
  const post = (headers, body) => fetch(`http://127.0.0.1:${port}/tab`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const good = await post({ authorization: `Bearer ${token}`, origin: 'chrome-extension://abcdef' }, { host: 'www.youtube.com', title: 'Cats', browser: 'brave' });
  assert.equal(good.status, 200); assert.equal(got.length, 1); assert.deepEqual([got[0].src, got[0].host, got[0].title], ['tab', 'youtube.com', 'Cats']);
  assert.equal((await post({ authorization: 'Bearer nope' }, { host: 'a.com' })).status, 401);
  assert.equal((await post({ authorization: `Bearer ${token}`, origin: 'https://evil.example' }, { host: 'a.com' })).status, 403);
  assert.equal((await post({ authorization: `Bearer ${token}` }, { host: 'a.com', incognito: true })).status, 200); assert.equal(got.length, 1, 'private windows are ignored');
  assert.equal((await fetch(`http://127.0.0.1:${port}/ping`, { headers: { authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/nothing`, { headers: { authorization: `Bearer ${token}` } })).status, 404);
  assert.ok(statuses.includes('listening') && statuses.includes('connected'));
  d.configure({ enabled: true, window: true, helper: false, port, token }); await new Promise((r) => setTimeout(r, 100));
  await assert.rejects(fetch(`http://127.0.0.1:${port}/ping`), 'the server is closed when the helper is switched off');
  assert.equal(d.status().window, 'unsupported'); d.stop();
});
await ok('drift window reader: lines from the PowerShell reader become samples, and it stops with the setting', () => {
  const { EventEmitter } = require('node:events'); const { PassThrough } = require('node:stream');
  const got = []; let child; let killed = false;
  const spawn = (cmd, args) => { assert.equal(cmd, 'powershell.exe'); assert.ok(args.includes('-ParentPid')); child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => { killed = true; }; return child; };
  const os = require('node:os'); const dir = fs.mkdtempSync(`${os.tmpdir()}/drift-`);
  const d = driftShell.createDrift({ dir, platform: 'win32', spawn, scriptSource: () => '# script', onSample: (x) => got.push(x), onStatus: () => {} });
  d.configure({ enabled: true, window: true, helper: false, port: 47615, token: '' });
  child.stdout.write('{"type":"ready"}\n{"type":"window","app":"Steam","title":"Library\\u0001"}\nnot json\n');
  assert.equal(d.status().window, 'on'); assert.equal(got.length, 1); assert.deepEqual([got[0].app, got[0].title], ['Steam', 'Library ']);
  assert.ok(fs.readFileSync(`${dir}/drift-listener.ps1`, 'utf8').includes('# script'));
  d.configure({ enabled: false }); assert.equal(killed, true); assert.equal(d.status().window, 'off');
  const ps = fs.readFileSync(`${root}electron/drift-listener.ps1`, 'utf8'); assert.ok(ps.includes('GetForegroundWindow') && !/Invoke-WebRequest|Invoke-RestMethod|Net\.Sockets|WebClient/.test(ps), 'the reader sends nothing over a network');
});
await ok('drift extension: manifest is valid and asks only for what it needs', () => {
  const m = JSON.parse(fs.readFileSync(`${root}extension/manifest.json`, 'utf8'));
  assert.equal(m.manifest_version, 3); assert.deepEqual(m.host_permissions, ['http://127.0.0.1/*']); assert.deepEqual([...m.permissions].sort(), ['alarms', 'storage', 'tabs']);
  for (const f of [m.background.service_worker, m.options_page, 'icon48.png', 'icon128.png']) assert.ok(fs.existsSync(`${root}extension/${f}`), f);
  const bg = fs.readFileSync(`${root}extension/background.js`, 'utf8'); assert.ok(!/https?:\/\/(?!127\.0\.0\.1)/.test(bg.replace(/`http:\/\/127\.0\.0\.1/g, '')), 'no other address');
  assert.ok(JSON.parse(fs.readFileSync(`${root}package.json`, 'utf8')).build.files.includes('extension/**/*'));
  const out = fs.mkdtempSync(`${require('node:os').tmpdir()}/ext-`); driftShell.exportExtension(`${root}extension`, out); assert.ok(fs.existsSync(`${out}/manifest.json`));
});
await ok('drift: the app routes the commands and offers the tab on the desktop only', () => {
  const app = fs.readFileSync(`${root}electron/app.cjs`, 'utf8'); for (const ch of ['swa:drift-config', 'swa:drift-extension', 'swa:drift-sample']) assert.ok(app.includes(ch), ch);
  assert.ok(fs.readFileSync(`${root}src/components/SettingsPanel.tsx`, 'utf8').includes("id: 'drift', label: 'Drift detection', icon: Compass, desktopOnly: true"));
});

// ------------------------------------------------------------------ calendar
const cal = await loadModule(src('calendar'));
const NOWC = Date.UTC(2026, 9, 6, 12, 0, 0);
const sess = (o) => ({ id: 's1', startedAt: new Date(NOWC - 3_600_000).toISOString(), seconds: 1800, mode: 'pomodoro', task: 'Past paper 2', completed: true, distractions: 2, tabAways: 0, mixName: 'Rain', subject: 'ib:physics-hl', goal: 'Finish waves, part B', goalMet: 'yes', todosDone: 1, ...o });
const cctx = { now: NOWC, subjectName: (id) => (id === 'ib:physics-hl' ? 'Physics HL' : id), exam: { date: new Date(2027, 4, 5), label: 'Exams: IB May 2027' } };
await ok('calendar: a valid .ics with CRLF lines, UTC times, stable ids and nothing private by default', () => {
  const ics = cal.buildIcs([sess()], cal.sanitizeCalendar({}), cctx);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')); assert.ok(ics.endsWith('END:VCALENDAR\r\n')); assert.ok(!/[^\r]\n/.test(ics), 'only CRLF line breaks');
  assert.ok(ics.includes('UID:s1@study-with-sarang')); assert.ok(ics.includes('DTSTART:20260506T110000Z'.replace('0506', '1006')) || ics.includes('DTSTART:20261006T110000Z'));
  assert.ok(ics.includes('DTEND:20261006T114000Z') || ics.includes('DTEND:20261006T113000Z')); assert.ok(ics.includes('SUMMARY:Studied Physics HL')); assert.ok(ics.includes('TRANSP:TRANSPARENT'));
  assert.ok(!ics.includes('waves') && !ics.includes('Past paper') && !ics.includes('Rain') && !ics.includes('Distractions'), 'goal, task and stats are off by default');
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20270505') && ics.includes('DTEND;VALUE=DATE:20270506') && ics.includes('SUMMARY:Exams: IB May 2027'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2); assert.equal(ics, cal.buildIcs([sess()], cal.sanitizeCalendar({}), { ...cctx, now: NOWC }), 'same input, same text');
});
await ok('calendar: you choose what is added, and short or old blocks are left out', () => {
  const full = cal.buildIcs([sess()], cal.sanitizeCalendar({ includeGoal: true, includeTask: true, includeStats: true }), cctx).replace(/\r\n /g, '');
  assert.ok(full.includes('Goal: Finish waves\\, part B (reached)') && full.includes('Task: Past paper 2') && full.includes('Distractions: 2') && full.includes('Sound: Rain'));
  assert.ok(cal.buildIcs([sess()], cal.sanitizeCalendar({ title: 'generic' }), cctx).includes('SUMMARY:Study block'));
  assert.ok(cal.buildIcs([sess()], cal.sanitizeCalendar({ busy: true }), cctx).includes('TRANSP:OPAQUE'));
  const few = cal.buildIcs([sess({ id: 'a', seconds: 120 }), sess({ id: 'b', startedAt: new Date(NOWC - 200 * 86_400_000).toISOString() }), sess({ id: 'c' })], cal.sanitizeCalendar({ exams: false }), cctx);
  assert.deepEqual([...few.matchAll(/UID:(\w+)@/g)].map((m) => m[1]), ['c'], 'under 5 min and older than 120 days are out');
  assert.ok(!cal.buildIcs([], cal.sanitizeCalendar({ exams: false }), cctx).includes('VEVENT'));
  assert.ok(cal.buildIcs([sess({ goalMet: 'no' })], cal.sanitizeCalendar({ includeGoal: true }), cctx).includes('(not reached)'));
});
await ok('calendar: text is escaped, long lines folded without breaking characters, and injection is impossible', () => {
  assert.equal(cal.icsEscape('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const evil = cal.buildIcs([sess({ goal: 'x\r\nEND:VCALENDAR\r\nBEGIN:VEVENT', task: 'é'.repeat(100) })], cal.sanitizeCalendar({ includeGoal: true, includeTask: true }), cctx);
  assert.equal((evil.match(/^END:VCALENDAR/gm) ?? []).length, 1, 'a goal cannot end the calendar early');
  for (const line of evil.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, 'folded');
  const unfolded = evil.replace(/\r\n /g, ''); assert.ok(unfolded.includes('Task: ' + 'é'.repeat(100)), 'unfolding restores it, no broken characters');
  assert.equal(cal.icsFold('short'), 'short'); assert.ok(!/\ufffd/.test(evil));
  assert.equal(cal.icsUtc(Date.UTC(2026, 0, 2, 3, 4, 5)), '20260102T030405Z');
  const s = cal.sanitizeCalendar({ minMinutes: 0, days: 9999, title: 'x', enabled: 'yes' }); assert.deepEqual([s.minMinutes, s.days, s.title, s.enabled], [1, 365, 'subject', false]);
  assert.equal(cal.fingerprint('a'), cal.fingerprint('a')); assert.notEqual(cal.fingerprint('a'), cal.fingerprint('b'));
});
await ok('calendar: the private link is created once, never changed by later saves, rotated and deleted on request', async () => {
  const rows = new Map(); const calls = [];
  const rest = async (path, init = {}) => {
    calls.push(`${init.method ?? 'GET'} ${path.split('?')[0]}`);
    const user = /user_id=eq\.([\w-]+)/.exec(path)?.[1];
    if (!init.method) return { status: 200, body: rows.has(user) ? [{ token: rows.get(user).token }] : [] };
    const body = init.body ? JSON.parse(init.body) : {};
    if (init.method === 'POST') { rows.set(body.user_id, body); return { status: 201, body: null }; }
    if (init.method === 'PATCH') { rows.set(user, { ...rows.get(user), ...body }); return { status: 204, body: null }; }
    if (init.method === 'DELETE') { rows.delete(user); return { status: 204, body: null }; }
    return { status: 500, body: null };
  };
  let n = 0; const deps = { rest, userId: 'u-1', newToken: () => String(++n).padStart(32, 'a') };
  const a = await cal.pushFeed('ICS1', deps); assert.deepEqual([a.ok, a.created, a.token], [true, true, 'a'.repeat(31) + '1']);
  const b = await cal.pushFeed('ICS2', deps, 'f'.repeat(32)); assert.deepEqual([b.created, b.token], [false, a.token], 'a second device adopts the existing link'); assert.equal(rows.get('u-1').ics, 'ICS2');
  const r = await cal.rotateFeed('ICS3', deps); assert.notEqual(r.token, a.token); assert.equal(rows.get('u-1').token, r.token);
  assert.equal((await cal.readFeedToken(deps)).token, r.token);
  assert.equal((await cal.removeFeed(deps)).ok, true); assert.equal(rows.size, 0); assert.equal((await cal.readFeedToken(deps)).token, null);
  const missing = await cal.pushFeed('x', { ...deps, rest: async () => ({ status: 404, body: { message: 'relation "public.calendar_feeds" does not exist' } }) });
  assert.equal(missing.ok, false); assert.equal(missing.missing, true); assert.match(missing.message, /calendar\.sql/);
  assert.ok(calls.includes('PATCH /rest/v1/calendar_feeds'));
});
await ok('calendar: link helpers, and the database and function only ever hand out one calendar for one exact token', () => {
  const u = cal.feedUrl('https://abc.supabase.co/', 'a'.repeat(32)); assert.equal(u, `https://abc.supabase.co/functions/v1/calendar-feed?t=${'a'.repeat(32)}`);
  assert.ok(cal.webcalUrl(u).startsWith('webcal://abc.supabase.co/')); assert.ok(cal.googleAddUrl(u).startsWith('https://calendar.google.com/calendar/u/0/r?cid=webcal%3A%2F%2Fabc.supabase.co'));
  assert.equal(cal.validToken('A'.repeat(32)), false); assert.equal(cal.validToken('a'.repeat(31)), false); assert.equal(cal.validToken('a'.repeat(48)), true);
  const sql = fs.readFileSync(`${root}supabase/calendar.sql`, 'utf8');
  for (const need of ['enable row level security', 'auth.uid() = user_id', 'revoke all on public.calendar_feeds from anon', 'security definer', 'set search_path = public', "token ~ '^[a-f0-9]{32,64}$'", 'revoke all on function']) assert.ok(sql.includes(need), need);
  assert.ok(!/grant (select|insert|update|delete)[^;]*to anon/.test(sql), 'anonymous visitors get no table access');
  const fn = fs.readFileSync(`${root}supabase/functions/calendar-feed/index.ts`, 'utf8');
  assert.ok(fn.includes('[a-f0-9]{32,64}') && fn.includes('calendar_feed_get') && fn.includes('text/calendar') && !/SERVICE_ROLE/i.test(fn), 'validates the token, no service key');
  assert.ok(fs.readFileSync(`${root}src/components/SettingsPanel.tsx`, 'utf8').includes("id: 'calendar', label: 'Calendar'"));
});

// ------------------------------------------------------------------ ai: catalog, agent loop and tools
const fapi = await loadModule(src('flowApi'));
const flowLib = await loadModule(src('flow'));
await ok('ai: provider catalog is complete, honest and ordered by cost', () => {
  const ids = fapi.PROVIDERS.map((p) => p.id);
  for (const id of ['cloud', 'groq', 'gemini', 'openrouter', 'mistral', 'github', 'ollama', 'openai', 'anthropic', 'custom']) assert.ok(ids.includes(id), id);
  for (const p of fapi.PROVIDERS) {
    assert.ok(['service', 'tier', 'local', 'paid'].includes(p.cost), p.id); assert.ok(p.freeNote.length > 10, p.id); assert.ok(p.steps.length >= 1, p.id);
    if (p.needsKey) assert.ok(p.keyUrl?.startsWith('https://'), `${p.id} has a sign-up link`);
    if (p.baseUrl) assert.ok(p.baseUrl.startsWith('https://') || p.baseUrl.startsWith('http://localhost'), p.id);
  }
  const free = fapi.PROVIDERS.filter((p) => p.cost === 'tier' && p.chat).map((p) => p.id);
  assert.ok(free.length >= 4, 'at least four free chat options'); assert.ok(fapi.PROVIDERS.find((p) => p.id === 'ollama').cost === 'local');
  assert.equal(fapi.PROVIDERS.find((p) => p.id === 'cloud').chat, undefined, 'the shared helper is dictation only');
  assert.match(fapi.PROVIDERS_CHECKED, /2026/);
});
await ok('ai: shared helper is dictation only, 5 a day, and chat never goes there', () => {
  assert.equal(flowLib.defaultFlow.cloudLimit, 5); assert.equal(flowLib.defaultFlow.chatProvider, 'off'); assert.equal(flowLib.defaultFlow.dailyLimit, 200);
  assert.equal(flowLib.sanitizeFlow({ chatProvider: 'cloud' }).chatProvider, 'off'); assert.equal(flowLib.sanitizeFlow({ sttProvider: 'cloud' }).sttProvider, 'cloud');
  assert.throws(() => fapi.resolve('chat', { ...flowLib.defaultFlow, chatProvider: 'cloud' }, {}, { url: 'https://x.supabase.co', key: 'k' }), (e) => e.code === 'no-provider');
  assert.equal(fapi.resolve('chat', { ...flowLib.defaultFlow, chatProvider: 'ollama' }, {}).url, 'http://localhost:11434/v1/chat/completions');
  assert.equal(fapi.resolve('chat', { ...flowLib.defaultFlow, chatProvider: 'github' }, { github: 'tok' }).headers.authorization, 'Bearer tok');
  const fn = fs.readFileSync(`${root}supabase/functions/flow-assist/index.ts`, 'utf8');
  assert.ok(fn.includes("action === 'chat'") && fn.includes('403') && fn.includes("?? 5)"), 'the edge function refuses chat and defaults to 5 a day');
});
const bytesOf = (text) => new TextEncoder().encode(text).buffer;
const answer = (status, body) => ({ status, headers: {}, body: bytesOf(typeof body === 'string' ? body : JSON.stringify(body)) });
const mem = () => { let v = null; return { get: () => v, set: (x) => { v = x; } }; };
await ok('ai: chatWithTools sends tools, reads tool calls, explains a model without tool support', async () => {
  const seen = [];
  const fetcher = async (r) => { seen.push(r); return answer(200, { choices: [{ message: { content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_app_state', arguments: '{}' } }, { function: { name: '', arguments: '{}' } }] } }] }); };
  const settings = { ...flowLib.defaultFlow, chatProvider: 'groq' };
  const deps = { fetcher, usage: mem(), device: 'dev-1234567890abcdef' };
  const r = await fapi.chatWithTools([{ role: 'user', content: 'hi' }], [{ name: 'get_app_state', description: 'd', parameters: { type: 'object', properties: {} } }], settings, { groq: 'gk' }, deps);
  assert.equal(r.tool_calls.length, 1); assert.equal(r.tool_calls[0].function.name, 'get_app_state');
  const body = JSON.parse(seen[0].body); assert.equal(body.tools[0].function.name, 'get_app_state'); assert.equal(body.tool_choice, 'auto'); assert.equal(body.model, 'openai/gpt-oss-20b');
  const noTools = async () => answer(400, { error: { message: 'This model does not support tools' } });
  await assert.rejects(() => fapi.chatWithTools([], [{ name: 'x', description: 'd', parameters: {} }], settings, { groq: 'gk' }, { ...deps, fetcher: noTools }), (e) => /does not support tools/.test(e.message));
  await assert.rejects(() => fapi.chatWithTools([], [], { ...flowLib.defaultFlow, chatProvider: 'cloud' }, {}, deps), (e) => e.code === 'no-provider');
});
await ok('ai: model list and test request use the chosen service, never another one\'s model name', async () => {
  const seen = [];
  const fetcher = async (r) => { seen.push(r); return r.method === 'GET' ? answer(200, { data: [{ id: 'models/gemini-2.5-flash' }, { id: 'b-model' }] }) : answer(200, { choices: [{ message: { content: 'OK' } }] }); };
  const deps = { fetcher, usage: mem(), device: 'dev-1234567890abcdef' };
  const settings = { ...flowLib.defaultFlow, chatProvider: 'groq', chatModel: 'groq-only-model' };
  assert.deepEqual(await fapi.listModels('gemini', settings, { gemini: 'k' }, deps), ['b-model', 'gemini-2.5-flash']);
  assert.equal(seen[0].url, 'https://generativelanguage.googleapis.com/v1beta/openai/models');
  assert.equal(await fapi.testChat('gemini', settings, { gemini: 'k' }, deps), 'OK');
  assert.equal(JSON.parse(seen[1].body).model, 'gemini-2.5-flash', 'groq model name not leaked');
  await assert.rejects(() => fapi.testChat('mistral', settings, {}, deps), (e) => e.code === 'no-key');
});

const agent = await loadModule(src('agent'));
const mkTool = (over = {}) => ({ name: 'echo', group: 'read', write: false, description: 'd', parameters: { type: 'object', properties: { text: { type: 'string', maxLength: 10 }, n: { type: 'integer', minimum: 1, maximum: 5 } }, required: ['text'] }, summary: (a) => `Echo ${a.text}`, run: (a) => ({ said: a.text }), ...over });
const call = (name, args, id = 'c') => ({ id, type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } });
const scripted = (replies) => { let i = 0; const seenMessages = []; return { seenMessages, chat: async (m) => { seenMessages.push(m); return replies[Math.min(i++, replies.length - 1)]; } }; };
const base = (extra) => ({ tools: [mkTool()], allowed: () => true, confirmMode: 'off', confirm: async () => true, system: 'sys', ...extra });
await ok('ai: argument checking refuses extras, wrong types and out-of-range values', () => {
  const t = mkTool();
  assert.equal(agent.validateArgs(t.parameters, { text: 'hi' }), ''); assert.match(agent.validateArgs(t.parameters, {}), /required/);
  assert.match(agent.validateArgs(t.parameters, { text: 'hi', extra: 1 }), /not an allowed/); assert.match(agent.validateArgs(t.parameters, { text: 5 }), /text/);
  assert.match(agent.validateArgs(t.parameters, { text: 'x'.repeat(11) }), /too long/); assert.match(agent.validateArgs(t.parameters, { text: 'a', n: 9 }), /at most 5/);
  assert.match(agent.validateArgs(t.parameters, { text: 'a', n: 1.5 }), /whole/); assert.match(agent.validateArgs(t.parameters, []), /object/);
});
await ok('ai: the loop calls tools, feeds results back and ends with the reply', async () => {
  const s = scripted([{ content: '', tool_calls: [call('echo', { text: 'hi' }, 'c1')] }, { content: 'All done.', tool_calls: [] }]);
  const logged = []; const out = await agent.runAgent([], 'please', base({ chat: s.chat, onStep: (x) => logged.push(x) }));
  assert.equal(out.reply, 'All done.'); assert.equal(out.stopped, 'done'); assert.equal(out.steps.length, 1); assert.equal(out.steps[0].ok, true); assert.equal(logged.length, 1);
  const second = s.seenMessages[1]; const tool = second.find((m) => m.role === 'tool');
  assert.equal(tool.tool_call_id, 'c1'); assert.equal(tool.name, 'echo'); assert.match(tool.content, /hi/); assert.equal(second[0].role, 'system');
});
await ok('ai: errors go back to the model; unknown, bad JSON and switched-off tools never run', async () => {
  let ran = 0;
  const tools = [mkTool({ run: () => { ran += 1; throw new Error('boom'); } }), mkTool({ name: 'secret', group: 'settings', write: true, run: () => { ran += 100; } })];
  const s = scripted([{ content: '', tool_calls: [call('echo', { text: 'a' }, '1'), call('nope', {}, '2'), call('echo', '{not json', '3'), call('echo', { text: 'a', bad: 1 }, '4'), call('secret', { text: 'a' }, '5')] }, { content: 'ok', tool_calls: [] }]);
  const out = await agent.runAgent([], 'x', base({ tools, chat: s.chat, allowed: (t) => t.group === 'read' }));
  assert.equal(ran, 1, 'only the allowed tool ran, once'); assert.deepEqual(out.steps.map((x) => x.ok), [false, false, false, false, false]);
  assert.match(out.steps[0].result, /boom/); assert.match(out.steps[2].result, /JSON/); assert.match(out.steps[3].result, /not an allowed/); assert.match(out.steps[4].result, /unknown|switched off/);
});
await ok('ai: confirmation modes ask for changes or everything, and a decline stops the action', async () => {
  let ran = 0; const asked = [];
  const tools = [mkTool({ name: 'read1', run: () => { ran += 1; return {}; } }), mkTool({ name: 'write1', group: 'todos', write: true, run: () => { ran += 10; return {}; } })];
  const run = (mode, answerYes) => agent.runAgent([], 'x', base({ tools, confirmMode: mode, confirm: async (c) => { asked.push(c.name); return answerYes; }, chat: scripted([{ content: '', tool_calls: [call('read1', { text: 'a' }, '1'), call('write1', { text: 'a' }, '2')] }, { content: 'k', tool_calls: [] }]).chat }));
  await run('off', false); assert.deepEqual(asked, []); assert.equal(ran, 11);
  ran = 0; await run('changes', true); assert.deepEqual(asked, ['write1']); assert.equal(ran, 11);
  ran = 0; asked.length = 0; await run('all', true); assert.deepEqual(asked, ['read1', 'write1']);
  ran = 0; asked.length = 0; const out = await run('changes', false); assert.equal(ran, 1, 'declined change did not run'); assert.equal(out.steps[1].denied, true);
});
await ok('ai: it stops after six rounds, reports chat errors and trims history', async () => {
  const forever = scripted([{ content: '', tool_calls: [call('echo', { text: 'a' })] }]);
  const out = await agent.runAgent([], 'x', base({ chat: forever.chat })); assert.equal(out.stopped, 'rounds'); assert.equal(forever.seenMessages.length, agent.MAX_ROUNDS); assert.equal(out.steps.length, agent.MAX_ROUNDS);
  const err = await agent.runAgent([], 'x', base({ chat: async () => { throw new Error('no network'); } })); assert.equal(err.stopped, 'error'); assert.equal(err.error, 'no network');
  const long = Array.from({ length: 60 }, (_, i) => ({ role: 'user', content: `m${i}` })); const s = scripted([{ content: 'k', tool_calls: [] }]);
  await agent.runAgent(long, 'last', base({ chat: s.chat })); assert.ok(s.seenMessages[0].length <= agent.MAX_HISTORY + 2);
  const big = await agent.runAgent([], 'x', base({ tools: [mkTool({ run: () => ({ blob: 'z'.repeat(20000) }) })], chat: scripted([{ content: '', tool_calls: [call('echo', { text: 'a' })] }, { content: 'k', tool_calls: [] }]).chat }));
  assert.ok(big.messages.find((m) => m.role === 'tool').content.length < 4100, 'long results are shortened');
});
await ok('ai: assistant settings are sanitized and every group can be switched off', () => {
  const d = agent.sanitizeAgent(undefined); assert.equal(d.enabled, true); assert.equal(d.confirm, 'off'); assert.ok(Object.values(d.groups).every(Boolean));
  const c = agent.sanitizeAgent({ enabled: false, confirm: 'all', groups: { settings: false, bogus: false, todos: 'no' }, showSteps: 4 });
  assert.equal(c.enabled, false); assert.equal(c.confirm, 'all'); assert.equal(c.groups.settings, false); assert.equal(c.groups.todos, true); assert.ok(!('bogus' in c.groups)); assert.equal(c.showSteps, true);
  assert.equal(agent.sanitizeAgent({ confirm: 'weird' }).confirm, 'off');
  const allowed = agent.toolAllowed({ ...d, groups: { ...d.groups, settings: false } });
  assert.equal(allowed({ group: 'settings' }), false); assert.equal(allowed({ group: 'read' }), true); assert.equal(allowed({ group: 'todos' }), true);
  assert.equal(agent.GROUPS.length, Object.keys(d.groups).length);
});
globalThis.localStorage ??= (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() }; })();
const tools = await loadModule(src('agentTools'));
const prefsLib = await loadModule(src('prefs'));
await ok('ai: settings the assistant may touch are checked by name, type and the normal cleaning, secrets are out of reach', () => {
  const prefs = prefsLib.defaultPrefs; const timer = { focusMin: 25 };
  const view = tools.settingsView(prefs, { focusMin: 25, shortMin: 5 });
  assert.equal(view['timer.focusMin'], 25); assert.ok(Object.keys(view).length > 60, 'a lot of settings are reachable'); assert.ok('uiShow.hdrAssistant' in view);
  for (const blocked of tools.BLOCKED_PATHS) assert.ok(!(blocked in view), `${blocked} is hidden`);
  assert.ok(!Object.keys(view).some((k) => /token|password|secret|apikey/i.test(k)), 'nothing secret-looking is listed');
  let wrote = null; const write = { prefs: (p) => { wrote = p; }, timer: () => {} };
  const apply = (path, value) => tools.applySetting(path, value, prefs, { focusMin: 25, shortMin: 5 }, write);
  assert.equal(apply('drift.token', 'x').ok, false); assert.equal(apply('flow.customUrl', 'http://evil').ok, false); assert.equal(apply('agent.confirm', 'off').ok, false, 'it cannot loosen its own confirmation');
  assert.equal(apply('nope.nothing', 1).ok, false); assert.match(apply('calm.windMinutes', 'text').message, /number/);
  const r = apply('calm.windMinutes', 9999); assert.equal(r.ok, true); assert.equal(r.clamped, true); assert.ok(r.applied <= 240); assert.ok(wrote.calm.windMinutes <= 240);
  const t = tools.applySetting('timer.focusMin', 0, prefs, { focusMin: 25 }, { prefs: () => {}, timer: (p) => { wrote = p; } }); assert.equal(t.ok, true); assert.ok(wrote.focusMin >= 1 || t.applied >= 1);
  const u = apply('uiShow.hdrAssistant', true); assert.equal(u.ok, true); assert.equal(wrote.uiLevel, 'custom');
  assert.equal(tools.coerce('true', false), true); assert.equal(tools.coerce('off', true), false); assert.equal(tools.coerce('45', 1), 45); assert.equal(tools.coerce('4,5', 1), 4.5); assert.equal(tools.coerce('abc', 1), 'abc'); assert.equal(tools.coerce('maybe', true), 'maybe');
});
await ok('ai: every tool is well formed, named once, and reading tools never change anything', () => {
  const rt = { execute: () => {}, desktop: true, timer: { running: false, phase: 'focus', mode: 'pomodoro', seconds: 1500, task: '', settings: { focusMin: 25 }, setSettings: () => {} }, sound: { playing: false, volume: .5 }, mixNames: () => ['Flow'], macros: () => [], setMacros: () => {} };
  const list = tools.buildTools(rt); const names = list.map((t) => t.name);
  assert.equal(new Set(names).size, names.length); assert.ok(names.length >= 18);
  for (const t of list) { assert.match(t.name, /^[a-z_]+$/); assert.equal(t.parameters.type, 'object'); assert.ok(t.description.length > 10); assert.equal(typeof t.summary({}), 'string'); if (t.group === 'read') assert.equal(t.write, false); else assert.equal(t.write, true, t.name); }
  for (const must of ['get_app_state', 'describe_options', 'run_command', 'list_settings', 'set_setting', 'add_todo', 'update_todo', 'delete_todo', 'set_plan', 'add_subject', 'set_exam', 'create_automation', 'create_macro']) assert.ok(names.includes(must), must);
  const ran = []; const rt2 = { ...rt, execute: (c) => ran.push(c) }; const run = list.find((t) => t.name === 'run_command').run;
  const rc = tools.buildTools(rt2).find((t) => t.name === 'run_command');
  assert.deepEqual(rc.run({ command: 'volume.set:150' }), { ran: 'volume.set:100' }); assert.throws(() => rc.run({ command: 'app.quit' }), /not allowed/); assert.throws(() => rc.run({ command: 'mix.load:Nope' }), /not allowed/);
  assert.deepEqual(ran, ['volume.set:100']); assert.ok(typeof run === 'function');
});

await ok('setup: nothing opens by itself after setup or an update', () => {
  const html = fs.readFileSync(`${root}electron/setup/index.html`, 'utf8'); const js = fs.readFileSync(`${root}electron/setup/setup.js`, 'utf8'); const main = fs.readFileSync(`${root}electron/installer.cjs`, 'utf8');
  assert.ok(!html.includes('o-launch') && !html.includes('Open it when setup finishes'));
  assert.ok(!/setTimeout\(\(\) => \{ void api\.finish\(true\)/.test(js), 'no timed auto-open after an update'); assert.ok(!main.includes('launchInstalled(), 900'), 'no launch right after copying files');
  assert.ok(js.includes("launch: false") && html.includes('id="d-open"') && html.includes('id="d-close"'));
});
// ------------------------------------------------------------------ tour, reasons, neural lock
const tour = await loadModule(src('tutorial'));
const neural = await loadModule(src('neural'));
const reasons = await loadModule(src('reasons'));
const routerLib = await loadModule(src('router'));
const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
await ok('tour: opens once per tour version, can be skipped for good, never when switched off', () => {
  assert.equal(tour.shouldAutoOpen(null, false), true); assert.equal(tour.shouldAutoOpen(null, true), false);
  const st = store(); assert.equal(tour.readTour(st), null);
  tour.writeTour({ done: true, skipped: false }, st); const seen = tour.readTour(st); assert.equal(seen.done, true); assert.equal(seen.version, tour.TOUR_VERSION);
  assert.equal(tour.shouldAutoOpen(seen, false), false, 'not again after it was seen');
  assert.equal(tour.shouldAutoOpen({ version: 1, done: true, skipped: false, at: '' }, false), true, 'a new tour version shows once more');
  tour.writeTour({ done: false, skipped: true }, st); assert.equal(tour.shouldAutoOpen(tour.readTour(st), false), false, 'skipping is remembered');
  assert.equal(tour.readTour(store({ 'study-with-sarang:tutorial': 'nonsense' })), null);
  assert.equal(tour.isReturning(store()), false); assert.equal(tour.isReturning(store({ 'study-with-sarang:sessions': '[]', 'study-with-sarang:prefs': '{}' })), false, 'default files written at start do not count'); assert.equal(tour.isReturning(store({ 'study-with-sarang:sessions': '[{"id":"a"}]' })), true);
  const ui = fs.readFileSync(`${root}src/components/Tutorial.tsx`, 'utf8');
  for (const id of ['welcome', 'subjects', 'sound', 'plan', 'progress', 'focus', 'desktop', 'ai', 'done']) assert.ok(ui.includes(`id: '${id}'`), id);
  assert.ok(ui.includes('SubjectsTab') && ui.includes('openAiGuide'), 'the tour asks for subjects and offers the AI walkthrough');
  assert.ok(fs.readFileSync(`${root}electron/app.cjs`, 'utf8').includes("SWA_NO_TOUR"), 'tests can switch the tour off');
});
await ok('neural lock: off by default, limited, cleaned, and wired into the sound chain', () => {
  assert.equal(neural.defaultNeural.on, false); assert.equal(neural.defaultNeural.rate, 16);
  assert.deepEqual(neural.sanitizeNeural({ on: 'yes', rate: 999, depth: -5 }), { on: false, rate: 40, depth: 5 });
  assert.deepEqual(neural.sanitizeNeural({ on: true, rate: 8.4, depth: 35 }), { on: true, rate: 8, depth: 35 }); assert.deepEqual(neural.sanitizeNeural(null), neural.defaultNeural);
  for (const p of neural.NEURAL_PRESETS) { assert.ok(p.rate >= 4 && p.rate <= 40 && p.depth >= 5 && p.depth <= 60, p.id); }
  assert.ok(neural.NEURAL_PRESETS.some((p) => p.rate === 16), 'the 16 Hz rate from the research is a preset');
  const synth = fs.readFileSync(`${root}src/lib/synth.ts`, 'utf8'); assert.ok(synth.includes('this.breathe.connect(this.pulse).connect(this.duck)') && synth.includes('setPulse(') && synth.includes('depth: number, tc'), 'the pulse sits in the chain with depth 0 meaning no change');
  const sound = fs.readFileSync(`${root}src/context/SoundContext.tsx`, 'utf8'); assert.ok(sound.includes('prefs.neural.on ? prefs.neural.depth / 100 : 0'));
  const nl = fs.readFileSync(`${root}src/components/NeuralLock.tsx`, 'utf8'); assert.ok(/not a treatment/i.test(nl) && /Woods|2024/.test(nl) && /epilepsy/.test(nl), 'honest about what it is not');
  assert.equal(prefsLib.sanitizePrefs({ neural: { on: true, rate: 3, depth: 99 } }).neural.rate, 4);
});
await ok('reasons: three appeals, Socratic questions that end in an action, own reason is cleaned, pages are routable', () => {
  assert.deepEqual(reasons.APPEALS.map((a) => a.id), ['ethos', 'logos', 'pathos']); assert.ok(reasons.QUESTIONS.length >= 5);
  for (const q of reasons.QUESTIONS) { assert.ok(q.ask.endsWith('?') && q.why.length > 20, q.id); assert.ok(!/[\u2014\u2013]/.test(q.ask + q.why + q.starter), 'no dashes in text'); }
  assert.notEqual(reasons.questionFor(new Date(2026, 9, 7)).id, reasons.questionFor(new Date(2026, 9, 8)).id, 'a different question each day');
  assert.equal(routerLib.parseHash('#neural').page, 'focus'); assert.equal(routerLib.parseHash('#reasons').page, 'focus'); assert.equal(routerLib.parseHash('#neural').anchor, 'neural');
  const ui = fs.readFileSync(`${root}src/components/FocusReasons.tsx`, 'utf8'); assert.ok(ui.includes('setPlan({ goal') && ui.includes("run('timer.start')") && ui.includes('Locke') && ui.includes('Gollwitzer'));
  const app = fs.readFileSync(`${root}src/App.tsx`, 'utf8'); assert.ok(app.includes('<FocusReasons />') && app.includes('<NeuralLock />') && app.includes('f.neuralLock'));
});

console.log(`v2.0 tests passed: ${n} groups`);
