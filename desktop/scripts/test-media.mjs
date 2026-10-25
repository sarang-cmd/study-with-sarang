import assert from 'node:assert/strict';
import { loadModule } from './_load.mjs';

const m = await loadModule('src/lib/mediaSession.ts');

// The gate: a key that arrives twice (session action and key press) counts once
m.resetMediaGate();
assert.equal(m.acceptMediaAction(1000), true);
assert.equal(m.acceptMediaAction(1100), false, 'a duplicate within 350 ms is dropped');
assert.equal(m.acceptMediaAction(1400), true, 'a later press counts');
assert.equal(m.acceptMediaAction(1500, 100), true, 'the window is adjustable');

// The silent track is a valid 8 kHz mono WAV containing only silence
const wav = m.silentWav(1);
const text = (o, n) => String.fromCharCode(...wav.slice(o, o + n));
assert.equal(text(0, 4), 'RIFF'); assert.equal(text(8, 4), 'WAVE'); assert.equal(text(36, 4), 'data');
const view = new DataView(wav.buffer);
assert.equal(view.getUint32(24, true), 8000); assert.equal(view.getUint16(22, true), 1); assert.equal(view.getUint16(34, true), 8);
assert.equal(view.getUint32(40, true), 8000); assert.equal(wav.length, 44 + 8000);
assert.ok([...wav.slice(44)].every((b) => b === 128), 'nothing to hear');

// The Media Session wiring, against a fake browser
const handlers = {}; const calls = [];
globalThis.navigator = { mediaSession: { metadata: null, playbackState: 'none', setActionHandler: (a, h) => { handlers[a] = h; } } };
globalThis.MediaMetadata = class { constructor(o) { Object.assign(this, o); } };
const el = { loop: false, paused: true, play() { this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; }, setAttribute() {} };
globalThis.document = {}; globalThis.Audio = function () { return el; }; globalThis.URL = { createObjectURL: () => 'blob:x' }; globalThis.Blob = class {};
const actions = { play: () => calls.push('play'), pause: () => calls.push('pause'), next: () => calls.push('next') };

m.resetMediaGate();
m.syncMediaSession(true, { playing: true, title: 'Flow' }, actions);
assert.equal(navigator.mediaSession.playbackState, 'playing'); assert.equal(navigator.mediaSession.metadata.title, 'Flow');
assert.equal(navigator.mediaSession.metadata.artist, 'Study with Sarang');
assert.equal(el.paused, false, 'the silent track plays while the sound plays, so the system sees a player');
assert.ok(handlers.play && handlers.pause && handlers.stop && handlers.nexttrack); assert.equal(handlers.previoustrack, null);
handlers.pause(); assert.deepEqual(calls, ['pause']);
handlers.play(); assert.deepEqual(calls, ['pause'], 'a second action inside the gate is ignored');
m.resetMediaGate(); handlers.nexttrack(); handlers.stop; assert.deepEqual(calls, ['pause', 'next']);

m.syncMediaSession(true, { playing: false, title: 'Flow' }, actions);
assert.equal(navigator.mediaSession.playbackState, 'paused'); assert.equal(el.paused, true, 'the track stops with the sound, so another player can take over');
assert.ok(handlers.play, 'the key can still resume this app while it was the latest player');

m.syncMediaSession(false, { playing: false, title: '' }, actions);
assert.equal(handlers.play, null); assert.equal(handlers.pause, null); assert.equal(handlers.nexttrack, null);
assert.equal(navigator.mediaSession.metadata, null); assert.equal(navigator.mediaSession.playbackState, 'none');

// No Media Session support: nothing throws
delete globalThis.navigator; globalThis.navigator = {};
m.syncMediaSession(true, { playing: true, title: 'x' }, actions);
console.log('Verified media keys: duplicate gate, silent track, Media Session wiring and teardown.');
