// 1.7 tests: Flow (understanding, gesture, voice activity, engine, services), calm math, media seek, Discord options.
import assert from 'node:assert/strict';
import { loadModule } from './_load.mjs';

const src = (name) => new URL(`../src/lib/${name}.ts`, import.meta.url).pathname;
const intent = await loadModule(src('intent'));
const calm = await loadModule(src('calm'));
const flow = await loadModule(src('flow'));
const api = await loadModule(src('flowApi'));
const viz = await loadModule(src('flowViz'));
const media = await loadModule(src('mediaSession'));
const discord = await loadModule(src('discord'));
const engineMod = await loadModule(src('flowEngine'));
const rec = await loadModule(src('recordings'));
let n = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n += 1; }, (error) => { console.error(`FAIL ${name}`); throw error; });

// ------------------------------------------------------------------ intent
const ctx = { mixNames: ['Flow', 'Rainy window', 'Deep focus'], macroNames: ['Start Flow session'] };
const expectIntent = (text, command) => assert.equal(intent.parseIntent(text, ctx)?.command, command, text);
await ok('intent volume', () => {
  for (const [t, c] of [['volume full', 'volume.set:100'], ['Flow volume full', 'volume.set:100'], ['set volume 40', 'volume.set:40'], ['Flow set volume 40', 'volume.set:40'], ['set the volume to forty five', 'volume.set:45'],
    ['volume fifty percent', 'volume.set:50'], ['make it 30 percent', 'volume.set:30'], ['volume half', 'volume.set:50'], ['volume zero', 'volume.set:0'], ['set volume to a hundred', 'volume.set:100'],
    ['turn it up', 'volume.up'], ['quieter please', 'volume.down'], ['lautstärke vierzig', 'volume.set:40'], ['lautstärke voll', 'volume.set:100']]) expectIntent(t, c);
});
await ok('intent controls and names', () => {
  for (const [t, c] of [['pause', 'sound.pause'], ['play', 'sound.play'], ['start the timer', 'timer.start'], ['skip the break', 'timer.skip'], ['zen mode', 'zen.toggle'], ['hey flow pause', 'sound.pause'],
    ['put on rainy window', 'mix.load:Rainy window'], ['run start flow session', 'macro.run:Start Flow session'], ['breathe', 'calm.breathe'], ['simple view', 'ui.simple:on'], ['open settings', 'settings.open']]) expectIntent(t, c);
  assert.equal(intent.parseIntent('banana', ctx), null);
  assert.equal(intent.parseIntent('what is the capital of france', ctx), null);
  assert.equal(intent.parseIntent('', ctx), null);
});
await ok('intent calm', () => {
  assert.match(intent.parseIntent('start the grounding exercise', ctx)?.command ?? '', /^calm\.ground/);
  const wind = intent.parseIntent('sleep timer 20 minutes', ctx)?.command ?? '';
  assert.match(wind, /^calm\.wind:20$/, wind);
});
await ok('number words', () => {
  assert.equal(intent.parseNumber('forty five'), 45); assert.equal(intent.parseNumber('one hundred'), 100); assert.equal(intent.parseNumber('fünfzig'), 50);
  assert.equal(intent.numberWord(40, 'en'), 'forty');
});

