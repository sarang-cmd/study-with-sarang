import assert from 'node:assert/strict';
import { loadModule } from './_load.mjs';

const mixLib = await loadModule('src/lib/mix.ts');
const { defaultMix, sanitizeMix, compactMix, parseImport, mixFile, mixesFile, encodeShare, decodeShare, builtInMixes, sanitizeSavedMixes, mixesEqual, defaultTune, surpriseMix, activeLayers } = mixLib;
const { layerIds, baseIds } = await loadModule('src/lib/catalog.ts');

// Defaults and clamping
const base = defaultMix();
assert.equal(base.base, 'Flow'); assert.deepEqual(base.tune, defaultTune);
const wild = sanitizeMix({ name: ' x'.repeat(80), base: 'Nope', volume: 900, tune: { warmth: -5, baseMotion: 9999, space: 'x', evil: 1 }, layers: { Rainfall: { level: 500, pan: -999, tone: 3.6 }, Fake: { level: 50 }, Owl: 25, Wind: { level: 0, pan: 40 } } });
assert.equal(wild.base, 'Flow'); assert.equal(wild.volume, 100); assert(wild.name.length <= 60);
assert.equal(wild.tune.warmth, 0); assert.equal(wild.tune.baseMotion, 250); assert.equal(wild.tune.space, defaultTune.space); assert(!('evil' in wild.tune));
assert.deepEqual(wild.layers.Rainfall, { level: 100, pan: -100, tone: 4 });
assert.deepEqual(wild.layers.Owl, { level: 25, pan: 0, tone: 0 });
assert(!('Fake' in wild.layers) && !('Wind' in wild.layers), 'unknown and silent layers are dropped');
for (const junk of [null, 5, 'a', [], {}, { layers: [] }, { tune: 'x' }]) assert.doesNotThrow(() => sanitizeMix(junk));

// Prototype pollution safety
sanitizeMix(JSON.parse('{"__proto__":{"polluted":true},"layers":{"__proto__":{"level":50}}}'));
assert.equal({}.polluted, undefined);

// Built-in mixes are valid and unique
assert(builtInMixes.length >= 12);
assert.equal(new Set(builtInMixes.map((m) => m.id)).size, builtInMixes.length);
assert.equal(builtInMixes[0].mix.name, 'Flow'); assert.deepEqual(builtInMixes[0].mix.layers, {});
assert.deepEqual(builtInMixes[0].mix.tune, defaultTune, 'the Flow mix is untouched Flow');
for (const item of builtInMixes) {
  assert(baseIds.includes(item.mix.base), item.id);
  assert.deepEqual(sanitizeMix(item.mix, item.mix.name), item.mix, `${item.id} must survive sanitizing unchanged`);
}

// File round trips
const custom = sanitizeMix({ name: 'My mix', base: 'Dawn', volume: 33, tune: { space: 40, breathing: 20 }, layers: { Rainfall: { level: 40, pan: -20, tone: 10 }, 'Singing bowls': { level: 15, pan: 30, tone: -40 } } });
const file = JSON.parse(JSON.stringify(mixFile(custom)));
assert.equal(file.app, 'study-with-sarang'); assert.equal(file.kind, 'mix');
const parsed = parseImport(JSON.stringify(file));
assert.equal(parsed.kind, 'mix'); assert.deepEqual(parsed.mix, custom);
const bare = parseImport(JSON.stringify(compactMix(custom)));
assert.equal(bare.kind, 'mix'); assert.deepEqual(bare.mix, custom);
const saved = sanitizeSavedMixes([{ id: 'a', name: 'A', mix: custom }, { id: 'a', name: 'dup', mix: custom }, 'junk']);
assert.equal(saved.length, 2); assert.notEqual(saved[0].id, saved[1].id, 'duplicate ids are repaired');
const many = parseImport(JSON.stringify(mixesFile(saved)));
assert.equal(many.kind, 'mixes'); assert.equal(many.mixes.length, 2);
assert.equal(parseImport('not json').kind, 'error'); assert.equal(parseImport('[]').kind, 'error'); assert.equal(parseImport('{"hello":1}').kind, 'error');
assert.equal(parseImport(JSON.stringify({ app: 'study-with-sarang', kind: 'backup', mixes: [{ name: 'B', mix: custom }], sessions: [] })).kind, 'backup');
assert.equal(parseImport(JSON.stringify({ kind: 'sessions', sessions: [] })).kind, 'sessions');
assert.equal(parseImport('x'.repeat(5_000_001)).kind, 'error');

// Share links
global.window = { location: { origin: 'https://example.test', pathname: '/study/' } };
const encoded = encodeShare(custom);
assert(/^[A-Za-z0-9_-]+$/.test(encoded), 'share payload is URL safe');
assert.deepEqual(decodeShare(encoded), { ...custom, name: 'My mix' });
const unicode = sanitizeMix({ ...custom, name: 'Café Ōsaka ☕' });
assert.equal(decodeShare(encodeShare(unicode)).name, 'Café Ōsaka ☕');
assert.equal(decodeShare('!!!'), null); assert.equal(decodeShare(''), null); assert.equal(decodeShare('a'.repeat(9000)), null);
assert(encoded.length < 800, `a typical share link stays short (${encoded.length})`);
const heavy = sanitizeMix({ name: 'All', base: 'Drift', layers: Object.fromEntries(layerIds.map((id) => [id, { level: 20, pan: 10, tone: -10 }])) });
assert(decodeShare(encodeShare(heavy)) !== null, 'a mix with all 26 layers still fits in a share link');

// Equality and surprise
assert(mixesEqual(custom, { ...custom, name: 'Different name' }));
assert(!mixesEqual(custom, { ...custom, volume: 34 }));
for (let i = 0; i < 40; i++) { const s = surpriseMix(base); assert.equal(activeLayers(s).length, 3); assert.deepEqual(s.tune, base.tune); }

console.log('Verified mix sanitizing, built-in mixes, JSON round trips, backups, share links and prototype safety.');
