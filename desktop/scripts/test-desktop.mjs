import assert from 'node:assert/strict';
import { loadModule } from './_load.mjs';

// localStorage stand-in so the storage helpers run in Node.
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };

const cfg = await loadModule('src/lib/desktopConfig.ts');
const macros = await loadModule('src/lib/macros.ts');
const voice = await loadModule('src/lib/voice.ts');
const cmd = await loadModule('src/lib/commands.ts');

// ---- accelerators -----------------------------------------------------------------------
const ev = (code, o = {}) => ({ code, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });
assert.equal(cfg.eventToAccelerator(ev('KeyP', { ctrlKey: true, altKey: true, shiftKey: true }), false), 'CommandOrControl+Alt+Shift+P');
assert.equal(cfg.eventToAccelerator(ev('Space', { ctrlKey: true, altKey: true, shiftKey: true }), false), 'CommandOrControl+Alt+Shift+Space');
assert.equal(cfg.eventToAccelerator(ev('F13'), false), 'F13');
assert.equal(cfg.eventToAccelerator(ev('ArrowUp', { metaKey: true, altKey: true }), true), 'CommandOrControl+Alt+Up');
assert.equal(cfg.eventToAccelerator(ev('KeyA', { metaKey: true }), false), 'Super+A', 'the Windows key is Super off the Mac');
assert.equal(cfg.eventToAccelerator(ev('ControlLeft', { ctrlKey: true }), false), null, 'modifiers alone are not a shortcut');
assert.equal(cfg.eventToAccelerator(ev('Digit5', { ctrlKey: true }), false), 'CommandOrControl+5');
assert.equal(cfg.eventToAccelerator(ev('MediaPlayPause'), false), 'MediaPlayPause');
assert.equal(cfg.prettyAccelerator('CommandOrControl+Alt+Shift+Up', false), 'Ctrl + Alt + Shift + ↑');
assert.equal(cfg.prettyAccelerator('CommandOrControl+Alt+Shift+Up', true), '⌘ ⌥ ⇧ ↑');
assert.equal(cfg.prettyAccelerator('', false), 'Not set');

// Defaults: unique, three modifiers (no AltGr clash), the master switch always registered.
const accs = cfg.defaultBindings.map((b) => b.accelerator);
assert.equal(new Set(accs).size, accs.length, 'default shortcuts are unique');
assert.ok(cfg.defaultBindings.filter((b) => !cfg.isMediaBinding(b.id)).every((b) => b.accelerator.startsWith('CommandOrControl+Alt+Shift+')), 'defaults avoid Ctrl+Alt (AltGr)');
assert.deepEqual(cfg.defaultBindings.filter((b) => cfg.isMediaBinding(b.id)).map((b) => [b.accelerator, b.command]), [['MediaPlayPause', 'sound.toggle'], ['MediaNextTrack', 'sound.next'], ['MediaStop', 'sound.pause']], 'media keys control sound');
assert.ok(cfg.defaultBindings.find((b) => b.id === 'shortcuts.toggle').always, 'the on/off shortcut stays active while others are off');
for (const needed of ['sound.toggle', 'sound.play', 'sound.pause', 'shortcuts.toggle']) assert.ok(cfg.defaultBindings.some((b) => b.command === needed), `default for ${needed}`);

// Overrides survive a round trip and reject junk.
cfg.writeOverrides({ 'sound.play': 'F14', 'sound.next': '' });
const applied = cfg.applyOverrides(cfg.readOverrides());
assert.equal(applied.find((b) => b.id === 'sound.play').accelerator, 'F14');
assert.equal(applied.find((b) => b.id === 'sound.next').accelerator, '', 'cleared shortcuts stay cleared');
store.set('study-with-sarang:desktop-shortcuts', JSON.stringify({ '__proto__': 'x', 'bad id!': 'F1', 'sound.play': 5 }));
assert.deepEqual(cfg.readOverrides(), {}, 'junk overrides are ignored');
store.set('study-with-sarang:desktop-shortcuts', '{nope');
assert.deepEqual(cfg.readOverrides(), {});

// ---- commands -------------------------------------------------------------------------
assert.deepEqual(cmd.splitCommand('mix.load:Flow and rain'), { id: 'mix.load', arg: 'Flow and rain' });
assert.equal(cmd.commandLine('C:\\App\\a.exe', 'sound.toggle'), '"C:\\App\\a.exe" --cmd=sound.toggle');
assert.equal(cmd.commandLine('C:\\App\\a.exe', 'mix.load:Flow and rain'), '"C:\\App\\a.exe" --cmd="mix.load:Flow and rain"');
assert.equal(cmd.commandLink('mix.load:Flow and rain'), 'study-with-sarang://cmd/mix.load/Flow%20and%20rain');
assert.equal(cmd.commandLink('sound.toggle'), 'study-with-sarang://cmd/sound.toggle');
assert.equal(new Set(cmd.COMMANDS.map((c) => c.id)).size, cmd.COMMANDS.length);