// ------------------------------------------------------------------ calm
await ok('breathAt', () => {
  const steps = [4, 4, 4, 4];
  assert.equal(calm.breathAt(steps, 0).phase, 'in'); assert.equal(calm.breathAt(steps, 0).scale, 0);
  assert.equal(calm.breathAt(steps, 4).phase, 'hold'); assert.equal(calm.breathAt(steps, 4).scale, 1);
  assert.equal(calm.breathAt(steps, 8).phase, 'out'); assert.equal(calm.breathAt(steps, 12).phase, 'rest');
  assert.equal(calm.breathAt(steps, 16).cycle, 1);
  assert.ok(Math.abs(calm.breathAt(steps, 2).scale - .5) < 1e-9);
  const s = [4, 0, 8, 0]; assert.equal(calm.breathAt(s, 4).phase, 'out'); // zero-length parts are skipped
  assert.equal(calm.breathAt([0, 0, 0, 0], 5).phase, 'in'); // never divides by zero
  assert.equal(calm.cycleSeconds([4, 7, 8, 0]), 19);
});
await ok('wind down', () => {
  const w = calm.startWindDown(0, 30, 10, true);
  assert.equal(calm.windDownLevel(w, 0), 1); assert.equal(calm.windDownLevel(w, 19 * 60_000), 1);
  const mid = calm.windDownLevel(w, 25 * 60_000); assert.ok(mid > .4 && mid < .6, String(mid));
  assert.equal(calm.windDownLevel(w, 30 * 60_000), 0);
  let last = 1; for (let m = 20; m <= 30; m += .5) { const v = calm.windDownLevel(w, m * 60_000); assert.ok(v <= last + 1e-9); last = v; }
  assert.equal(calm.windDownVeil(w, 0), 0); assert.equal(calm.windDownVeil(w, 31 * 60_000), .85);
  assert.equal(calm.windDownVeil(calm.startWindDown(0, 30, 10, false), 29 * 60_000), 0);
  assert.equal(calm.minutesLeft(w, 29 * 60_000 + 1), 1);
  const short = calm.startWindDown(0, 2, 10, true); assert.equal(short.fadeMs, 120_000); // fade never longer than the timer
});
await ok('calm sanitize', () => {
  const c = calm.sanitizeCalm({ pattern: 'nope', intensity: 999, speed: -4, custom: [1, 2], intention: 'a\u0000b'.repeat(100), cycles: 2.6 });
  assert.equal(c.pattern, 'box'); assert.equal(c.intensity, 100); assert.equal(c.speed, 25); assert.equal(c.custom.length, 4); assert.ok(c.intention.length <= 140 && !/\u0000/.test(c.intention)); assert.equal(c.cycles, 3);
  assert.deepEqual(calm.sanitizeCalm(null), calm.defaultCalm);
});

