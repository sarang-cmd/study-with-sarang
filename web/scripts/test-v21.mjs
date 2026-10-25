// 2.1 tests: Siri-like understanding, system media control, session flow data, reviews, voice helpers.
import assert from 'node:assert/strict';
import { loadModule } from './_load.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, localStorage: globalThis.localStorage };

const src = (name) => new URL(`../src/lib/${name}.ts`, import.meta.url).pathname;
const intent = await loadModule(src('intent'));
const more = await loadModule(src('intentMore'));
const session = await loadModule(src('session'));
const reviews = await loadModule(src('reviews'));
const api = await loadModule(src('flowApi'));
const speech = await loadModule(src('flowSpeech'));
let n = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n += 1; }, (error) => { console.error(`FAIL ${name}`); throw error; });

const ctx = { mixNames: ['Flow', 'Rainy window'], macroNames: [], todoNames: ['Hand in lab report', 'Read chapter 4'], subjectNames: ['Physics'] };
const cmd = (text) => intent.parseIntent(text, ctx)?.command ?? null;

await ok('other players', () => {
  assert.equal(cmd('Flow, pause my music'), 'music.pause');
  assert.equal(cmd('hey flow could you pause my music please'), 'music.pause');
  assert.equal(cmd('Flow stop the video'), 'music.pause');
  assert.equal(cmd('flow pause spotify'), 'music.pause');
  assert.equal(cmd('Flow, resume my music'), 'music.play');
  assert.equal(cmd('play my music'), 'music.play');
  assert.equal(cmd('flow next song'), 'music.next');
  assert.equal(cmd('flow skip this song'), 'music.next');
  assert.equal(cmd('flow previous track'), 'music.prev');
  assert.equal(cmd('flow what is playing'), 'info:playing');
  assert.equal(cmd('flow whats this song'), 'info:playing');
  // The app's own sound still works as before.
  assert.equal(cmd('flow pause the music'), 'sound.pause');
  assert.equal(cmd('flow next'), 'sound.next');
  assert.equal(cmd('flow play'), 'sound.play');
});
await ok('computer volume', () => {
  assert.equal(cmd('flow computer volume down'), 'system.volume:down:5');
  assert.equal(cmd('flow turn the computer volume up a bit'), 'system.volume:up:2');
  assert.equal(cmd('flow mute the computer'), 'system.volume:mute');
  assert.equal(cmd('flow volume 40'), 'volume.set:40');
});
await ok('minutes', () => {
  const h = { parseNumber: intent.parseNumber, bestName: intent.bestName };
  const m = (t) => more.parseMinutes(t, h);
  assert.equal(m('45 minutes'), 45); assert.equal(m('an hour'), 60); assert.equal(m('half an hour'), 30); assert.equal(m('1.5 hours'), 90);
  assert.equal(m('twenty five minutes'), 25); assert.equal(m('two hours'), 120); assert.equal(m('an hour and a half'), 90); assert.equal(m('zero minutes'), null); assert.equal(m('banana minutes'), null);
});
await ok('timer phrases', () => {
  assert.equal(cmd('flow study for 45 minutes'), 'timer.session:45');
  assert.equal(cmd('flow focus for an hour on chemistry'), 'timer.session:60;Chemistry');
  assert.equal(cmd('flow start a 25 minute focus session on optics'), 'timer.session:25;Optics');
  assert.equal(cmd('flow study physics for 30 minutes'), 'timer.session:30;Physics');
  assert.equal(cmd('flow set a timer for 10 minutes'), 'timer.countdown:10');
  assert.equal(cmd('flow 5 minute timer'), 'timer.countdown:5');
  assert.equal(cmd('flow start studying optics'), 'goal.start:Optics');
  assert.equal(cmd('flow take a break'), 'break.start');
  assert.equal(cmd('flow back to work'), 'break.end');
  assert.equal(cmd('flow how much time is left'), 'timer.left');
  assert.equal(cmd('flow i am done'), 'timer.finish');
  assert.equal(cmd('sleep timer 20 minutes').startsWith('calm.wind'), true);
});
await ok('goals and todos', () => {
  assert.equal(cmd('flow set my goal to finish chapter three'), 'goal.set:Finish chapter three');
  assert.equal(cmd('flow my goal is revise optics'), 'goal.set:Revise optics');
  assert.equal(cmd('flow clear my goal'), 'goal.clear');
  assert.equal(cmd('flow add a to-do hand in the lab report'), 'todo.add:Hand in the lab report');
  assert.equal(cmd('flow add buy graph paper to my to-do list'), 'todo.add:Buy graph paper');
  assert.equal(cmd('flow remind me to email the teacher'), 'todo.add:Email the teacher');
  assert.equal(cmd('flow remind me to review optics'), 'review.add:Optics');
  assert.equal(cmd('flow tick off lab report'), 'todo.done:Hand in lab report');
  assert.equal(cmd('flow what is on my to-do list'), 'info:todos');
  assert.equal(cmd('flow what is my goal'), 'info:goal');
});
await ok('questions and navigation', () => {
  assert.equal(cmd('flow what time is it'), 'info:time');
  assert.equal(cmd('flow how long did i study today'), 'info:today');
  assert.equal(cmd('flow what is my streak'), 'info:streak');
  assert.equal(cmd('flow when is my exam'), 'info:exam');
  assert.equal(cmd('flow open progress'), 'page.go:progress');
  assert.equal(cmd('flow go to the library'), 'page.go:library');
  assert.equal(cmd('flow dark mode'), 'theme.set:dark');
  assert.equal(cmd('flow open notifications'), 'bell.open');
  assert.equal(cmd('flow what can i say'), 'help.open');
  assert.equal(cmd('flow what is the capital of france'), null);
  assert.equal(cmd('flow open settings'), 'settings.open');
});
await ok('every example sentence is understood', () => {
  const all = [];
  for (const g of more.SIRI_EXAMPLES) for (const line of g.say) all.push(cmd(line));
  assert.ok(all.every(Boolean), `each example is understood: ${more.SIRI_EXAMPLES.flatMap((g) => g.say).filter((t, i) => !all[i]).join(' | ')}`);
});
await ok('session settings', () => {
  const s = session.sanitizeSession({ askStart: 'nope', reviewDays: [1, 3, 999, 'x'] });
  assert.equal(typeof s.askStart, 'boolean'); assert.ok(s.reviewDays.every((d) => d >= 1 && d <= 90));
  const idea = session.pickBreakIdea(5, '', () => 0.1);
  assert.ok(idea.title && idea.how); assert.ok(!idea.long);
  assert.ok(session.pickBreakIdea(20, '', () => 0.5).seconds >= 0);
  assert.notEqual(session.pickBreakIdea(5, idea.id, () => 0.1).id, idea.id, 'it avoids repeating the last idea');
  assert.ok(session.TECHNIQUES.every((t) => t.label && t.why));
  assert.ok(session.LENGTH_PRESETS.some((p) => p.focusMin === 52 && p.shortMin === 17));
  assert.match(session.BREAK_REMINDER, /scrolling/);
});
await ok('reviews', () => {
  reviews.resetReviewsForTest();
  const now = new Date(2026, 9, 16, 10);
  assert.equal(reviews.scheduleReviews('Optics', 'physics', [1, 3, 7], now), 3);
  assert.equal(reviews.dueReviews('2026-10-16').length, 0);
  assert.equal(reviews.dueReviews('2026-10-17').length, 1);
  assert.equal(reviews.dueReviews('2026-10-20').length, 2);
  assert.equal(reviews.upcomingReviews('2026-10-17').length, 2);
  reviews.completeReview(reviews.dueReviews('2026-10-17')[0].id);
  assert.equal(reviews.dueReviews('2026-10-17').length, 0);
  assert.equal(reviews.sanitizeReviews([{ id: 1 }, null, 'x', { id: 'a', text: 'T', due: '2026-10-17', created: '2026-10-16', done: false, step: 1, subject: '' }]).length, 1);
  assert.equal(reviews.scheduleReviews('', '', [1], now), 0, 'empty topics are not scheduled');
  reviews.resetReviewsForTest();
});
await ok('voice helpers', () => {
  const parts = api.splitForVoice('One short sentence. ' + 'Another sentence that goes on a while and on. '.repeat(12), 190);
  assert.ok(parts.length > 1 && parts.every((p) => p.length <= 190), 'chunks stay under the Groq limit');
  const wav = new Uint8Array(api.pcmToWav(new Uint8Array(480), 24000));
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), 'RIFF'); assert.equal(String.fromCharCode(...wav.slice(8, 12)), 'WAVE'); assert.equal(wav.length, 44 + 480);
  const joined = new Uint8Array(api.joinWav([api.pcmToWav(new Uint8Array(100), 24000), api.pcmToWav(new Uint8Array(60), 24000)]));
  assert.equal(joined.length, 44 + 160);
  const v = (name, lang) => ({ name, lang, localService: true, default: false });
  const list = [v('Microsoft Hedda', 'de-DE'), v('Microsoft Zira', 'en-US'), v('Microsoft Aria Online (Natural)', 'en-US')];
  assert.equal(speech.pickVoice(list, 'de', '').name, 'Microsoft Hedda');
  assert.equal(speech.pickVoice(list, 'en', 'Microsoft Zira').name, 'Microsoft Zira');
  assert.equal(speech.looksGerman('Wie spät ist es'), true); assert.equal(speech.looksGerman('what time is it'), false);
});

