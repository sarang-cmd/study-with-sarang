'use strict';
// The Pause/Break helper protocol, the new settings and the new commands. No Windows needed: the helper process is faked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createKeys } = require('../electron/keys.cjs');
const { sanitize, defaults } = require('../electron/settings.cjs');
const commands = require('../electron/commands.cjs');
const pass = (m) => console.log(`PASS ${m}`);

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter(); child.stdout.setEncoding = () => {};
  child.stderr = new EventEmitter();
  child.killed = false; child.kill = () => { child.killed = true; child.emit('exit'); };
  return child;
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-keys-'));

// Unsupported platforms never spawn anything.
let spawned = 0;
const mac = createKeys({ dir, platform: 'darwin', spawn: () => { spawned++; return fakeChild(); }, scriptSource: () => '', onKey() {}, onStatus() {} });
assert.equal(mac.supported, false); assert.equal(mac.start(), false); assert.equal(spawned, 0); assert.equal(mac.status(), 'unsupported');
pass('Pause key helper is Windows only');

// Windows: start, ready, key presses, partial lines, junk lines, stop
const child = fakeChild(); let args = null; const keys = []; const statuses = [];
const win = createKeys({ dir, platform: 'win32', spawn: (cmd, a) => { args = [cmd, a]; return child; }, scriptSource: () => '# script', onKey: (k) => keys.push(k), onStatus: (s) => statuses.push(s.status) });
assert.equal(win.start(), true); assert.equal(win.start(), true, 'second start reuses the helper');
assert.equal(args[0], 'powershell.exe'); assert.ok(args[1].includes('-NoProfile') && args[1].includes('-ExecutionPolicy') && args[1].includes('-ParentPid'));
assert.ok(fs.readFileSync(path.join(dir, 'keys-listener.ps1'), 'utf8').startsWith('\ufeff'), 'the script is written with a BOM');
child.stdout.emit('data', '{"type":"ready"}\n{"type":"key","key":"pa');
child.stdout.emit('data', 'use"}\nnot json\n{"type":"key","key":"other"}\n{"type":"key","key":"pause"}\n');
assert.deepEqual(keys, ['pause', 'pause']); assert.equal(win.status(), 'on');
win.stop(); assert.equal(child.killed, true); assert.equal(win.running(), false); assert.equal(win.status(), 'off');
pass('the helper protocol: ready, split lines, junk and unknown keys, stop');

// Error from the helper is reported and stays visible
const bad = fakeChild(); let message = '';
const win2 = createKeys({ dir, platform: 'win32', spawn: () => bad, scriptSource: () => '', onKey() {}, onStatus: (s) => { message = s.message; } });
win2.start(); bad.stdout.emit('data', '{"type":"error","code":"taken","message":"Another program has it."}\n'); bad.emit('exit');
assert.equal(win2.status(), 'error'); assert.equal(message, 'Another program has it.');
pass('a taken Pause key is reported');

// Settings
assert.deepEqual([defaults.nativeControls, defaults.appIcon, defaults.mediaKeys, defaults.pauseKey, defaults.pauseKeyCommand], [true, 'default', true, true, 'sound.toggle']);
const s = sanitize({ nativeControls: 'yes', appIcon: 'neon', mediaKeys: false, pauseKey: false, pauseKeyCommand: 'rm -rf /' });
assert.equal(defaults.mediaKeysFollow, true, 'media keys follow the most recent player by default'); assert.equal(sanitize({ mediaKeysFollow: 'no' }).mediaKeysFollow, true); assert.equal(sanitize({ mediaKeysFollow: false }).mediaKeysFollow, false);
assert.equal(s.nativeControls, true); assert.equal(s.appIcon, 'default'); assert.equal(s.mediaKeys, false); assert.equal(s.pauseKey, false); assert.equal(s.pauseKeyCommand, 'sound.toggle');
assert.equal(sanitize({ appIcon: 'classic', pauseKeyCommand: 'timer.toggle' }).appIcon, 'classic'); assert.equal(sanitize({ pauseKeyCommand: 'mix.load:Flow' }).pauseKeyCommand, 'mix.load:Flow');
pass('new settings are sanitized');

// Commands
for (const id of ['window.minimize', 'window.maximize', 'window.close', 'settings.open', 'palette.open', 'layout.toggle']) assert.ok(commands.parse(id), id);
assert.deepEqual(commands.parse('settings.open:keys'), { id: 'settings.open', arg: 'keys' });
assert.ok(commands.fromUrl('study-with-sarang://cmd/settings.open/keys'), 'links may open settings');
assert.equal(commands.parse('window.explode'), null);
pass('new commands parse');
console.log('Verified Pause key helper protocol, new settings and commands.');