// ------------------------------------------------------------------ flow: keys, gesture, voice activity
await ok('keys', () => {
  assert.equal(flow.resolveKey('rctrl', []).label, 'Right Ctrl'); assert.deepEqual(flow.resolveKey('rctrl', []).vks, [0xA3]);
  assert.equal(flow.resolveKey('nonsense', []).id, 'rctrl');
  assert.deepEqual(flow.sanitizeCodes(['AltRight', 'F8']), []); assert.deepEqual(flow.sanitizeCodes(['F8', 'F8', 'Bogus']), ['F8']);
  assert.equal(flow.resolveKey('custom', []).id, 'rctrl');
  assert.equal(flow.resolveKey('custom', ['ControlLeft', 'ShiftLeft', 'Space']).accelerator, 'CommandOrControl+Shift+Space');
});
await ok('settings sanitize', () => {
  const f = flow.sanitizeFlow({ mode: 'x', tapMs: 1e9, unsure: 'auto', sttProvider: 'evil', dailyLimit: -3 });
  assert.equal(f.mode, 'both'); assert.ok(f.tapMs < 2000); assert.equal(f.unsure, 'auto'); assert.equal(f.sttProvider, 'cloud'); assert.ok(f.dailyLimit >= 0);
  assert.equal(flow.sanitizeFlow(undefined).keyId, 'rctrl'); assert.equal(flow.sanitizeFlow(undefined).enabled, false);
});
const gesture = (mode = 'both') => { const out = []; const g = new flow.Gesture((a) => out.push(a), { mode, tapMs: 260, doubleMs: 450 }); return { g, out }; };
await ok('gesture hold', () => {
  const { g, out } = gesture(); g.down(0); g.up(1000); assert.deepEqual(out, ['start', 'stop']); assert.equal(g.phase, 'idle');
});
await ok('gesture quick tap is cancelled, not processed', () => {
  const { g, out } = gesture('hold'); g.down(0); g.up(120); assert.deepEqual(out, ['start', 'cancel']);
});
await ok('gesture double tap goes hands-free, then a tap stops', () => {
  const { g, out } = gesture(); g.down(0); g.up(100); g.down(300); assert.deepEqual(out, ['start', 'handsfree']); assert.equal(g.phase, 'handsfree'); g.up(360);
  g.down(5000); assert.equal(out.at(-1), 'stop'); assert.equal(g.phase, 'idle');
});
await ok('gesture single tap expires', () => {
  const { g, out } = gesture(); g.down(0); g.up(100); g.tick(300); assert.equal(g.phase, 'tapwait'); g.tick(1000); assert.deepEqual(out, ['start', 'cancel']); assert.equal(g.phase, 'idle');
});
await ok('gesture late second press starts again', () => {
  const { g, out } = gesture(); g.down(0); g.up(100); g.down(2000); assert.deepEqual(out, ['start', 'cancel', 'start']); assert.equal(g.phase, 'holding');
});
await ok('gesture hands-free only and toggle', () => {
  const a = gesture('handsfree'); a.g.down(0); a.g.up(50); assert.deepEqual(a.out, ['start', 'handsfree']);
  const b = gesture(); b.g.toggle(0); assert.deepEqual(b.out, ['start', 'handsfree']); b.g.toggle(10); assert.equal(b.out.at(-1), 'stop');
});
await ok('vad', () => {
  const v = new flow.Vad({ silenceMs: 1000, maxMs: 20000 });
  assert.equal(v.feed(.0, 1), null); assert.equal(v.feed(.2, 100), 'speech'); assert.equal(v.feed(.2, 200), null);
  assert.equal(v.feed(0, 300), null); assert.equal(v.feed(0, 1200), null); assert.equal(v.feed(0, 1400), 'end'); assert.ok(v.heardSomething());
  const quiet = new flow.Vad({ silenceMs: 1000, maxMs: 20000 }); quiet.feed(.01, 1); assert.equal(quiet.feed(.01, 6000), 'end'); assert.ok(!quiet.heardSomething());
  const long = new flow.Vad({ silenceMs: 1000, maxMs: 2000 }); long.feed(.3, 1); assert.equal(long.feed(.3, 2500), 'limit');
});
await ok('viz', () => {
  const s = viz.smoothBars([0, 1], [1, 0]); assert.ok(s[0] > 0 && s[0] < 1 && s[1] > 0 && s[1] < 1); assert.ok(s[0] - 0 > 1 - s[1], 'rises faster than it falls'); assert.ok(s.length >= 32);
  const idle = viz.idleBars(32, 1234); assert.equal(idle.length, 32); assert.ok(idle.every((x) => x > 0 && x < .3));
});

