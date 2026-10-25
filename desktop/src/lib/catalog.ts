/**
 * The sound catalog. Everything here is synthesized in the browser, with no
 * recordings and no network. The first ten layers and the first six bases keep
 * the exact recipes of the original Sarang.md focus studio, so Flow still sounds
 * like Flow. Later entries are new.
 */

export const layerIds = [
  // Original ten (order matters: it seeds each layer's random generator).
  'Rainfall', 'Distant thunder', 'Shore waves', 'Wind', 'Hearth', 'Birdsong', 'Crickets', 'Café', 'Soft bells', 'White noise',
  // New in Study with Sarang.
  'Brown noise', 'Pink noise', 'Box fan', 'Heavy rain', 'Stream', 'Waterfall', 'Night train', 'Airplane cabin',
  'Clock', 'Keyboard', 'Library hush', 'Singing bowls', 'Wind chimes', 'Deep space', 'Owl', 'Frogs',
] as const;
export type LayerId = typeof layerIds[number];

export const layerCategories = ['Water', 'Weather', 'Nature', 'Room', 'Machines', 'Tones', 'Noise'] as const;
export type LayerCategory = typeof layerCategories[number];

export interface LayerInfo { id: LayerId; category: LayerCategory; blurb: string; filter: [BiquadFilterType, number] }

const info = (id: LayerId, category: LayerCategory, filter: [BiquadFilterType, number], blurb: string): LayerInfo => ({ id, category, filter, blurb });

export const layers: LayerInfo[] = [
  info('Rainfall', 'Water', ['lowpass', 4200], 'Airy rain texture with small droplets'),
  info('Heavy rain', 'Water', ['lowpass', 6500], 'A dense downpour with a steady roar'),
  info('Stream', 'Water', ['lowpass', 5200], 'Quick, bubbling water over small stones'),
  info('Waterfall', 'Water', ['lowpass', 5200], 'A wide, soft wall of falling water'),
  info('Shore waves', 'Water', ['lowpass', 800], 'Slow swells of softly filtered surf'),
  info('Wind', 'Weather', ['bandpass', 900], 'Gentle gusts through a wide filter'),
  info('Distant thunder', 'Weather', ['lowpass', 180], 'Quiet, rolling low-frequency rumble'),
  info('Birdsong', 'Nature', ['highpass', 500], 'Sparse synthetic, two-note chirps'),
  info('Crickets', 'Nature', ['highpass', 1200], 'Light, rhythmic evening insects'),
  info('Frogs', 'Nature', ['bandpass', 520], 'A far-off pond chorus of soft croaks'),
  info('Owl', 'Nature', ['lowpass', 1400], 'Two slow hoots in the night air'),
  info('Hearth', 'Room', ['lowpass', 3300], 'Soft synthesized crackle and warmth'),
  info('Café', 'Room', ['lowpass', 850], 'Muffled room-tone and tiny clicks, no recorded voices'),
  info('Library hush', 'Room', ['lowpass', 3000], 'Dry air with the odd page turning'),
  info('Clock', 'Room', ['bandpass', 2200], 'A calm, even tick and tock'),
  info('Keyboard', 'Room', ['highpass', 900], 'Soft typing in short bursts, someone else working nearby'),
  info('Box fan', 'Machines', ['lowpass', 2600], 'A steady fan with a gentle blade pulse'),
  info('Night train', 'Machines', ['lowpass', 1600], 'Low rumble with a slow clickety rhythm'),
  info('Airplane cabin', 'Machines', ['lowpass', 900], 'The deep, even hum of a long flight'),
  info('Soft bells', 'Tones', ['lowpass', 2200], 'Occasional, fading harmonic tones'),
  info('Singing bowls', 'Tones', ['lowpass', 4200], 'Long, slowly beating bowl tones'),
  info('Wind chimes', 'Tones', ['lowpass', 7000], 'Light pentatonic chimes now and then'),
  info('Deep space', 'Tones', ['lowpass', 1200], 'A very low drone that slowly swells'),
  info('White noise', 'Noise', ['lowpass', 6000], 'An even, quiet noise bed'),
  info('Pink noise', 'Noise', ['lowpass', 9000], 'Softer than white noise, equal energy per octave'),
  info('Brown noise', 'Noise', ['lowpass', 2400], 'Deep, rounded noise like a distant roar'),
];

