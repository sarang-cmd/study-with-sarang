'use strict';
// 1.7 desktop shell tests with no Electron and no Windows: the Flow key helper, the Flow bar window, web requests and sound files, Discord.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createFlowKey, validVks } = require('../electron/flowkey.cjs');
const { createFlowBar, WIDTH, HEIGHT, SHOW_DELAY } = require('../electron/flowbar.cjs');
const flowio = require('../electron/flowio.cjs');
const { sanitizeActivity } = require('../electron/discord.cjs');
const commands = require('../electron/commands.cjs');
const pass = (m) => console.log(`PASS ${m}`);

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter(); child.stdout.setEncoding = () => {};
  child.stderr = new EventEmitter();
  child.killed = false; child.kill = () => { child.killed = true; child.emit('exit'); };
  return child;
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-v17-'));

(async () => {
  // ---- the Flow key
  assert.deepEqual(validVks([0xA3, 0xA3, 'x', 0, 300, 5, 6, 7, 8]), [0xA3, 5, 6, 7]);
  const child = fakeChild(); let call = null; const events = []; const statuses = [];
  const key = createFlowKey({ dir: path.join(tmp, 'fk'), platform: 'win32', spawn: (cmd, args) => { call = { cmd, args }; return child; }, scriptSource: () => '# script', onEvent: (e) => events.push(e), onStatus: (s) => statuses.push(s) });
  assert.equal(key.supportsHold, true); assert.equal(key.start({ vks: [] }), false); assert.equal(statuses.at(-1).status, 'error');
  assert.equal(key.start({ vks: [0xA3] }), true);
  assert.equal(call.cmd, 'powershell.exe'); assert.ok(call.args.includes('-Keys') && call.args[call.args.indexOf('-Keys') + 1] === '163'); assert.ok(call.args.includes('-ParentPid'));
  assert.ok(fs.readFileSync(path.join(tmp, 'fk', 'flowkey-listener.ps1'), 'utf8').startsWith('\ufeff'), 'script has a BOM so PowerShell reads it as UTF-8');
  child.stdout.emit('data', '{"type":"ready"}\n{"type":"do'); child.stdout.emit('data', 'wn"}\nnot json\n{"type":"up"}\n{"type":"abort"}\n{"type":"evil"}\n{"type":"esc"}\n');
  assert.deepEqual(events, ['down', 'up', 'abort', 'esc']); assert.equal(statuses.at(-1).status, 'on'); assert.equal(statuses.at(-1).hold, true);
  child.stdout.emit('data', '{"type":"error","message":"boom"}\n'); assert.equal(statuses.at(-1).status, 'error');
  key.stop(); assert.equal(child.killed, true); assert.equal(key.running(), false); assert.equal(statuses.at(-1).status, 'error', 'a stop does not hide an error');
  // Restarting kills the old helper and a stale exit event cannot change the new state.
  const c1 = fakeChild(), c2 = fakeChild(); const list = [c1, c2]; const st = [];
  const k2 = createFlowKey({ dir: path.join(tmp, 'fk2'), platform: 'win32', spawn: () => list.shift(), scriptSource: () => '', onEvent() {}, onStatus: (s) => st.push(s.status) });
  k2.start({ vks: [0xA3] }); k2.start({ vks: [0x77] }); assert.equal(c1.killed, true); c2.stdout.emit('data', '{"type":"ready"}\n'); assert.equal(st.at(-1), 'on'); c1.emit('exit'); assert.equal(st.at(-1), 'on');
  // A spawn failure is reported, not thrown.
  const k3 = createFlowKey({ dir: path.join(tmp, 'fk3'), platform: 'win32', spawn: () => { const c = fakeChild(); setImmediate(() => c.emit('error', new Error('ENOENT'))); return c; }, scriptSource: () => '', onEvent() {}, onStatus: (s) => st.push(s.status) });
  k3.start({ vks: [0xA3] }); await new Promise((r) => setImmediate(r)); assert.equal(st.at(-1), 'error');
  // Other platforms: a plain global shortcut that toggles.
  const reg = new Map(); const mac = [];
  const gs = { register: (a, fn) => { if (a === 'Taken') return false; reg.set(a, fn); return true; }, unregister: (a) => reg.delete(a) };
  const k4 = createFlowKey({ dir: tmp, platform: 'darwin', globalShortcut: gs, spawn: () => { throw new Error('must not spawn'); }, scriptSource: () => '', onEvent: (e) => mac.push(e), onStatus: (s) => mac.push(s.status) });
  assert.equal(k4.supportsHold, false); assert.equal(k4.start({ accelerator: 'Taken' }), false); assert.equal(k4.start({ accelerator: 'F9' }), true); reg.get('F9')(); assert.ok(mac.includes('toggle')); k4.stop(); assert.equal(reg.size, 0);
  pass('Flow key helper');

  // ---- the Flow bar window
  const made = []; const timers = [];
  class FakeWin {
    constructor(opts) { this.opts = opts; this.calls = []; this.destroyed = false; this.handlers = {}; this.sent = []; this.webContents = { id: 7, on: (e, fn) => { this.handlers[e] = fn; }, setWindowOpenHandler: () => {}, send: (c, p) => this.sent.push([c, p]) }; made.push(this); }
    isDestroyed() { return this.destroyed; } setAlwaysOnTop(...a) { this.calls.push(['top', ...a]); } setIgnoreMouseEvents(...a) { this.calls.push(['ignore', ...a]); }
    setVisibleOnAllWorkspaces() {} on() {} loadURL() { return Promise.resolve(); } setBounds(b) { this.bounds = b; } showInactive() { this.calls.push(['show']); } hide() { this.calls.push(['hide']); } destroy() { this.destroyed = true; }
  }
  const screen = { getCursorScreenPoint: () => ({ x: 0, y: 0 }), getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }), getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }) };
  const bar = createFlowBar({ BrowserWindow: FakeWin, screen, preload: 'p.cjs', url: 'app://x/index.html#flowbar', isMac: false, setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: (id) => { if (timers[id - 1]) timers[id - 1].dead = true; } });
  const fire = () => { for (const t of timers.splice(0)) if (!t.dead) t.fn(); };
  assert.equal(made.length, 0, 'nothing is created until needed');
  bar.update({ phase: 'listening', mode: 'hold', place: 'bottom' });
  const w = made[0]; assert.equal(w.opts.focusable, false); assert.equal(w.opts.frame, false); assert.equal(w.opts.transparent, true); assert.equal(w.opts.alwaysOnTop, true); assert.equal(w.opts.webPreferences.nodeIntegration, false); assert.equal(w.opts.webPreferences.sandbox, true);
  assert.equal(bar.isVisible(), false, 'a quick tap never flashes the bar'); assert.ok(timers.some((t) => t.ms === SHOW_DELAY));
  bar.update({ phase: 'idle' }); fire(); assert.equal(bar.isVisible(), false); assert.ok(!w.calls.some((c) => c[0] === 'show'));
  bar.update({ phase: 'listening', mode: 'hold', place: 'bottom' }); fire();
  assert.equal(bar.isVisible(), true); assert.ok(w.calls.some((c) => c[0] === 'show')); assert.equal(w.bounds.width, WIDTH); assert.equal(w.bounds.y, 1040 - HEIGHT - 20); assert.equal(w.bounds.x, (1920 - WIDTH) / 2);
  bar.update({ phase: 'listening', mode: 'hold', place: 'top' }); assert.equal(w.bounds.y, 28);
  bar.update({ phase: 'confirm', place: 'center' }); assert.equal(w.calls.filter((c) => c[0] === 'ignore').at(-1)[1], false, 'confirm is clickable');
  bar.update({ phase: 'thinking', place: 'bottom' }); assert.equal(w.calls.filter((c) => c[0] === 'ignore').at(-1)[1], true, 'the rest never blocks clicks');
  w.handlers['did-finish-load'](); assert.equal(w.sent.at(-1)[0], 'flowbar:ui');
  bar.update({ phase: 'idle' }); fire(); assert.equal(bar.isVisible(), false); assert.ok(w.calls.some((c) => c[0] === 'hide'));
  bar.update({ phase: 'idle' }); bar.update({ phase: 'done', place: 'bottom', message: 'x' }); fire(); assert.equal(bar.isVisible(), true, 'a new request cancels the pending hide');
  assert.equal(bar.webContentsId(), 7); bar.destroy(); assert.equal(w.destroyed, true); assert.equal(bar.webContentsId(), -1);
  pass('Flow bar window');

  // ---- web requests for Flow
  assert.equal(flowio.allowedUrl('https://api.groq.com/x').hostname, 'api.groq.com'); assert.equal(flowio.allowedUrl('http://localhost:11434/v1').port, '11434');
  for (const bad of ['http://example.com', 'file:///etc/passwd', 'ftp://x.com', 'https://u:p@x.com', 'javascript:1', '']) assert.equal(flowio.allowedUrl(bad), null, bad);
  const seen = [];
  const server = http.createServer((req, res) => { const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => { seen.push({ method: req.method, headers: req.headers, body: Buffer.concat(chunks) }); res.writeHead(req.url === '/fail' ? 500 : 200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); }); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let r = await flowio.netFetch(fetch, { url: `${base}/a`, method: 'POST', headers: { authorization: 'Bearer k', host: 'evil', cookie: 'x', 'bad header': 'v', 'x-flow-device': 'd' }, body: new Uint8Array([1, 2, 3]).buffer });
  assert.equal(r.status, 200); assert.equal(JSON.parse(Buffer.from(r.body).toString()).ok, true);
  assert.equal(seen[0].headers.authorization, 'Bearer k'); assert.equal(seen[0].headers['x-flow-device'], 'd'); assert.ok(!seen[0].headers.cookie); assert.deepEqual([...seen[0].body], [1, 2, 3]);
  r = await flowio.netFetch(fetch, { url: `${base}/fail`, method: 'GET' }); assert.equal(r.status, 500, 'errors are passed back so the page can explain them');
  await assert.rejects(() => flowio.netFetch(fetch, { url: 'https://x.com', method: 'POST', body: { evil: 1 } }), /Bad body/);
  await assert.rejects(() => flowio.netFetch(fetch, null), /Bad request/);
  await assert.rejects(() => flowio.netFetch(fetch, { url: 'http://example.com/' }), /https/);
  server.close();
  pass('web requests are limited and sanitized');

  // ---- sound files
  const data = path.join(tmp, 'userdata');
  assert.deepEqual(flowio.listSounds(data), []); assert.equal(await flowio.readSound(data, 'rain'), null);
  const dir = flowio.ensureSoundsDir(data); assert.ok(fs.existsSync(path.join(dir, 'README.txt')));
  fs.writeFileSync(path.join(dir, 'Rain.MP3'), Buffer.alloc(100, 1)); fs.writeFileSync(path.join(dir, 'wind.wav'), Buffer.alloc(50, 2)); fs.writeFileSync(path.join(dir, 'cats.mp3'), Buffer.alloc(5)); fs.writeFileSync(path.join(dir, 'fire.mp3'), Buffer.alloc(0)); fs.writeFileSync(path.join(dir, 'waves.txt'), 'x');
  assert.deepEqual(flowio.listSounds(data).sort(), ['Rain.MP3', 'fire.mp3', 'wind.wav']);
  const got = await flowio.readSound(data, 'rain'); assert.equal(got.name, 'Rain.MP3'); assert.equal(got.bytes.length, 100);
  assert.equal(await flowio.readSound(data, 'fire'), null, 'empty files are ignored'); assert.equal(await flowio.readSound(data, '../../etc/passwd'), null); assert.equal(await flowio.readSound(data, 'cats'), null);
  assert.equal(await flowio.readSound(data, 'thunder'), null);
  pass('sound folder');

  // ---- Discord activity
  const a = sanitizeActivity({ details: 'Focusing', state: '  Rain   ', type: 3, assets: { large_image: 'icon', large_text: 'Study', small_image: 'BAD IMAGE!' }, buttons: [{ label: 'Open', url: 'https://example.com/a' }, { label: 'Two', url: 'https://example.com/b' }], timestamps: { end: 1.7e9 + 0.4 } });
  assert.equal(a.details, 'Focusing'); assert.equal(a.state, 'Rain'); assert.equal(a.type, 3); assert.equal(a.assets.large_image, 'icon'); assert.ok(!a.assets.small_image); assert.equal(a.buttons.length, 1); assert.equal(a.timestamps.end, 1.7e9);
  assert.equal(sanitizeActivity({ details: '' }), null); assert.equal(sanitizeActivity(null), null);
  assert.equal(sanitizeActivity({ details: 'x', type: 1 }).type, undefined, 'only listening and watching are allowed besides playing');
  assert.ok(!sanitizeActivity({ details: 'x', buttons: [{ label: 'Bad', url: 'javascript:alert(1)' }] }).buttons);
  pass('Discord activity sanitizing');

  // ---- commands
  assert.deepEqual(commands.parse('calm.wind:30'), { id: 'calm.wind', arg: '30' }); assert.deepEqual(commands.parse('ui.simple:on'), { id: 'ui.simple', arg: 'on' });
  for (const id of ['calm.open', 'calm.close', 'calm.breathe', 'calm.ground', 'calm.scene', 'calm.wind', 'ui.simple']) assert.ok(commands.RENDERER_COMMANDS.has(id), id);
  assert.equal(commands.parse('flow.hack'), null); assert.equal(commands.fromUrl('study-with-sarang://cmd/calm.breathe/box').arg, 'box');
  pass('commands load');
  console.log('v1.7 shell tests: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