// ------------------------------------------------------------------ flow: services
const settings = { ...flow.defaultFlow, enabled: true, sttProvider: 'groq', chatProvider: 'groq', ttsEngine: 'system', unsure: 'auto' };
await ok('resolve providers', () => {
  const g = api.resolve('stt', settings, { groq: 'gk' });
  assert.equal(g.url, 'https://api.groq.com/openai/v1/audio/transcriptions'); assert.equal(g.headers.authorization, 'Bearer gk'); assert.equal(g.model, 'whisper-large-v3-turbo');
  assert.throws(() => api.resolve('stt', settings, {}), (e) => e.code === 'no-key');
  assert.throws(() => api.resolve('chat', { ...settings, chatProvider: 'custom', customUrl: 'http://evil.example.com/v1' }, {}), (e) => e.code === 'no-address');
  assert.equal(api.resolve('chat', { ...settings, chatProvider: 'custom', customUrl: 'http://localhost:11434/v1/', chatModel: 'llama3' }, {}).url, 'http://localhost:11434/v1/chat/completions');
  const cloud = api.resolve('stt', { ...settings, sttProvider: 'cloud' }, {}, { url: 'https://p.supabase.co', key: 'pk' });
  assert.throws(() => api.resolve('chat', { ...settings, chatProvider: 'cloud' }, {}, { url: 'https://p.supabase.co', key: 'pk' }), (e) => e.code === 'no-provider'); // the shared helper never does chat
  assert.equal(cloud.url, 'https://p.supabase.co/functions/v1/flow-assist'); assert.equal(cloud.cloud, true); assert.equal(cloud.headers.apikey, 'pk');
  assert.throws(() => api.resolve('stt', { ...settings, sttProvider: 'cloud' }, {}), (e) => e.code === 'no-address');
  assert.throws(() => api.resolve('stt', { ...settings, sttProvider: 'off' }, {}), (e) => e.code === 'no-provider');
});
await ok('validateCommand and parseAsk', () => {
  const c = { mixNames: ['Rainy window'], macroNames: ['Go'] };
  assert.equal(api.validateCommand('volume.set:150', c), 'volume.set:100'); assert.equal(api.validateCommand('mix.load:rainy WINDOW', c), 'mix.load:Rainy window');
  assert.equal(api.validateCommand('mix.load:Nope', c), null); assert.equal(api.validateCommand('app.quit', c), null); assert.equal(api.validateCommand('rm -rf', c), null);
  assert.equal(api.validateCommand('calm.wind:30', c), 'calm.wind:30'); assert.equal(api.validateCommand('calm.wind:abc', c), null); assert.equal(api.validateCommand('calm.scene:fire', c), null);
  const ask = { ...c, playing: true, volume: 50, timerRunning: false, level: 'standard', answers: true, language: 'en' };
  assert.equal(api.parseAsk('```json\n{"command":"zen.toggle"}\n```', ask).command, 'zen.toggle');
  assert.equal(api.parseAsk('{"answer":"**Paris** is the capital."}', ask).text, 'Paris is the capital.');
  assert.equal(api.parseAsk('{"answer":"x"}', { ...ask, answers: false }).type, 'none');
  assert.equal(api.parseAsk('no json', ask).type, 'none'); assert.equal(api.parseAsk('{"command":"app.update"}', ask).type, 'none');
  assert.ok(api.buildSystemPrompt(ask).includes('Rainy window'));
});
const bytes = (text) => new TextEncoder().encode(text).buffer;
const reply = (status, body) => ({ status, headers: {}, body: bytes(typeof body === 'string' ? body : JSON.stringify(body)) });
const usageBox = () => { let v = null; return { get: () => v, set: (x) => { v = x; } }; };
await ok('daily allowance', async () => {
  const usage = usageBox(); const calls = [];
  const fetcher = async (r) => { calls.push(r); return reply(200, { text: 'volume forty' }); };
  const s = { ...settings, dailyLimit: 2 };
  const deps = { fetcher, usage, device: 'dev-1234567890abcdef', now: () => new Date(2026, 9, 6, 12).getTime() };
  assert.equal(await api.transcribe(new ArrayBuffer(10), 'audio/webm', s, { groq: 'k' }, deps), 'volume forty');
  await api.transcribe(new ArrayBuffer(10), 'audio/webm', s, { groq: 'k' }, deps);
  await assert.rejects(() => api.transcribe(new ArrayBuffer(10), 'audio/webm', s, { groq: 'k' }, deps), (e) => e.code === 'limit');
  assert.equal(calls.length, 2, 'no request is made once the limit is reached');
  assert.equal(api.usageToday(usage, new Date(2026, 9, 7, 1).getTime()), 0, 'resets the next day');
});
await ok('cloud calls carry the device id and map 429', async () => {
  const seen = [];
  const fetcher = async (r) => { seen.push(r); return reply(429, { error: 'Daily allowance used up.' }); };
  const s = { ...settings, sttProvider: 'cloud', cloudLimit: 5 };
  const audio = new ArrayBuffer(10);
  await assert.rejects(() => api.transcribe(audio, 'audio/webm', s, {}, { fetcher, usage: usageBox(), device: 'dev-1234567890abcdef' }, { url: 'https://p.supabase.co', key: 'pk' }), (e) => e.code === 'limit');
  assert.equal(seen[0].headers['x-flow-device'], 'dev-1234567890abcdef'); assert.ok(seen[0].url.includes('action=transcribe'));
  const missing = async () => reply(404, 'not found');
  await assert.rejects(() => api.transcribe(audio, 'audio/webm', s, {}, { fetcher: missing, usage: usageBox(), device: 'dev-1234567890abcdef' }, { url: 'https://p.supabase.co', key: 'pk' }), (e) => e.code === 'cloud-unavailable');
});