export const layerInfo = Object.fromEntries(layers.map((layer) => [layer.id, layer])) as Record<LayerId, LayerInfo>;

// ---------------------------------------------------------------------------
// Base environments (the big selector). Flow is the flagship.
// ---------------------------------------------------------------------------

export const baseIds = [
  'Stillness', 'Flow', 'Rain', 'Ocean', 'Library', 'Night',
  'Deep work', 'Dawn', 'Forest', 'Cabin', 'Drift', 'Haze',
] as const;
export type BaseId = typeof baseIds[number];
export const FLAGSHIP: BaseId = 'Flow';

export interface BaseRecipe {
  id: BaseId; blurb: string;
  tones: number[]; noiseCut: number; noiseGain: number;
  detail?: { type: BiquadFilterType; freq: number; gain: number };
  /** Multiplies how strongly the slow motion shapes the noise. */
  motion?: number;
}

export const bases: BaseRecipe[] = [
  { id: 'Stillness', blurb: 'Soft filtered air and low harmonic warmth', tones: [98, 146.83, 196], noiseCut: 260, noiseGain: .075 },
  { id: 'Flow', blurb: 'A gentle, shifting noise and layered tones', tones: [110, 165, 220], noiseCut: 440, noiseGain: .12 },
  { id: 'Rain', blurb: 'Textured droplets and a quiet distant hum', tones: [87.31, 130.81], noiseCut: 1100, noiseGain: .24, detail: { type: 'highpass', freq: 1650, gain: .045 } },
  { id: 'Ocean', blurb: 'Low rolling surf with slow motion', tones: [73.42, 110, 146.83], noiseCut: 310, noiseGain: .17, detail: { type: 'highpass', freq: 780, gain: .022 } },
  { id: 'Library', blurb: 'Dry room ambience and a minimal hum', tones: [130.81, 196], noiseCut: 710, noiseGain: .095, detail: { type: 'bandpass', freq: 430, gain: .022 } },
  { id: 'Night', blurb: 'Low, muted air with unhurried movement', tones: [65.41, 98, 130.81], noiseCut: 180, noiseGain: .06 },
  { id: 'Deep work', blurb: 'A low, wide bed for long, uninterrupted stretches', tones: [55, 82.5, 110], noiseCut: 150, noiseGain: .1, motion: .6 },
  { id: 'Dawn', blurb: 'Lighter and higher, like early morning air', tones: [130.81, 196, 261.63], noiseCut: 620, noiseGain: .08, detail: { type: 'highpass', freq: 2400, gain: .008 }, motion: 1.3 },
  { id: 'Forest', blurb: 'Soft rustle over a quiet, earthy hum', tones: [98, 146.83, 196], noiseCut: 520, noiseGain: .1, detail: { type: 'highpass', freq: 1200, gain: .02 }, motion: 1.4 },
  { id: 'Cabin', blurb: 'Warm and enclosed, with a low woody hum', tones: [82.41, 123.47], noiseCut: 360, noiseGain: .13, detail: { type: 'bandpass', freq: 520, gain: .03 } },
  { id: 'Drift', blurb: 'Slow, spacious tones that float and shift', tones: [110, 164.81, 246.94, 329.63], noiseCut: 300, noiseGain: .06, motion: 2.2 },
  { id: 'Haze', blurb: 'A soft, even wash that smooths out the room', tones: [174.61, 261.63], noiseCut: 2400, noiseGain: .085, detail: { type: 'highpass', freq: 3000, gain: .01 }, motion: .8 },
];

export const baseRecipe = Object.fromEntries(bases.map((base) => [base.id, base])) as Record<BaseId, BaseRecipe>;
