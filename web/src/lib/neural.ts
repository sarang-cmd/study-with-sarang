/**
 * "Neural lock": an optional, gentle rhythm over your sound. Research on EEG and sustained attention (Woods et al., 2024) used music whose
 * loudness was modulated at certain rates, around 16 Hz for the most-cited result, and reported stronger stimulus-brain coupling and,
 * for some listeners, better sustained attention. This is a plain sine pulse on whatever you are playing: inspired by that work, not the
 * published stimuli, not tested for effects, and not a treatment. Off by default; depth and rate are yours to set.
 */
export interface NeuralSettings { on: boolean; rate: number; depth: number }
export const defaultNeural: NeuralSettings = { on: false, rate: 16, depth: 30 };
export const NEURAL_LIMITS = { rate: { min: 4, max: 40 }, depth: { min: 5, max: 60 } };
export interface NeuralPreset { id: string; label: string; rate: number; depth: number; hint: string }
export const NEURAL_PRESETS: NeuralPreset[] = [
  { id: 'gentle', label: 'Gentle 16 Hz', rate: 16, depth: 20, hint: 'The rate in the research, kept subtle. A good place to start.' },
  { id: 'study', label: 'Study 16 Hz', rate: 16, depth: 40, hint: 'The same rate, more noticeable.' },
  { id: 'slow', label: 'Slow 8 Hz', rate: 8, depth: 30, hint: 'A slower flutter. Some people find it softer.' },
  { id: 'fast', label: 'Fast 24 Hz', rate: 24, depth: 25, hint: 'Faster and finer, closer to a texture than a beat.' },
];
const clamp = (v: unknown, min: number, max: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : d);
export function sanitizeNeural(raw: unknown): NeuralSettings {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return { on: r.on === true, rate: clamp(r.rate, NEURAL_LIMITS.rate.min, NEURAL_LIMITS.rate.max, defaultNeural.rate), depth: clamp(r.depth, NEURAL_LIMITS.depth.min, NEURAL_LIMITS.depth.max, defaultNeural.depth) };
}