// ------------------------------------------------------------------ flow: engine with fakes
function rig(overrides = {}, patch = {}) {
  const log = { exec: [], said: [], cues: [], ui: [], fetched: [], cancelled: 0 };
  const timers = [];
  const state = { heard: '', recording: { bytes: new ArrayBuffer(4000), mime: 'audio/webm', seconds: 2 }, local: true, replies: [] };
  const s = { ...settings, ...patch };
  const deps = {
    settings: () => s, keys: () => ({ groq: 'k' }),
    api: { fetcher: async (r) => { log.fetched.push(r); const next = state.replies.shift(); return next ?? reply(200, { text: '' }); }, usage: usageBox(), device: 'dev-1234567890abcdef' },
    recorder: { start: async () => {}, stop: async () => state.recording, cancel: () => { log.cancelled += 1; } },
    local: () => (state.local ? { start() {}, stop: async () => state.heard } : null),
    context: () => ({ mixNames: ['Rainy window'], macroNames: [], playing: false, volume: 50, timerRunning: false, level: 'standard' }),
    execute: (c) => log.exec.push(c), say: (t, k) => log.said.push([t, k]), cue: (k) => log.cues.push(k), publish: (ui) => log.ui.push(ui.phase),
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: () => {},
    ...overrides,
  };
  const engine = new engineMod.FlowEngine(deps);
  const speakFull = async (heard, recording) => { state.heard = heard; if (recording !== undefined) state.recording = recording; engine.keyDown(); await Promise.resolve(); await Promise.resolve(); engine.level(.3, [.3]); engine.level(.3, [.3]); engine.keyUp(); };
  return { engine, log, state, s, timers, speakFull };
}
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };
const hold = async (r, heard) => {
  r.state.heard = heard; const t0 = Date.now();
  r.engine.keyDown(); await settle(); r.engine.level(.3, [.3]); r.engine.level(.3, [.3]);
  // Hold for a while: the gesture needs real time between down and up, so go through the engine's clock.
  await new Promise((res) => setTimeout(res, 320)); r.engine.keyUp(); await settle(); return Date.now() - t0;
};
await ok('engine: a clear command never touches the network', async () => {
  const r = rig(); await hold(r, 'Flow volume full'); assert.deepEqual(r.log.exec, ['volume.set:100']); assert.equal(r.log.fetched.length, 0); assert.equal(r.engine.ui.phase, 'done'); assert.ok(r.log.cues.includes('done'));
});
await ok('engine: unsure + auto goes to the service, transcribes, then the AI', async () => {
  const r = rig({}, { unsure: 'auto' });
  r.state.replies.push(reply(200, { text: 'make it a bit cosier' }), reply(200, { choices: [{ message: { content: '{"command":"mix.load:Rainy window"}' } }] }));
  await hold(r, 'make it a bit cozy'); assert.equal(r.log.fetched.length, 2); assert.deepEqual(r.log.exec, ['mix.load:Rainy window']);
});
await ok('engine: ask mode shows the question and "ask" uses the service', async () => {
  const r = rig({}, { unsure: 'ask' });
  r.state.replies.push(reply(200, { text: 'what is the capital of france' }), reply(200, { choices: [{ message: { content: '{"answer":"Paris."}' } }] }));
  await hold(r, 'what is the capital of france');
  assert.equal(r.engine.ui.phase, 'confirm'); assert.equal(r.log.fetched.length, 0, 'nothing is sent before you agree');
  r.engine.choose('ask'); await settle();
  assert.equal(r.log.fetched.length, 2); assert.deepEqual(r.log.said, [['Paris.', 'answer']]); assert.equal(r.engine.ui.phase, 'done');
});
await ok('engine: ask mode, cancel sends nothing', async () => {
  const r = rig({}, { unsure: 'ask' }); await hold(r, 'blah blah'); assert.equal(r.engine.ui.phase, 'confirm'); r.engine.choose('cancel'); await settle();
  assert.equal(r.log.fetched.length, 0); assert.equal(r.engine.ui.phase, 'idle'); assert.deepEqual(r.log.exec, []);
});
await ok('engine: ask mode, "do the closest command"', async () => {
  const r = rig({}, { unsure: 'ask' }); await hold(r, 'turn volume up a little please louder');
  if (r.engine.ui.phase === 'confirm') { r.engine.choose('run'); await settle(); }
  assert.ok(r.log.exec.length <= 1); assert.equal(r.log.fetched.length, 0);
});
await ok('engine: never uses a service', async () => {
  const r = rig({}, { unsure: 'never' }); await hold(r, 'quantum jazz'); assert.equal(r.log.fetched.length, 0); assert.equal(r.engine.ui.phase, 'error');
});
await ok('engine: silence is never uploaded', async () => {
  const r = rig({}, { unsure: 'auto' }); r.state.heard = ''; r.engine.keyDown(); await settle(); r.engine.level(.0, [0]); await new Promise((res) => setTimeout(res, 320)); r.engine.keyUp(); await settle();
  assert.equal(r.log.fetched.length, 0); assert.equal(r.engine.ui.phase, 'error');
});
await ok('engine: service failure is shown, not thrown', async () => {
  const r = rig({}, { unsure: 'auto' }); r.state.replies.push(reply(401, { error: { message: 'Invalid API Key' } }));
  await hold(r, 'gibberish words'); assert.equal(r.engine.ui.phase, 'error'); assert.match(r.engine.ui.message, /refused the key/);
});
await ok('engine: a tap and abort (Ctrl+C) stays silent and does nothing', async () => {
  const r = rig(); r.engine.keyDown(); await settle(); r.engine.abort(); await settle();
  assert.deepEqual(r.log.exec, []); assert.equal(r.log.fetched.length, 0); assert.ok(r.log.cancelled >= 1); assert.ok(!r.log.cues.includes('stop'));
});
await ok('engine: microphone failure is explained', async () => {
  const err = Object.assign(new Error('x'), { name: 'NotAllowedError' });
  const r = rig({ recorder: { start: async () => { throw err; }, stop: async () => null, cancel() {} } }); r.engine.keyDown(); await settle();
  assert.equal(r.engine.ui.phase, 'error'); assert.match(r.engine.ui.message, /blocked/);
});
await ok('engine: disabled does nothing', async () => {
  const r = rig({}, { enabled: false }); r.engine.keyDown(); await settle(); assert.equal(r.engine.ui.phase, 'idle');
});

