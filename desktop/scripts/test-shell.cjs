'use strict';
/** Tests for the desktop shell's logic. Plain Node, no Electron window needed. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const E = path.join(__dirname, '..', 'electron');
const commands = require(path.join(E, 'commands.cjs'));
const { validate, createShortcutManager, readKeyboardRepeat } = require(path.join(E, 'shortcuts.cjs'));
const { restoreBounds, compactDefault } = require(path.join(E, 'placement.cjs'));
const { sanitize, createStore, defaults } = require(path.join(E, 'settings.cjs'));
const { detect } = require(path.join(E, 'mode.cjs'));
const { createVoice } = require(path.join(E, 'voice.cjs'));

// ---- commands from the command line and links --------------------------------------------
assert.deepEqual(commands.parse('sound.toggle'), { id: 'sound.toggle', arg: '' });
assert.deepEqual(commands.parse('mix.load:Flow and rain'), { id: 'mix.load', arg: 'Flow and rain' });
assert.equal(commands.parse('format.disk'), null, 'unknown commands are refused');
assert.equal(commands.parse(''), null); assert.equal(commands.parse(undefined), null);
assert.equal(commands.parse('sound.play:' + 'x'.repeat(500)).arg.length < 160, true, 'arguments are length limited');
assert.equal(commands.parse('mix.load:a\u0000b\nc').arg, 'a b c', 'control characters are removed');
assert.equal(commands.fromArgv(['app.exe', '--cmd=sound.pause']).command.id, 'sound.pause');
assert.equal(commands.fromArgv(['app.exe', '--cmd', 'volume.set:40']).command.arg, '40');
assert.equal(commands.fromArgv(['app.exe', '--cmd']), null);
assert.equal(commands.fromArgv(['app.exe', '--login']), null);
assert.equal(commands.fromArgv(['app.exe', 'study-with-sarang://cmd/sound.next']).command.id, 'sound.next');
assert.equal(commands.fromArgv(['app.exe', 'study-with-sarang://cmd/sound.next']).source, 'link');
assert.equal(commands.fromUrl('study-with-sarang://cmd/mix.load/Flow%20and%20rain').arg, 'Flow and rain');
assert.equal(commands.fromUrl('study-with-sarang://sound.toggle').id, 'sound.toggle', 'the cmd segment is optional');
assert.equal(commands.fromUrl('study-with-sarang://cmd/app.quit'), null, 'a web page cannot quit the app through a link');
assert.equal(commands.fromUrl('study-with-sarang://cmd/app.login'), null);
assert.equal(commands.fromArgv(['x', '--cmd=app.quit']).command.id, 'app.quit', 'the command line may quit (the installer needs it)');
assert.equal(commands.fromUrl('https://evil.example/cmd/sound.play'), null);
assert.equal(commands.fromUrl('study-with-sarang://cmd/%E0%A4%A'), null, 'bad escapes do not throw');

// ---- shortcut validation ----------------------------------------------------------------
const ok = (a) => assert.equal(validate(a).ok, true, a);
const bad = (a) => assert.equal(validate(a).ok, false, a);
ok('CommandOrControl+Alt+Shift+Space'); ok('Ctrl+Shift+Y'); ok('F13'); ok('F24'); ok('MediaPlayPause'); ok('Super+Shift+M'); ok('Control+Alt+Shift+Up');
bad('P'); bad('Shift+P'); bad('Alt+P'); bad('Alt+Shift+P'); bad('F5'); bad('F12'); bad('Shift+F5');
bad('Ctrl+Alt+Delete'); bad('Alt+F4'); bad('Ctrl+Shift+Escape'); bad('Alt+Tab'); bad('Ctrl+C'); bad('Ctrl+Shift+T'); bad('Ctrl+Shift+N'); bad('Ctrl+K'); bad('Ctrl+L'); bad('CommandOrControl+V'); bad('Ctrl+W'); bad('Super+L');
bad(''); bad('Ctrl+'); bad('Ctrl+Shift'); bad('Ctrl+Ctrl+P'); bad('Ctrl+Banana+P'); bad(null); bad('Ctrl+' + 'x'.repeat(80));
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
Object.defineProperty(process, 'platform', { value: 'win32' });
assert.ok(validate('Ctrl+Alt+P').warning, 'Ctrl+Alt without Shift warns about AltGr');
assert.equal(validate('Ctrl+Alt+Shift+P').warning, undefined);
assert.ok(validate('Ctrl+Shift+Y').warning, 'two-modifier combinations warn about clashes');
assert.equal(validate('F13').warning, undefined); assert.equal(validate('MediaPlayPause').warning, undefined);
Object.defineProperty(process, 'platform', originalPlatform);

// ---- shortcut manager (fake globalShortcut) ------------------------------------------
{
  const registered = new Map(); const fired = []; let resultsSeen = [];
  let now = 1000; const timers = new Set();
  const gs = { register: (acc, fn) => { if (acc === 'Ctrl+Shift+Q') return false; registered.set(acc, fn); return true; }, unregisterAll: () => registered.clear() };
  const mgr = createShortcutManager({ globalShortcut: gs, onFire: (c) => fired.push(c), onResults: (r) => { resultsSeen = r; }, clock: () => now, setTimer: (fn, ms) => { const t = { fn, at: now + ms }; timers.add(t); return t; }, clearTimer: (t) => timers.delete(t) });
  const advance = (ms) => { now += ms; for (const t of [...timers]) if (t.at <= now) { timers.delete(t); t.fn(); } };
  const r = mgr.setBindings([
    { id: 'a', label: 'A', accelerator: 'CommandOrControl+Alt+Shift+P', command: 'sound.play' },
    { id: 'b', label: 'B', accelerator: 'CommandOrControl+Alt+Shift+S', command: 'sound.pause' },
    { id: 'dup', label: 'Dup', accelerator: 'Ctrl+Alt+Shift+P', command: 'sound.next' },
    { id: 'taken', label: 'Taken', accelerator: 'Ctrl+Shift+Q', command: 'sound.next' },
    { id: 'junk', label: 'Junk', accelerator: 'P', command: 'sound.next' },
    { id: 'none', label: 'None', accelerator: '', command: 'sound.next' },
    { id: 'master', label: 'Master', accelerator: 'CommandOrControl+Alt+Shift+G', command: 'shortcuts.toggle', always: true },
    { id: 'vol', label: 'Vol', accelerator: 'CommandOrControl+Alt+Shift+Up', command: 'volume.up' },
    { id: '', command: 'x' }, null,
  ]);
  const by = Object.fromEntries(r.map((x) => [x.id, x]));
  assert.equal(by.a.active, true); assert.equal(by.b.active, true); assert.equal(by.master.active, true);
  assert.match(by.dup.reason, /Already used/); assert.match(by.taken.reason, /Another app/); assert.equal(by.junk.ok, false); assert.equal(by.none.active, false);
  assert.equal(registered.size, 4, 'only valid, unique shortcuts reach the OS');
  assert.equal(resultsSeen.length, 8);
  registered.get('CommandOrControl+Alt+Shift+P')(); assert.deepEqual(fired, ['sound.play']);
  const P = () => registered.get('CommandOrControl+Alt+Shift+P')();
  // A held key: the first repeat arrives after the keyboard delay (500 ms), then every ~33 ms. Only the first press fires.
  fired.length = 0; advance(5000);
  P(); assert.equal(fired.length, 1, 'the first press fires at once');
  advance(500); P(); advance(33); P(); advance(33); P(); for (let i = 0; i < 60; i++) { advance(33); P(); } advance(200);
  assert.equal(fired.length, 1, 'a held key fires once, including its first repeat');
  // The key is released, then pressed twice quickly: both presses count.
  advance(1000); P(); assert.equal(fired.length, 2, 'a press after releasing fires');
  advance(180); P(); assert.equal(fired.length, 3, 'a quick second press (180 ms) fires at once');
  advance(300); P(); assert.equal(fired.length, 4, 'a press 300 ms later fires too');
  // A deliberate press that happens to land where a first repeat would: held back briefly, then fired.
  advance(520); P(); assert.equal(fired.length, 4, 'it waits a moment to see if repeats follow'); advance(120); assert.equal(fired.length, 5, 'no repeats followed, so it was a real press');
  // Pressing twice, with Ctrl+Shift held, at a steady rhythm: every press fires.
  fired.length = 0; advance(3000);
  for (let i = 0; i < 6; i++) { P(); advance(i % 2 ? 260 : 140); }
  assert.equal(fired.length, 6, 'six quick presses fire six times');
  // Impossible bounce is ignored
  advance(2000); P(); advance(10); P(); assert.equal(fired.length, 7, 'a 10 ms bounce is ignored');
  // Slow keyboard repeat settings still treat a held key as one press
  { const t2 = new Set(); let n2 = 1000; const f2 = [];
    const slow = createShortcutManager({ globalShortcut: { register: (a, fn) => { slow.fn = fn; return true; }, unregisterAll() {} }, onFire: (c) => f2.push(c), clock: () => n2, repeat: { delay: 1000, interval: 400 }, setTimer: (fn, ms) => { const t = { fn, at: n2 + ms }; t2.add(t); return t; }, clearTimer: (t) => t2.delete(t) });
    slow.setBindings([{ id: 's', accelerator: 'Ctrl+Alt+Shift+Space', command: 'sound.toggle' }]);
    const adv = (ms) => { n2 += ms; for (const t of [...t2]) if (t.at <= n2) { t2.delete(t); t.fn(); } };
    slow.fn(); adv(1000); slow.fn(); adv(400); slow.fn(); adv(400); slow.fn(); adv(1500);
    assert.equal(f2.length, 1, 'a held key on a slow-repeat keyboard fires once'); }
  // Reading the repeat settings from Windows
  { const prev = Object.getOwnPropertyDescriptor(process, 'platform'); Object.defineProperty(process, 'platform', { value: 'win32' });
    const reg = (d, sp) => (args) => `\r\nHKEY_CURRENT_USER\\Control Panel\\Keyboard\r\n    ${args[3]}    REG_SZ    ${args[3] === 'KeyboardDelay' ? d : sp}\r\n`;
    assert.deepEqual(readKeyboardRepeat(reg(1, 31)), { delay: 500, interval: 33 });
    assert.deepEqual(readKeyboardRepeat(reg(0, 0)), { delay: 250, interval: 400 });
    assert.deepEqual(readKeyboardRepeat(reg(3, 15)).delay, 1000);
    assert.deepEqual(readKeyboardRepeat(() => { throw new Error('no reg'); }), { delay: 500, interval: 33 });
    assert.deepEqual(readKeyboardRepeat(() => 'garbage'), { delay: 500, interval: 33 });
    Object.defineProperty(process, 'platform', prev); }
  now = 0; advance(100000); fired.length = 0;
  registered.get('CommandOrControl+Alt+Shift+Up')(); now += 90; registered.get('CommandOrControl+Alt+Shift+Up')(); assert.equal(fired.filter((c) => c === 'volume.up').length, 2, 'volume may repeat while a key is held');
  mgr.setEnabled(false);
  assert.deepEqual([...registered.keys()], ['CommandOrControl+Alt+Shift+G'], 'switching off keeps only the on/off shortcut');
  assert.match(mgr.results().find((x) => x.id === 'a').reason, /switched off/);
  mgr.setEnabled(true); assert.equal(registered.size, 4);
  mgr.setBindings(new Array(500).fill({ id: 'x', accelerator: 'F13', command: 'sound.play' }));
  mgr.dispose(); assert.equal(registered.size, 0);
}

// ---- window placement -----------------------------------------------------------------
{
  const one = [{ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } }];
  const two = [...one, { id: 2, workArea: { x: 1920, y: 0, width: 2560, height: 1400 } }];
  const fb = { width: 1180, height: 820 };
  let b = restoreBounds(null, one, 1, fb);
  assert.deepEqual([b.x, b.y, b.width, b.height], [370, 110, 1180, 820], 'first launch centers on the primary monitor');
  b = restoreBounds({ x: 2200, y: 100, width: 1000, height: 700, displayId: 2 }, two, 1, fb);
  assert.equal(b.displayId, 2); assert.equal(b.x, 2200, 'comes back on the second monitor, exactly where it was');
  b = restoreBounds({ x: 2200, y: 100, width: 1000, height: 700, displayId: 2 }, one, 1, fb);
  assert.equal(b.displayId, 1); assert.ok(b.x + 120 <= 1920 && b.x >= -1000, 'monitor unplugged: it moves to a visible place');
  b = restoreBounds({ x: 5000, y: 5000, width: 1000, height: 700, displayId: 9 }, one, 1, fb);
  assert.ok(b.x < 1920 && b.y < 1040, 'off-screen positions are pulled back on screen');
  b = restoreBounds({ x: 0, y: 0, width: 4000, height: 3000, displayId: 1 }, one, 1, fb);
  assert.ok(b.width <= 1920 && b.height <= 1040, 'oversized windows are fitted to the work area');
  b = restoreBounds({ x: 100, y: -300, width: 800, height: 600, displayId: 1 }, one, 1, fb);
  assert.ok(b.y >= 0, 'the title bar never ends up above the screen');
  b = restoreBounds({ x: 1900, y: 50, width: 800, height: 600, displayId: 1 }, two, 1, fb);
  assert.equal(b.displayId, 1); assert.ok(b.x >= 1920 - 800 + 120 - 1 - 1000);
  const c = compactDefault(two[1], { width: 460, height: 104 });
  assert.deepEqual([c.x, c.y], [1920 + 2560 - 460 - 20, 1400 - 104 - 20], 'the mini bar parks in the bottom-right corner');
}

// ---- settings -------------------------------------------------------------------------
{
  assert.deepEqual(sanitize(null), sanitize({}));
  const s = sanitize({ closeToTray: 'yes', startHidden: true, bounds: { x: 'a', y: 1, width: 10, height: 10 }, compactBounds: { x: 5, y: 6, displayId: 3 }, dark: 1, evil: { __proto__: { x: 1 } } });
  assert.equal(s.closeToTray, defaults.closeToTray, 'wrong types fall back to defaults'); assert.equal(s.startHidden, true);
  assert.equal(s.bounds, null, 'nonsense bounds are dropped'); assert.deepEqual(s.compactBounds, { x: 5, y: 6, displayId: 3 }); assert.equal(s.dark, false);
  assert.equal('evil' in s, false, 'unknown keys are not kept');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-settings-'));
  const a = createStore(dir); a.patch({ alwaysOnTop: true, bounds: { x: 10, y: 20, width: 900, height: 700, displayId: 2, maximized: true } }); a.flush();
  const b = createStore(dir);
  assert.equal(b.get().alwaysOnTop, true); assert.equal(b.get().bounds.displayId, 2); assert.equal(b.get().bounds.maximized, true);
  fs.writeFileSync(path.join(dir, 'settings.json'), '{broken');
  assert.deepEqual(createStore(dir).get(), sanitize({}), 'a corrupt settings file never blocks startup');
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---- installer vs app mode ---------------------------------------------------------------
{
  const base = { packaged: true, platform: 'win32', execPath: 'C:\\Temp\\x\\Study with Sarang.exe', exists: () => false };
  assert.equal(detect({ ...base, argv: ['a.exe'] }), 'setup', 'the downloaded exe opens the installer');
  assert.equal(detect({ ...base, argv: ['a.exe', '--uninstall'] }), 'uninstall');
  assert.equal(detect({ ...base, argv: ['a.exe', '--setup'] }), 'setup');
  assert.equal(detect({ ...base, argv: ['a.exe', '--portable'] }), 'app');
  assert.equal(detect({ ...base, argv: ['a.exe', '--login'] }), 'app', 'login launches never show the installer');
  assert.equal(detect({ ...base, argv: ['a.exe', '--cmd=sound.play'] }), 'app', 'Stream Deck commands never show the installer');
  assert.equal(detect({ ...base, argv: ['a.exe', 'study-with-sarang://cmd/sound.play'], exists: () => false }), 'setup', 'links only reach an installed copy');
  assert.equal(detect({ ...base, argv: ['a.exe'], exists: (p) => String(p).endsWith('install.json') }), 'app', 'an installed copy runs as the app');
  assert.equal(detect({ ...base, argv: ['a.exe'], windowsStore: true }), 'app', 'the Store build is never an installer');
  assert.equal(detect({ ...base, argv: ['a.exe'], packaged: false }), 'app', 'development runs the app');
  assert.equal(detect({ ...base, argv: ['a.exe'], platform: 'darwin' }), 'app');
  assert.equal(detect({ ...base, argv: ['a.exe'], platform: 'linux' }), 'app');
}

// ---- voice process protocol (fake PowerShell) ---------------------------------------------
async function voiceTests() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-voice-'));
  const events = [];
  let spawned = null; let killed = 0;
  const fakeSpawn = (cmd, args, options) => {
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stdout.setEncoding = () => {}; child.stderr = new EventEmitter();
    child.kill = () => { killed += 1; child.emit('exit', 0); };
    spawned = { cmd, args, options, child }; return child;
  };
  const v = createVoice({ dir, platform: 'win32', spawn: fakeSpawn, scriptSource: () => '# script ü', onEvent: (e) => events.push(e), readyTimeoutMs: 80 });
  assert.equal(v.supported, true);
  v.start({ languages: ['en'], phrases: { en: ['play'], de: [] }, wake: { en: 'Sarang', de: 'Sarang' }, useWake: true });
  assert.equal(spawned.cmd, 'powershell.exe');
  assert.ok(spawned.args.includes('-NoProfile') && spawned.args.includes('-NonInteractive') && spawned.args.includes('-File'));
  assert.equal(spawned.options.windowsHide, true, 'no console window flashes up');
  assert.equal(fs.readFileSync(path.join(dir, 'voice-listener.ps1'), 'utf8').charCodeAt(0), 0xfeff, 'script has a BOM so PowerShell reads UTF-8');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'voice-config.json'), 'utf8')).phrases.en, ['play']);
  assert.equal(events.at(-1).status, 'starting');
  // Lines split across chunks, several per chunk, junk and unknown types.
  spawned.child.stdout.emit('data', '{"type":"ready","language":"en","culture":"en-US"}\n{"type":"heard","te');
  spawned.child.stdout.emit('data', 'xt":"Sarang play","confidence":0.91}\nnot json\n{"type":"mystery"}\n{"type":"rejected"}\n');
  assert.equal(events.find((e) => e.status === 'listening').language, 'en');
  assert.deepEqual(events.find((e) => e.type === 'heard'), { type: 'heard', text: 'Sarang play', confidence: 0.91 });
  assert.ok(events.some((e) => e.type === 'rejected'));
  assert.equal(events.filter((e) => e.type === 'heard').length, 1);
  v.stop(); assert.equal(killed, 1); assert.equal(events.at(-1).status, 'off');
  // Error from the script is passed on and not overwritten by "off".
  events.length = 0;
  v.start({}); spawned.child.stdout.emit('data', '{"type":"error","code":"no-language","message":"Install an English or German speech language."}\n'); spawned.child.emit('exit', 3);
  assert.equal(events.at(-1).status, 'error'); assert.match(events.at(-1).message, /speech language/);
  // Never becomes ready: timeout error and the process is killed.
  events.length = 0; killed = 0;
  v.start({}); await new Promise((r) => setTimeout(r, 150));
  assert.equal(events.at(-1).code, 'timeout'); assert.equal(killed, 1);
  // Spawn failure.
  events.length = 0;
  v.start({}); spawned.child.emit('error', new Error('ENOENT'));
  assert.equal(events.at(-1).code, 'spawn');
  v.stop();
  // Unsupported platform.
  const mac = createVoice({ dir, platform: 'darwin', spawn: () => { throw new Error('must not spawn'); }, scriptSource: () => '', onEvent: (e) => events.push(e) });
  events.length = 0; assert.equal(mac.start({}), false); assert.equal(events.at(-1).status, 'unsupported');
  fs.rmSync(dir, { recursive: true, force: true });
}

// The PowerShell script must at least parse the way we expect (no PowerShell here, so check the contract).
{
  const ps = fs.readFileSync(path.join(E, 'voice-listener.ps1'), 'utf8');
  for (const needle of ['System.Speech', 'SetInputToDefaultAudioDevice', 'RecognizeAsync', "type = 'ready'", "type = 'heard'", "type = 'error'", 'ParentPid', 'ConvertTo-Json -Compress', 'GrammarBuilder']) assert.ok(ps.includes(needle), `voice script contains ${needle}`);
  assert.ok(!/Invoke-Expression|iex |DownloadString|Start-Process|WebClient|Invoke-WebRequest/i.test(ps), 'voice script runs nothing and makes no network calls');
  assert.equal((ps.match(/\{/g) || []).length, (ps.match(/\}/g) || []).length, 'balanced braces');
}

voiceTests().then(() => console.log('Verified command parsing and link safety, shortcut validation and manager, window placement across monitors, settings, installer mode detection and the voice process protocol.')).catch((error) => { console.error(error); process.exit(1); });
