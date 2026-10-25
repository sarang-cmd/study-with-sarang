import { baseIds, layerIds } from './catalog';
import type { BaseId, LayerId } from './catalog';

export interface LayerSetting { level: number; pan: number; tone: number }
export interface Tune {
  /** 0 dark, 100 fully open. */ warmth: number;
  /** 0 off, 100 removes a lot of low end. */ lowcut: number;
  /** Reverb amount. */ space: number;
  /** Depth of the slow swell. */ breathing: number;
  breathRate: number;
  /** Stereo spread of the layers' pan settings. */ width: number;
  baseLevel: number; baseMotion: number; baseBright: number;
}
export interface MixState {
  name: string;
  base: BaseId;
  volume: number;
  tune: Tune;
  layers: Partial<Record<LayerId, LayerSetting>>;
}

export const defaultTune: Tune = { warmth: 100, lowcut: 0, space: 0, breathing: 0, breathRate: 40, width: 60, baseLevel: 100, baseMotion: 100, baseBright: 100 };
export const tuneRanges: Record<keyof Tune, [number, number]> = {
  warmth: [0, 100], lowcut: [0, 100], space: [0, 100], breathing: [0, 100], breathRate: [0, 100], width: [0, 100],
  baseLevel: [0, 150], baseMotion: [0, 250], baseBright: [30, 200],
};
export const defaultLayer: LayerSetting = { level: 0, pan: 0, tone: 0 };

export function defaultMix(): MixState {
  return { name: 'Flow', base: 'Flow', volume: 46, tune: { ...defaultTune }, layers: {} };
}

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;

export function layerSetting(mix: MixState, id: LayerId): LayerSetting { return mix.layers[id] ?? defaultLayer; }
export const activeLayers = (mix: MixState): LayerId[] => layerIds.filter((id) => (mix.layers[id]?.level ?? 0) > 0);

/** Accepts anything (imported files, share links, old storage) and returns a safe mix. */
export function sanitizeMix(raw: unknown, fallbackName = 'Imported mix'): MixState {
  const mix = defaultMix();
  mix.name = fallbackName;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return mix;
  const source = raw as Record<string, unknown>;
  if (typeof source.name === 'string' && source.name.trim()) mix.name = source.name.trim().slice(0, 60);
  if (typeof source.base === 'string' && (baseIds as readonly string[]).includes(source.base)) mix.base = source.base as BaseId;
  mix.volume = clamp(source.volume, 0, 100, mix.volume);
  if (source.tune && typeof source.tune === 'object' && !Array.isArray(source.tune)) {
    for (const key of Object.keys(defaultTune) as (keyof Tune)[]) {
      const [min, max] = tuneRanges[key];
      mix.tune[key] = clamp((source.tune as Record<string, unknown>)[key], min, max, defaultTune[key]);
    }
  }
  if (source.layers && typeof source.layers === 'object' && !Array.isArray(source.layers)) {
    for (const id of layerIds) {
      const entry = (source.layers as Record<string, unknown>)[id];
      // A bare number is accepted as shorthand for a level.
      const setting = typeof entry === 'number' ? { level: entry } : entry && typeof entry === 'object' ? entry as Record<string, unknown> : null;
      if (!setting) continue;
      const level = clamp(setting.level, 0, 100, 0);
      if (level > 0) mix.layers[id] = { level, pan: clamp(setting.pan, -100, 100, 0), tone: clamp(setting.tone, -100, 100, 0) };
    }
  }
  return mix;
}

/** Drops default values so exported files stay small and readable. */
export function compactMix(mix: MixState) {
  const tune: Partial<Tune> = {};
  for (const key of Object.keys(defaultTune) as (keyof Tune)[]) if (mix.tune[key] !== defaultTune[key]) tune[key] = mix.tune[key];
  const layers: Record<string, LayerSetting> = {};
  for (const id of activeLayers(mix)) layers[id] = mix.layers[id]!;
  return { name: mix.name, base: mix.base, volume: mix.volume, tune, layers };
}

export const mixesEqual = (a: MixState, b: MixState) => JSON.stringify(compactMix({ ...a, name: '' })) === JSON.stringify(compactMix({ ...b, name: '' }));

// ---------------------------------------------------------------------------
// Curated mixes
// ---------------------------------------------------------------------------

const L = (level: number, pan = 0, tone = 0): LayerSetting => ({ level, pan, tone });
function curated(name: string, base: BaseId, volume: number, layers: Partial<Record<LayerId, LayerSetting>>, tune: Partial<Tune> = {}): MixState {
  return { name, base, volume, tune: { ...defaultTune, ...tune }, layers };
}