// ---- macros ---------------------------------------------------------------------------
assert.equal(macros.starterMacros().length, 2);
const m = macros.sanitizeMacros([
  { id: 'a', name: '  Deep  ', steps: [{ type: 'mix', value: 'Flow' }, { type: 'volume', value: '900' }, { type: 'wait', value: '-5' }, { type: 'rm -rf', value: 'x' }, { type: 'play', value: 'ignored' }], shortcut: 'F15', voice: false },
  { id: 'a', name: 'Dup id', steps: [] },
  { name: '' }, null, 'x',
]);
assert.equal(m.length, 2, 'unnamed and invalid macros are dropped');
assert.equal(m[0].name, 'Deep'); assert.equal(m[0].voice, false);
assert.deepEqual(m[0].steps.map((s) => s.type), ['mix', 'volume', 'wait', 'play'], 'unknown step types are dropped');
assert.equal(m[0].steps[1].value, '100', 'volume is clamped'); assert.equal(m[0].steps[2].value, '1', 'wait is clamped'); assert.equal(m[0].steps[3].value, '', 'values of valueless steps are cleared');
assert.notEqual(m[0].id, m[1].id, 'duplicate ids are reissued');
assert.equal(macros.sanitizeMacros(Array.from({ length: 80 }, (_, i) => ({ name: `m${i}`, steps: Array.from({ length: 50 }, () => ({ type: 'play' })) }))).length, macros.MAX_MACROS);
assert.equal(macros.sanitizeMacros([{ name: 'x', steps: Array.from({ length: 50 }, () => ({ type: 'play' })) }])[0].steps.length, macros.MAX_STEPS);
assert.equal(macros.stepCommand({ type: 'mix', value: 'Flow' }), 'mix.load:Flow');
assert.equal(macros.stepCommand({ type: 'mix', value: '' }), null);
assert.equal(macros.stepCommand({ type: 'volume', value: '33' }), 'volume.set:33');
assert.equal(macros.stepCommand({ type: 'wait', value: '3' }), null, 'waits are handled by the runner');
assert.ok(macros.isWindowStep('window-hide') && !macros.isWindowStep('play'));
assert.equal(macros.describeStep({ type: 'wait', value: '9' }), 'Wait 9 s');
store.delete('study-with-sarang:macros');
assert.equal(macros.readMacros().length, 2, 'first run gets the starter macros');
macros.writeMacros([]);
assert.equal(macros.readMacros().length, 0, 'deleting every macro sticks');

// ---- voice ----------------------------------------------------------------------------
const entries = voice.buildVoiceEntries(['Flow', 'Rainy library', 'Flow', 'Bad;;name<script>'], ['Start Flow session']);
const commands = entries.map((e) => e.command);
assert.ok(commands.includes('sound.play') && commands.includes('sound.pause') && commands.includes('volume.up'));
assert.ok(commands.includes('mix.load:Rainy library') && commands.includes('macro.run:Start Flow session'));
assert.equal(commands.filter((c) => c === 'mix.load:Flow').length, 1, 'duplicate mix names are collapsed');
assert.ok(commands.includes('volume.set:40') && commands.includes('volume.set:100'));
assert.ok(!entries.some((e) => [...e.en, ...e.de].some((p) => /[;<>]/.test(p))), 'phrases only contain speakable characters');
assert.ok(entries.every((e) => e.en.length && e.de.length), 'every command has English and German phrases');

assert.equal(voice.matchHeard('Sarang play', entries, 'Sarang', true), 'sound.play');
assert.equal(voice.matchHeard('sarang STOP sound', entries, 'Sarang', true), 'sound.pause');
assert.equal(voice.matchHeard('play', entries, 'Sarang', true), null, 'the wake word is required by default');
assert.equal(voice.matchHeard('play', entries, 'Sarang', false), 'sound.play');
assert.equal(voice.matchHeard('Sarang play', entries, 'Sarang', false), 'sound.play', 'the wake word is tolerated when optional');
assert.equal(voice.matchHeard('Sarang volume forty', entries, 'Sarang', true), 'volume.set:40');
assert.equal(voice.matchHeard('Sarang load rainy library', entries, 'Sarang', true), 'mix.load:Rainy library');
assert.equal(voice.matchHeard('Sarang run start flow session', entries, 'Sarang', true), 'macro.run:Start Flow session');
assert.equal(voice.matchHeard('Sarang Lautstärke dreißig', entries, 'Sarang', true), 'volume.set:30', 'German phrases match too');
assert.equal(voice.matchHeard('Sarang Lautstaerke dreissig', entries, 'Sarang', true), null, 'spelling must match the grammar');
assert.equal(voice.matchHeard('Sarang make me a sandwich', entries, 'Sarang', true), null);
assert.equal(voice.matchHeard('', entries, 'Sarang', true), null);
assert.equal(voice.matchHeard('Computer play', entries, 'Computer', true), 'sound.play', 'custom wake word');
const vc = voice.buildVoiceConfig(entries, 'Sarang; DROP', true, 'auto');
assert.deepEqual(vc.languages, ['en', 'de']); assert.equal(vc.wake.en, 'Sarang DROP'); assert.ok(vc.phrases.en.includes('play'));
assert.deepEqual(voice.buildVoiceConfig(entries, '', true, 'de').languages, ['de']);
assert.equal(voice.buildVoiceConfig(entries, '', true, 'de').wake.de, 'Flow', 'empty wake word falls back');

console.log('Verified accelerators, default shortcuts, commands and links, macros (sanitizing, limits, steps) and voice phrases (English and German, wake word, matching).');
