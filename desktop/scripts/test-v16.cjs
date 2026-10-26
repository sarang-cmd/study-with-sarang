'use strict';
// 1.6 shell side: Discord IPC framing and connection handling, the activity helper, voice events and checks. All with fakes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const discord = require('../electron/discord.cjs');
const { createActivity, recorderList } = require('../electron/activity.cjs');
const { createVoice } = require('../electron/voice.cjs');
const pass = (m) => console.log(`PASS ${m}`);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-v16-'));

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter(); child.stdout.setEncoding = () => {};
  child.stderr = new EventEmitter();
  child.killed = false; child.kill = () => { child.killed = true; child.emit('exit'); };
  return child;
}

// ---- Discord framing ---------------------------------------------------------------------
const frame = discord.encodeFrame(1, { cmd: 'SET_ACTIVITY', n: 'héllo' });
assert.equal(frame.readInt32LE(0), 1); assert.equal(frame.readInt32LE(4), frame.length - 8);
const two = Buffer.concat([discord.encodeFrame(1, { a: 1 }), discord.encodeFrame(3, { b: 2 }), frame.subarray(0, 10)]);
let r = discord.decodeFrames(two);
assert.deepEqual(r.frames.map((f) => [f.op, f.data]), [[1, { a: 1 }], [3, { b: 2 }]]); assert.equal(r.rest.length, 10, 'a partial frame waits for the rest');
r = discord.decodeFrames(Buffer.concat([r.rest, frame.subarray(10)])); assert.equal(r.frames.length, 1); assert.equal(r.frames[0].data.n, 'héllo');
const evil = Buffer.alloc(8); evil.writeInt32LE(1, 0); evil.writeInt32LE(1 << 30, 4);
assert.deepEqual(discord.decodeFrames(evil).frames, [], 'an absurd length is dropped, not allocated');
assert.equal(discord.decodeFrames(discord.encodeFrame(1, {}).subarray(0, 3)).frames.length, 0);
assert.ok(discord.pipePaths('win32')[0] === '\\\\?\\pipe\\discord-ipc-0'); assert.ok(discord.pipePaths('darwin', { TMPDIR: '/tmp/x' })[1] === path.join('/tmp/x', 'discord-ipc-1'));
pass('Discord frames: encode, split, partial, oversize, pipe names');

// ---- Discord activity validation -----------------------------------------------------------
const clean = discord.sanitizeActivity({ details: ' Focusing ', state: 'Flow', timestamps: { end: 5.9, start: 'x' }, assets: { large_image: 'icon', large_text: 'T' }, evil: 'x', buttons: [{ label: 'x', url: 'http://evil' }] });
assert.deepEqual(clean, { details: 'Focusing', state: 'Flow', timestamps: { end: 5 }, assets: { large_image: 'icon', large_text: 'T' } });
assert.equal(discord.sanitizeActivity({ state: 'no details' }), null); assert.equal(discord.sanitizeActivity('x'), null);
assert.equal(discord.sanitizeActivity({ details: 'a', assets: { large_image: 'http://evil/x.png' } }).assets, undefined, 'never plain http');
assert.equal(discord.sanitizeActivity({ details: 'a', assets: { large_image: 'https://evil.example/x.png' } }).assets, undefined, 'only our own vercel.app pictures');
assert.equal(discord.sanitizeActivity({ details: 'a', assets: { large_image: 'https://study-with-sarang.vercel.app/icons/moon/art-512.png' } }).assets.large_image, 'https://study-with-sarang.vercel.app/icons/moon/art-512.png');
assert.equal(discord.sanitizeActivity({ details: 'x'.repeat(500) }).details.length, 128);
pass('Discord activity: only known fields, sizes and asset names');