export interface BuiltInMix { id: string; blurb: string; mix: MixState }
export const builtInMixes: BuiltInMix[] = [
  { id: 'builtin-flow', blurb: 'Pure Flow, exactly as it is. The flagship.', mix: curated('Flow', 'Flow', 46, {}) },
  { id: 'builtin-flow-rain', blurb: 'Flow under a light, steady rainfall.', mix: curated('Flow and rain', 'Flow', 46, { Rainfall: L(28, -25) }, { space: 12 }) },
  { id: 'builtin-flow-library', blurb: 'Flow with a hushed room and the occasional page.', mix: curated('Flow in the library', 'Flow', 44, { 'Library hush': L(34), Clock: L(10, 30) }, { space: 8 }) },
  { id: 'builtin-deep-work', blurb: 'Low, wide and steady for long stretches.', mix: curated('Deep work', 'Deep work', 44, { 'Brown noise': L(26), 'Airplane cabin': L(18) }, { lowcut: 8 }) },
  { id: 'builtin-rainy-library', blurb: 'Rain on the window, a quiet room inside.', mix: curated('Rainy library', 'Library', 46, { Rainfall: L(42, -30), 'Library hush': L(30, 25), 'Distant thunder': L(14) }, { space: 14 }) },
  { id: 'builtin-cafe-sprint', blurb: 'Café murmur and soft typing for a short, busy push.', mix: curated('Café sprint', 'Haze', 44, { Café: L(40, -20), Keyboard: L(22, 35), 'Pink noise': L(10) }) },
  { id: 'builtin-midnight', blurb: 'Late-night cram: dark, calm, almost no sparkle.', mix: curated('Midnight cram', 'Night', 40, { Crickets: L(22, -40), Owl: L(16, 45), Wind: L(18) }, { warmth: 62, space: 10 }) },
  { id: 'builtin-forest-morning', blurb: 'Birds, a stream and a rustling forest.', mix: curated('Forest morning', 'Forest', 44, { Birdsong: L(30, 30), Stream: L(34, -20), 'Wind chimes': L(10, 40) }, { space: 10, breathing: 14 }) },
  { id: 'builtin-cabin-snow', blurb: 'A warm cabin, a fire and wind outside.', mix: curated('Cabin in the snow', 'Cabin', 44, { Hearth: L(38, -15), Wind: L(26, 30), Clock: L(8) }, { warmth: 74 }) },
  { id: 'builtin-night-train', blurb: 'A long night train with a faint hum.', mix: curated('Night train', 'Drift', 42, { 'Night train': L(46), 'Airplane cabin': L(10) }, { space: 6 }) },
  { id: 'builtin-ocean-calm', blurb: 'Slow surf and soft bells far away.', mix: curated('Ocean calm', 'Ocean', 44, { 'Shore waves': L(44, 0), 'Soft bells': L(12, 35), Wind: L(12, -35) }, { space: 18, breathing: 12 }) },
  { id: 'builtin-noisy-room', blurb: 'Masks a loud space with steady, even noise.', mix: curated('Noisy room shield', 'Haze', 46, { 'Pink noise': L(40), 'Brown noise': L(30), 'Box fan': L(24) }, { lowcut: 6 }) },
  { id: 'builtin-exam-hall', blurb: 'Dry, quiet, a ticking clock. Practice for the real thing.', mix: curated('Exam hall', 'Library', 36, { Clock: L(36), 'Library hush': L(20) }) },
  { id: 'builtin-space-focus', blurb: 'A deep, slowly swelling drone.', mix: curated('Deep space focus', 'Deep work', 42, { 'Deep space': L(44), 'Singing bowls': L(14, 20) }, { space: 24, breathing: 20, breathRate: 18 }) },
];

// ---------------------------------------------------------------------------
// Saved mixes (browser storage) and files
// ---------------------------------------------------------------------------

export interface SavedMix { id: string; name: string; favorite: boolean; createdAt: string; updatedAt: string; mix: MixState }

const SAVED_KEY = 'study-with-sarang:mixes';
const CURRENT_KEY = 'study-with-sarang:current';
export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function sanitizeSavedMixes(raw: unknown): SavedMix[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: SavedMix[] = [];
  for (const entry of raw.slice(0, 200)) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const mix = sanitizeMix(item.mix ?? item, typeof item.name === 'string' ? item.name : 'Saved mix');
    const name = (typeof item.name === 'string' && item.name.trim() ? item.name.trim() : mix.name).slice(0, 60);
    let id = typeof item.id === 'string' && item.id ? item.id.slice(0, 80) : newId();
    if (seen.has(id)) id = newId();
    seen.add(id);
    const now = new Date().toISOString();
    result.push({ id, name, favorite: item.favorite === true, createdAt: typeof item.createdAt === 'string' ? item.createdAt : now, updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now, mix: { ...mix, name } });
  }
  return result;
}

