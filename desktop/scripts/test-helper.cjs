'use strict';
/** The browser helper end to end: the extension's own lib.js talks to the real helper server in the app, pairing, safety and updates of the folder. */
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const vm = require('node:vm'); const net = require('node:net');
const { createDrift, browserCommand, refreshExtension, exportExtension } = require('../electron/drift.cjs');
const pass = (m) => console.log(`PASS ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-helper-'));
  const ext = path.join(__dirname, '..', 'extension');
  // ---- the extension's shared code, with a pretend browser around it and a real network
  const store = {}; const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
  const chrome = { storage: { local: {
    get: async (defaults) => ({ ...defaults, ...store }),
    set: async (values) => { Object.assign(store, values); },
  } } };
  const ctx = vm.createContext({ chrome, fetch: (url, options = {}) => fetch(url, { ...options, headers: { ...(options.headers ?? {}), origin: ORIGIN } }), console });
  vm.runInContext(fs.readFileSync(path.join(ext, 'lib.js'), 'utf8') + '\nthis.api = { getSettings, hello, pair, check, STATE_TEXT };', ctx);
  const api = ctx.api;
  const port = await freePort(); store.port = port;

  assert.equal((await api.check()).state, 'offline', 'no app, no connection');
  pass('with no app running the helper says so');

  const samples = []; const statuses = [];
  const drift = createDrift({ dir, platform: 'linux', onSample: (s) => samples.push(s), onStatus: (s) => statuses.push(s) });
  drift.configure({ enabled: true, window: false, helper: true, port, token: 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1' });
  for (let i = 0; i < 40 && drift.status().helper !== 'listening'; i += 1) await sleep(25);
  assert.equal(drift.status().helper, 'listening', drift.status().message);

  let s = await api.check(); assert.equal(s.state, 'not-paired'); assert.equal(s.pairing, false);
  const refused = await api.pair(); assert.equal(refused.ok, false); assert.match(refused.why, /Pair the extension/); assert.equal(store.token, undefined);
  pass('the app is found, and pairing is refused until the person at the app asks for it');

  // ---- safety: only a browser extension, on this computer, while the window is open
  assert.equal(drift.startPairing(60_000).ok, true);
  const url = `http://127.0.0.1:${port}/pair`;
  assert.equal((await fetch(url)).status, 403, 'a plain request (no extension origin) never gets the code');
  assert.equal((await fetch(url, { headers: { origin: 'https://evil.example' } })).status, 403, 'a web page never gets the code');
  const wrongHost = await new Promise((resolve) => { const req = require('node:http').request({ host: '127.0.0.1', port, path: '/pair', headers: { host: 'evil.example', origin: ORIGIN } }, (res) => resolve(res.statusCode)); req.end(); });
  assert.equal(wrongHost, 403, 'a rebinding host name never gets the code');
  assert.equal(statuses.at(-1).pairing, true);
  pass('only a browser extension on this computer can fetch the code, only while pairing is open');

  s = await api.check(); assert.equal(s.state, 'not-paired'); assert.equal(s.pairing, true);
  const paired = await api.pair(); assert.equal(paired.ok, true); assert.equal(store.token, 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1');
  assert.equal(statuses.at(-1).pairing, false); assert.match(statuses.at(-1).message, /Paired with the browser extension abcdefgh/);
  assert.equal((await api.check()).state, 'connected');
  assert.equal((await api.pair()).ok, false, 'one pairing per request: the window closes after the code is handed over');
  pass('Connect fetches the code with no copying, and the window closes at once');

  // ---- the tab report works with the stored code, and the old code stops working after a change
  const post = (token, body) => fetch(`http://127.0.0.1:${port}/tab`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify(body) });
  assert.equal((await post(store.token, { host: 'youtube.com', title: 'x', browser: 'brave', incognito: false })).status, 200);
  assert.equal(samples.at(-1).host, 'youtube.com');
  assert.equal((await post('guess', { host: 'a.com' })).status, 401);
  drift.configure({ enabled: true, window: false, helper: true, port, token: 'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2' });
  await sleep(150);
  assert.equal((await api.check()).state, 'wrong-code', 'after a new code the helper asks to be paired again');
  pass('tab reports reach the app, and a changed code is noticed');

  // ---- a window that nobody uses closes by itself
  drift.startPairing(60); await sleep(180);
  assert.equal((await api.pair()).ok, false); assert.equal(drift.status().pairing, false);
  assert.equal(drift.startPairing().ok, true); drift.configure({ enabled: false, window: false, helper: false, port, token: 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1' });
  assert.equal(drift.status().pairing, false, 'switching the helper off closes pairing');
  drift.stop();
  assert.equal(drift.startPairing().ok, false, 'no pairing without the helper on');
  pass('pairing expires, and switching the helper off ends it');

  // ---- opening the browser at its extensions page
  const exists = (set) => (p) => set.includes(p);
  const win = (set) => ({ platform: 'win32', env: { LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local', ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)' }, exists: exists(set) });
  const edge = path.join('C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe');
  assert.deepEqual(browserCommand('edge', win([edge])), { command: edge, args: ['edge://extensions'] });
  assert.equal(browserCommand('chrome', win([edge])), null, 'a browser that is not installed is not launched');
  assert.equal(browserCommand('firefox', win([edge])), null);
  assert.deepEqual(browserCommand('brave', { platform: 'darwin', env: {}, exists: () => false }), { command: 'open', args: ['-a', 'Brave Browser', 'brave://extensions'] });
  assert.equal(browserCommand('chrome', { platform: 'linux', env: {}, exists: () => true }), null);
  pass('the right browser opens at its extensions page, and a missing one falls back to the folder');

  // ---- keeping the loaded folder current
  const dest = path.join(dir, 'browser-helper');
  assert.equal(refreshExtension(ext, dest), '', 'nothing to refresh before the person loaded it');
  exportExtension(ext, dest);
  assert.equal(refreshExtension(ext, dest), '', 'same version: untouched');
  const manifest = path.join(dest, 'manifest.json'); const m = JSON.parse(fs.readFileSync(manifest, 'utf8')); m.version = '0.9.0'; fs.writeFileSync(manifest, JSON.stringify(m));
  fs.writeFileSync(path.join(dest, 'background.js'), '// stale');
  const bundled = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8')).version;
  assert.equal(refreshExtension(ext, dest), bundled);
  assert.equal(fs.readFileSync(path.join(dest, 'background.js'), 'utf8'), fs.readFileSync(path.join(ext, 'background.js'), 'utf8'));
  m.version = '99.0.0'; fs.writeFileSync(manifest, JSON.stringify(m)); assert.equal(refreshExtension(ext, dest), '', 'a newer folder is never downgraded');
  pass('an older loaded helper folder is refreshed, a newer one is left alone');

  // ---- what ships
  const files = fs.readdirSync(ext);
  for (const f of ['manifest.json', 'background.js', 'lib.js', 'popup.html', 'popup.js', 'options.html', 'options.js', 'ui.css', 'icon16.png', 'icon32.png', 'icon48.png', 'icon128.png']) assert.ok(files.includes(f), `${f} ships`);
  const man = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
  assert.equal(man.manifest_version, 3); assert.deepEqual(man.host_permissions, ['http://127.0.0.1/*']); assert.equal(man.options_ui.open_in_tab, true); assert.equal(man.action.default_popup, 'popup.html');
  for (const f of ['background.js', 'lib.js', 'popup.js']) assert.ok(!/https?:\/\/(?!127\.0\.0\.1)/.test(fs.readFileSync(path.join(ext, f), 'utf8').replace(/\/\/.*$/gm, '')), `${f} talks to no address except this computer`);
  for (const f of ['popup.html', 'options.html']) assert.ok(!/<script[^>]+src="https?:/.test(fs.readFileSync(path.join(ext, f), 'utf8')), 'no remote scripts');
  pass('the extension ships a popup, a settings page, icons, and no remote code');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('Verified the browser helper: pairing, safety, status, folder refresh.');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