// ---- Discord connection --------------------------------------------------------------------
function fakeSocketFactory(behaviour) {
  const made = [];
  const connect = (p) => {
    const s = new EventEmitter(); s.written = []; s.path = p; s.ended = false;
    s.write = (b) => { s.written.push(b); }; s.end = () => { s.ended = true; }; s.destroy = () => { s.ended = true; };
    made.push(s);
    setImmediate(() => behaviour(s, made.length - 1));
    return s;
  };
  return { connect, made };
}
const decodeAll = (s) => discord.decodeFrames(Buffer.concat(s.written)).frames;
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

(async () => {
  // First two pipes are missing, the third works.
  const fx = fakeSocketFactory((s, i) => { if (i < 2) s.emit('error', new Error('ENOENT')); else s.emit('connect'); });
  const statuses = [];
  const d = discord.createDiscord({ connect: fx.connect, onStatus: (x) => statuses.push(x.status), paths: ['p0', 'p1', 'p2'], retryMs: 50 });
  d.update({ enabled: true, appId: '123456789012345678' }, { details: 'Focusing', state: 'Flow' });
  await tick();
  assert.equal(fx.made.length, 3, 'tries the next pipe until one answers');
  const sock = fx.made[2];
  assert.deepEqual(decodeAll(sock)[0], { op: 0, data: { v: 1, client_id: '123456789012345678' } }, 'handshake with the user\'s application ID');
  sock.emit('data', discord.encodeFrame(1, { cmd: 'DISPATCH', evt: 'READY', data: { user: { username: 'sarang' } } }));
  await tick();
  assert.equal(d.status(), 'connected');
  const sent = decodeAll(sock).filter((f) => f.data && f.data.cmd === 'SET_ACTIVITY');
  assert.equal(sent.length, 1); assert.equal(sent[0].data.args.activity.details, 'Focusing'); assert.equal(sent[0].data.args.pid, process.pid);
  d.update({ enabled: true, appId: '123456789012345678' }, { details: 'Resting' });
  assert.equal(decodeAll(sock).filter((f) => f.data && f.data.cmd === 'SET_ACTIVITY').length, 2, 'later updates reuse the connection');
  sock.emit('data', discord.encodeFrame(3, { nonce: 'x' })); assert.equal(decodeAll(sock).slice(-1)[0].op, 4, 'answers Discord\'s ping');
  d.update({ enabled: true, appId: '123456789012345678' }, null);
  assert.equal(decodeAll(sock).slice(-1)[0].data.args.activity, undefined, 'a null activity clears the status');
  d.update({ enabled: false, appId: '123456789012345678' }, null);
  assert.equal(d.status(), 'off'); assert.ok(sock.ended, 'turning it off closes the connection');
  pass('Discord connection: pipe search, handshake, READY, updates, ping, clear, off');

  // Discord not running: waits and retries, never throws.
  const gone = fakeSocketFactory((s) => s.emit('error', new Error('ENOENT')));
  const st2 = [];
  const d2 = discord.createDiscord({ connect: gone.connect, onStatus: (x) => st2.push(x.status), paths: ['a', 'b'], retryMs: 30 });
  d2.update({ enabled: true, appId: '123456789012345678' }, { details: 'x' });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(d2.status(), 'waiting'); assert.ok(gone.made.length >= 4, 'keeps retrying quietly');
  d2.stop(); const count = gone.made.length; await new Promise((resolve) => setTimeout(resolve, 80)); assert.equal(gone.made.length, count, 'no retries after turning it off');
  // Missing or malformed application ID: reports, does not connect.
  const none = fakeSocketFactory(() => {}); const st3 = [];
  const d3 = discord.createDiscord({ connect: none.connect, onStatus: (x) => st3.push(x), paths: ['a'] });
  d3.update({ enabled: true, appId: '123' }, { details: 'x' }); assert.equal(none.made.length, 0); assert.equal(d3.status(), 'error');
  d3.update({ enabled: false }, null); assert.equal(d3.status(), 'off');
  pass('Discord: waits for the app, stops cleanly, rejects a bad ID without connecting');

  // Discord closes the handshake (bad ID): error shown, no reconnect storm.
  const bad = fakeSocketFactory((s) => s.emit('connect')); const st4 = [];
  const d4 = discord.createDiscord({ connect: bad.connect, onStatus: (x) => st4.push(x), paths: ['a'], retryMs: 20 });
  d4.update({ enabled: true, appId: '123456789012345678' }, { details: 'x' }); await tick();
  bad.made[0].emit('data', discord.encodeFrame(2, { code: 4000, message: 'Invalid Client ID' })); await tick();
  assert.equal(d4.status(), 'error'); assert.equal(st4.slice(-1)[0].detail, 'Invalid Client ID');
  await new Promise((resolve) => setTimeout(resolve, 80)); assert.equal(bad.made.length, 1); d4.stop();
  pass('Discord: an invalid Client ID is shown and not retried forever');

  // ---- Activity helper --------------------------------------------------------------------------
  assert.deepEqual(recorderList('OBS64, Bandicam;x, ,x y'), ['obs64', 'bandicamx', 'x y'], 'names are lowercased and stripped of odd characters');
  const mac = createActivity({ dir, platform: 'darwin', spawn: () => { throw new Error('no'); }, scriptSource: () => '', onState() {} });
  assert.equal(mac.supported, false); assert.equal(mac.start('obs'), false);
  let spawnArgs = null; const child = fakeChild(); const states = []; const stat = [];
  const act = createActivity({ dir, platform: 'win32', spawn: (cmd, args) => { spawnArgs = [cmd, args]; return child; }, scriptSource: () => '# script', onState: (s) => states.push(s), onStatus: (s) => stat.push(s) });
  assert.equal(act.start('OBS64, Camtasia'), true);
  assert.equal(spawnArgs[0], 'powershell.exe'); assert.ok(spawnArgs[1].includes('-NonInteractive') && spawnArgs[1].includes('obs64,camtasia') && spawnArgs[1].includes('-ParentPid'));
  assert.ok(fs.readFileSync(path.join(dir, 'activity-listener.ps1'), 'utf8').startsWith('\ufeff'));
  child.stdout.emit('data', '{"type":"ready","media":true}\n{"type":"state","mic":["a.exe"],"recorders":[],"media":["Chrome"');
  child.stdout.emit('data', ']}\nnot json\n{"type":"state","mic":"oops","recorders":["obs64"],"media":null}\n');
  assert.deepEqual(states, [{ mic: ['a.exe'], recorders: [], media: ['Chrome'] }, { mic: [], recorders: ['obs64'], media: [] }], 'partial lines, junk and wrong types are handled');
  assert.equal(act.status(), 'on');
  assert.equal(act.start('obs64, camtasia'), true); assert.equal(child.killed, false, 'same list reuses the helper');
  act.stop(); assert.equal(child.killed, true); assert.equal(act.running(), false);
  const c2 = fakeChild(); const act2 = createActivity({ dir, platform: 'win32', spawn: () => c2, scriptSource: () => '', onState() {}, onStatus: (s) => stat.push(s) });
  act2.start(''); c2.stdout.emit('data', '{"type":"ready","media":false}\n'); assert.ok(stat.slice(-1)[0].message.includes('cannot be detected'), 'missing media sessions are explained');
  const c3 = fakeChild(); const act3 = createActivity({ dir, platform: 'win32', spawn: () => c3, scriptSource: () => '', onState() {}, onStatus: (s) => stat.push(s) });
  act3.start(''); c3.stderr.emit('data', 'Cannot load assembly'); c3.emit('exit'); assert.equal(act3.status(), 'error'); assert.ok(stat.slice(-1)[0].message.includes('Cannot load assembly'), 'helper failures are shown, not hidden');
  pass('Activity helper: arguments, protocol, same-list reuse, stop, explained failures');

  // ---- Voice events and diagnose --------------------------------------------------------------
  const vc = fakeChild(); const events = [];
  const voice = createVoice({ dir, platform: 'win32', spawn: () => vc, scriptSource: () => '', diagnoseSource: () => '# d', onEvent: (e) => events.push(e), readyTimeoutMs: 80 });
  voice.start({ languages: ['en'], phrases: { en: ['pause'], de: [] }, wake: { en: 'Sarang', de: 'Sarang' }, useWake: false });
  vc.stdout.emit('data', '{"type":"ready","language":"en","culture":"en-US"}\n{"type":"level","level":42}\n{"type":"level","level":900}\n{"type":"hypothesis","text":"pa"}\n{"type":"rejected","text":"hmm","confidence":0.31}\n{"type":"heard","text":"pause","confidence":0.8}\n');
  assert.deepEqual(events.map((e) => e.type), ['status', 'status', 'level', 'level', 'hypothesis', 'rejected', 'heard']);
  assert.equal(events[3].level, 100, 'levels are clamped'); assert.deepEqual(events[5], { type: 'rejected', text: 'hmm', confidence: 0.31 });
  voice.stop();
  const slow = fakeChild(); const ev2 = [];
  const v2 = createVoice({ dir, platform: 'win32', spawn: () => slow, scriptSource: () => '', onEvent: (e) => ev2.push(e), readyTimeoutMs: 40 });
  v2.start({ languages: ['en'], phrases: { en: ['x'], de: [] }, wake: { en: 'S', de: 'S' }, useWake: false });
  slow.stderr.emit('data', 'File is not digitally signed'); await new Promise((resolve) => setTimeout(resolve, 80));
  const err = ev2.find((e) => e.status === 'error'); assert.ok(err && err.code === 'timeout' && err.message.includes('not digitally signed'), 'a silent PowerShell failure now shows its message');
  const crash = fakeChild(); const ev3 = [];
  const v3 = createVoice({ dir, platform: 'win32', spawn: () => crash, scriptSource: () => '', onEvent: (e) => ev3.push(e), readyTimeoutMs: 500 });
  v3.start({ languages: ['en'], phrases: { en: ['x'], de: [] }, wake: { en: 'S', de: 'S' }, useWake: false });
  crash.stderr.emit('data', 'The term Add-Type is not recognized'); crash.emit('exit');
  assert.ok(ev3.some((e) => e.status === 'error' && e.message.includes('Add-Type')), 'an early crash is reported with its message');
  const dprocs = []; const diag = createVoice({ dir, platform: 'win32', spawn: () => { const c = fakeChild(); dprocs.push(c); return c; }, scriptSource: () => '', diagnoseSource: () => '# d', onEvent() {} });
  const p1 = diag.diagnose(); dprocs[0].stdout.emit('data', '{"psVersion":"5.1","micOpen":true}\n'); dprocs[0].emit('exit');
  const res = await p1; assert.equal(res.ok, true); assert.equal(res.micOpen, true);
  const p2 = diag.diagnose(); dprocs[1].stderr.emit('data', 'blocked by policy'); dprocs[1].emit('exit');
  const res2 = await p2; assert.equal(res2.ok, false); assert.ok(res2.error.includes('blocked by policy'));
  const nonWin = createVoice({ dir, platform: 'darwin', scriptSource: () => '', onEvent() {} }); assert.equal((await nonWin.diagnose()).ok, false);
  pass('Voice: level, hypothesis and rejected events, failures show their message, checks run');

  // Scripts exist and parse as expected text
  for (const f of ['voice-listener.ps1', 'voice-diagnose.ps1', 'activity-listener.ps1']) assert.ok(fs.statSync(path.join(__dirname, '..', 'electron', f)).size > 500, f);
  const listener = fs.readFileSync(path.join(__dirname, '..', 'electron', 'voice-listener.ps1'), 'utf8');
  for (const needle of ['AudioLevelUpdated', 'SpeechHypothesized', "type = 'level'", "type = 'rejected'"]) assert.ok(listener.includes(needle), needle);
  console.log('Verified 1.6 shell modules.');
})().catch((error) => { console.error(error); process.exit(1); });