// ------------------------------------------------------------------ media seek
await ok('positionFor', () => {
  assert.deepEqual(media.positionFor('remaining', { mode: 'pomodoro', seconds: 1500, totalSeconds: 1500 }), { duration: 1500, position: 1500 });
  assert.deepEqual(media.positionFor('remaining', { mode: 'pomodoro', seconds: 300, totalSeconds: 1500 }), { duration: 1500, position: 300 });
  assert.deepEqual(media.positionFor('elapsed', { mode: 'pomodoro', seconds: 300, totalSeconds: 1500 }), { duration: 1500, position: 1200 });
  assert.deepEqual(media.positionFor('remaining', { mode: 'pomodoro', seconds: 300, totalSeconds: 300 }), { duration: 300, position: 300 });
  assert.equal(media.positionFor('off', { mode: 'pomodoro', seconds: 1, totalSeconds: 5 }), null); assert.equal(media.positionFor('remaining', { mode: 'stopwatch', seconds: 9, totalSeconds: 0 }), null);
  assert.equal(media.positionFor('remaining', { mode: 'countdown', seconds: -5, totalSeconds: 60 }).position, 0);
  assert.equal(media.positionFor('remaining', { mode: 'countdown', seconds: 999, totalSeconds: 60 }).position, 60);
});
await ok('titleFor', () => {
  assert.equal(media.titleFor('both', 'Focus', true, 'Rain'), 'Focus \u00b7 Rain'); assert.equal(media.titleFor('phase', 'Break', true, 'Rain'), 'Break');
  assert.equal(media.titleFor('both', 'Focus', false, 'Rain'), 'Rain'); assert.equal(media.titleFor('mix', 'Focus', true, ''), 'Focus sound');
});