export function readSavedMixes(): SavedMix[] {
  try { return sanitizeSavedMixes(JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')); } catch { return []; }
}
export function writeSavedMixes(mixes: SavedMix[]): boolean {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(mixes)); return true; } catch { return false; }
}

export interface CurrentState { mix: MixState; seed: number; activeId: string | null }
export function readCurrent(): CurrentState | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CURRENT_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    const source = raw as Record<string, unknown>;
    return { mix: sanitizeMix(source.mix, 'Flow'), seed: clamp(source.seed, 1, 2147483646, 1597), activeId: typeof source.activeId === 'string' ? source.activeId : null };
  } catch { return null; }
}
export function writeCurrent(state: CurrentState) { try { localStorage.setItem(CURRENT_KEY, JSON.stringify({ mix: compactMix(state.mix), seed: state.seed, activeId: state.activeId })); } catch { /* Not persisted this visit. */ } }

export const FILE_APP = 'study-with-sarang';
export type FileKind = 'mix' | 'mixes' | 'backup';
export function envelope(kind: FileKind, body: Record<string, unknown>) {
  return { app: FILE_APP, kind, version: 1, exportedAt: new Date().toISOString(), ...body };
}
export const mixFile = (mix: MixState) => envelope('mix', { mix: compactMix(mix) });
export const mixesFile = (mixes: SavedMix[]) => envelope('mixes', { mixes: mixes.map((item) => ({ id: item.id, name: item.name, favorite: item.favorite, createdAt: item.createdAt, updatedAt: item.updatedAt, mix: compactMix(item.mix) })) });

export type ParsedImport =
  | { kind: 'mix'; mix: MixState }
  | { kind: 'mixes'; mixes: SavedMix[] }
  | { kind: 'backup'; mixes: SavedMix[]; raw: Record<string, unknown> }
  | { kind: 'sessions'; sessions: unknown }
  | { kind: 'error'; message: string };

/** Understands this app's files and also a bare mix object, so hand-written JSON works. */
export function parseImport(text: string): ParsedImport {
  if (text.length > 5_000_000) return { kind: 'error', message: 'That file is larger than 5 MB, which is too large for a mix or backup.' };
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { kind: 'error', message: 'That file is not valid JSON.' }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { kind: 'error', message: 'Expected a JSON object.' };
  const object = data as Record<string, unknown>;
  if (object.kind === 'sessions' && Array.isArray(object.sessions)) return { kind: 'sessions', sessions: object.sessions };
  if (object.kind === 'backup') return { kind: 'backup', mixes: sanitizeSavedMixes(object.mixes), raw: object };
  if (object.kind === 'mixes' || Array.isArray(object.mixes)) return { kind: 'mixes', mixes: sanitizeSavedMixes(object.mixes) };
  if (object.mix && typeof object.mix === 'object') return { kind: 'mix', mix: sanitizeMix(object.mix) };
  if ('base' in object || 'layers' in object || 'tune' in object) return { kind: 'mix', mix: sanitizeMix(object) };
  return { kind: 'error', message: 'This does not look like a Study with Sarang mix or backup.' };
}

// Share links: #mix=<base64url of the compact JSON>
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((encoded.length + 3) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}
export function encodeShare(mix: MixState): string { return toBase64Url(JSON.stringify(compactMix(mix))); }
export function decodeShare(encoded: string): MixState | null {
  if (!encoded || encoded.length > 8000) return null;
  try {
    const mix = sanitizeMix(JSON.parse(fromBase64Url(encoded)), 'Shared mix');
    return mix;
  } catch { return null; }
}
export function shareURL(mix: MixState): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#mix=${encodeShare(mix)}`;
}

/** Quick random blends: three layers from different families, plus a random base. */
export function surpriseMix(current: MixState): MixState {
  const pools: LayerId[][] = [
    ['Rainfall', 'Heavy rain', 'Stream', 'Waterfall', 'Shore waves'],
    ['Wind', 'Distant thunder', 'Birdsong', 'Crickets', 'Frogs', 'Owl'],
    ['Hearth', 'Café', 'Library hush', 'Clock', 'Keyboard', 'Box fan', 'Night train', 'Airplane cabin'],
    ['Soft bells', 'Singing bowls', 'Wind chimes', 'Deep space', 'Pink noise', 'Brown noise'],
  ];
  const chosen = [...pools].sort(() => Math.random() - .5).slice(0, 3).map((pool) => pool[Math.floor(Math.random() * pool.length)]);
  const layers: MixState['layers'] = {};
  for (const id of chosen) layers[id] = { level: 18 + Math.floor(Math.random() * 30), pan: Math.floor(Math.random() * 71) - 35, tone: 0 };
  return { ...current, layers, name: 'Surprise mix' };
}