await ok('assistant command validation', () => {
  const c = { mixNames: [], macroNames: [] };
  assert.equal(api.validateCommand('music.pause', c), 'music.pause');
  assert.equal(api.validateCommand('timer.session:45;Optics', c), 'timer.session:45;Optics');
  assert.equal(api.validateCommand('timer.countdown:abc', c), null);
  assert.equal(api.validateCommand('page.go:progress', c), 'page.go:progress');
  assert.equal(api.validateCommand('page.go:../x', c), null);
  assert.equal(api.validateCommand('system.volume:up:3', c), 'system.volume:up:3');
  assert.equal(api.validateCommand('app.quit', c), null);
});
await ok('answers', async () => {
  const answers = await loadModule(src('answers'));
  const now = new Date(2026, 9, 16, 15, 30);
  const mk = (h, secs) => ({ id: String(h), startedAt: new Date(2026, 9, 16, h, 0).toISOString(), seconds: secs, mode: 'pomodoro', task: '', completed: true, distractions: 0, tabAways: 0, mixName: '', subject: '', goal: '', goalMet: '', todosDone: 0 });
  const d = { now, sessions: [mk(9, 1500), mk(11, 2100)], goal: 'Finish optics', todos: [{ id: '1', text: 'Lab report', done: false }, { id: '2', text: 'Old', done: true }], examDays: 45, timer: { mode: 'pomodoro', phase: 'focus', running: true, seconds: 754 } };
  assert.match(answers.answerInfo('today', d), /60 minutes|1 hour/); assert.match(answers.answerInfo('today', d), /2 blocks/);
  assert.match(answers.answerInfo('today', { ...d, sessions: [] }), /No study time/);
  assert.match(answers.answerInfo('goal', d), /Finish optics/);
  assert.match(answers.answerInfo('todos', d), /1 open to-do: Lab report/);
  assert.match(answers.answerInfo('exam', d), /45 days/); assert.match(answers.answerInfo('exam', { ...d, examDays: null }), /No exam date/);
  assert.match(answers.answerInfo('left', d), /13 minutes of this focus block left/);
  assert.match(answers.answerInfo('streak', d), /streak is 1 day/);
  assert.equal(answers.spokenDuration(3900), '1 hour 5 minutes'); assert.equal(answers.spokenDuration(10), 'less than a minute');
});

console.log(`v21 web: ${n} groups passed`);