// ------------------------------------------------------------------ discord
const input = { playing: true, mixName: 'Rain', timerRunning: true, timerMode: 'pomodoro', phase: 'focus', seconds: 600, task: 'Calculus', cycle: 2, cycles: 4 };
await ok('discord zero setup', () => {
  const d = discord.sanitizeDiscord({ enabled: true });
  assert.equal(discord.effectiveAppId(d), '1557093339407458364'); assert.equal(discord.usingOwnApp(d), false); assert.equal(d.imageKey, 'icon');
  const a = discord.buildActivity(d, input, 1_000_000);
  assert.ok(a.details && a.assets.large_image === 'icon'); assert.equal(a.timestamps.end, 1600);
  assert.equal(discord.buildActivity({ ...d, enabled: false }, input), null);
});
await ok('discord own app and options', () => {
  assert.equal(discord.effectiveAppId({ appId: '123456789012345678' }), '123456789012345678'); assert.equal(discord.usingOwnApp({ appId: '123456789012345678' }), true);
  assert.equal(discord.effectiveAppId({ appId: 'abc' }), '1557093339407458364');
  const d = { ...discord.sanitizeDiscord({ enabled: true }), customDetails: 'Studying {task}', customState: '{mix} #{block}/{blocks}', buttonLabel: 'Join', buttonUrl: 'https://example.com/x', activityType: 3, showTask: true };
  const a = discord.buildActivity(d, input);
  assert.equal(a.details, 'Studying Calculus'); assert.equal(a.state, 'Rain #2/4'); assert.equal(a.type, 3); assert.deepEqual(a.buttons, [{ label: 'Join', url: 'https://example.com/x' }]);
  const hidden = discord.buildActivity({ ...d, showTask: false, showMix: false, customDetails: '', customState: '' }, input);
  assert.ok(!JSON.stringify(hidden).includes('Calculus') && !JSON.stringify(hidden).includes('Rain'), 'privacy toggles hold');
  assert.equal(discord.cleanButtonUrl('javascript:alert(1)'), ''); assert.equal(discord.cleanButtonUrl('https://u:p@x.com'), ''); assert.equal(discord.cleanButtonUrl('http://x.com'), '');
  assert.ok(discord.buildActivity({ ...d, customDetails: 'x'.repeat(500) }, input).details.length <= 100);
});

// ------------------------------------------------------------------ recordings (pure parts)
await ok('recordings settings', () => {
  assert.equal(rec.SLOTS.length, 10); assert.equal(rec.slotByLayer('Rainfall').id, 'rain');
  const s = rec.sanitizeRec({ source: 'weird', crossfade: 99, keep: 0, cloudBase: 'javascript:1' });
  assert.equal(s.source, 'auto'); assert.equal(s.crossfade, 10); assert.equal(s.keep, 1); assert.equal(s.cloudBase, '');
  assert.equal(rec.normalizeBase('https://x.supabase.co/storage/v1/object/public/sounds/'), 'https://x.supabase.co/storage/v1/object/public/sounds');
  const ch = [new Float32Array(1000).fill(.01)]; const g = rec.normalizeGain(ch); assert.ok(g > 1 && g <= 8, String(g));
  const loud = [new Float32Array(1000).fill(.9)]; assert.ok(rec.normalizeGain(loud) < 1);
});

console.log(`v1.7 tests: ${n} groups passed`);
