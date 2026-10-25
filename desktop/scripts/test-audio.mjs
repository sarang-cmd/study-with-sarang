import assert from 'node:assert/strict';
import { loadModule } from './_load.mjs';

const { makeSoundBuffer, levelToGain, MAX_BOOST } = await loadModule('src/lib/synth.ts');
const { layerIds, layers, bases, baseIds, layerCategories } = await loadModule('src/lib/catalog.ts');

assert.equal(layerIds.length, 26, 'expected 26 layers');
assert.equal(new Set(layerIds).size, layerIds.length, 'layer ids must be unique');
assert.equal(layers.length, layerIds.length, 'every layer needs catalog info');
for (const layer of layers) assert(layerCategories.includes(layer.category), `${layer.id} has an unknown category`);
assert.equal(baseIds.length, 12, 'expected 12 bases');
assert.equal(bases.length, baseIds.length);
assert.deepEqual(layerIds.slice(0, 10), ['Rainfall', 'Distant thunder', 'Shore waves', 'Wind', 'Hearth', 'Birdsong', 'Crickets', 'Café', 'Soft bells', 'White noise'], 'original layer order seeds the generators and must not change');
const flow = bases.find((base) => base.id === 'Flow');
assert.deepEqual([flow.tones, flow.noiseCut, flow.noiseGain], [[110, 165, 220], 440, .12], 'Flow recipe must match the original');

const sampleRate = 8000;
const fingerprints = new Map();
for (const sound of layerIds) {
  let data;
  const context = { sampleRate, createBuffer: (_c, size) => { data = new Float32Array(size); return { getChannelData: () => data }; } };
  makeSoundBuffer(context, sound, 20260926);
  assert.equal(data.length, 8 * sampleRate, `${sound} should be an 8-second loop`);
  assert(data[0] === 0, `${sound} should start silently`);
  assert(data.at(-1) === 0, `${sound} should end silently`);
  assert(data.every(Number.isFinite), `${sound} must contain only finite samples`);
  const peak = data.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
  assert(peak > .5 && peak <= .721, `${sound} should be normalized to a bounded peak, got ${peak}`);
  const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
  assert(rms > .005, `${sound} must not be effectively silent (rms ${rms})`);
  // A buffer that is the same every seed would make "Next variation" pointless.
  let other;
  const context2 = { sampleRate, createBuffer: (_c, size) => { other = new Float32Array(size); return { getChannelData: () => other }; } };
  makeSoundBuffer(context2, sound, 777);
  let differences = 0;
  for (let i = 0; i < data.length; i += 7) if (Math.abs(data[i] - other[i]) > 1e-6) differences++;
  assert(differences > 50, `${sound} should differ between variations`);
  // Fingerprint to prove sounds are distinct from each other.
  const fingerprint = Array.from({ length: 24 }, (_, i) => data[Math.floor(i * data.length / 24)].toFixed(3)).join(',');
  assert(!fingerprints.has(fingerprint), `${sound} duplicates ${fingerprints.get(fingerprint)}`);
  fingerprints.set(fingerprint, sound);
}
console.log(`Verified ${layerIds.length} procedural layers: 8 s loops, silent seams, finite samples, bounded peaks, audible, distinct, varied by seed.`);

// Master volume: 0 is silent, rising, 100% is louder than the old straight line, and it stays gentle at low settings.
assert.equal(levelToGain(0), 0);
let last = -1; for (let i = 0; i <= 100; i++) { const g = levelToGain(i / 100); assert(g > last || i === 0, 'volume must rise with the slider'); last = g; }
assert(levelToGain(1) >= 2.4 && levelToGain(1) <= 2.8, '100% should be about +8 dB over unity');
assert(levelToGain(.25) < 0.6 && levelToGain(.5) < 1.0, 'low settings stay quiet');
assert.equal(MAX_BOOST, 1.6);
assert.equal(levelToGain(2), levelToGain(1), 'clamped above 100%');
console.log('Verified master volume curve.');
