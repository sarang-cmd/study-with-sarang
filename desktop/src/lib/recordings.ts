/**
 * Real recordings for the ten classic ambience sounds (rain, thunder, waves, wind, fire, birds, crickets, coffee shop,
 * singing bowl, white noise). Each one replaces the generated sound of the same name as soon as a file for it exists.
 * Until then, or whenever a file cannot be loaded, the generated sound keeps playing, so nothing ever goes silent.
 *
 * Where a file can come from, tried in this order (Settings > Sounds can narrow it down):
 *   1. Your own file for that slot (picked in Settings > Sounds, stored in this browser or this computer)
 *   2. Desktop only: a file in the "sounds" folder of the app's data folder, named like the slot (rain.mp3, ...)
 *   3. Bundled: public/sounds/<file>, listed in sounds/manifest.json when the app was built
 *   4. Cloud: <your base address>/<file>, downloaded once and kept for offline use
 *   5. The generated sound
 */
import type { LayerId } from './catalog';

export interface SlotDef { id: string; layer: LayerId; label: string; file: string }
export const SLOTS: SlotDef[] = [
  { id: 'rain', layer: 'Rainfall', label: 'Rain', file: 'rain.mp3' },
  { id: 'thunder', layer: 'Distant thunder', label: 'Thunder', file: 'thunder.mp3' },
  { id: 'waves', layer: 'Shore waves', label: 'Waves', file: 'waves.mp3' },
  { id: 'wind', layer: 'Wind', label: 'Wind', file: 'wind.mp3' },
  { id: 'fire', layer: 'Hearth', label: 'Fire', file: 'fire.mp3' },
  { id: 'birds', layer: 'Birdsong', label: 'Birds', file: 'birds.mp3' },
  { id: 'crickets', layer: 'Crickets', label: 'Crickets', file: 'crickets.mp3' },
  { id: 'coffee-shop', layer: 'Café', label: 'Coffee shop', file: 'coffee-shop.mp3' },
  { id: 'singing-bowl', layer: 'Singing bowls', label: 'Singing bowl', file: 'singing-bowl.mp3' },
  { id: 'white-noise', layer: 'White noise', label: 'White noise', file: 'white-noise.mp3' },
];
export const slotByLayer = (layer: string) => SLOTS.find((slot) => slot.layer === layer);
export const slotById = (id: string) => SLOTS.find((slot) => slot.id === id);
export const AUDIO_EXTENSIONS = ['mp3', 'ogg', 'wav', 'flac', 'm4a', 'aac', 'opus', 'webm'] as const;

export type RecSource = 'auto' | 'bundled' | 'cloud' | 'generated';
export type RecOrigin = 'custom' | 'folder' | 'bundled' | 'cloud';
export interface RecSettings {
  source: RecSource;
  cloudBase: string;     // Where to download from, for example https://example.com/sounds
  crossfade: number;     // Seconds blended at the loop point so a loop has no seam
  normalize: boolean;    // Bring every recording to a similar loudness
  mono: boolean;         // Keep memory use low: ~10 MB per minute instead of ~20
  keep: number;          // How many decoded recordings to hold in memory at once
}
export const defaultRec: RecSettings = { source: 'auto', cloudBase: '', crossfade: 3, normalize: true, mono: true, keep: 5 };

export function sanitizeRec(raw: unknown): RecSettings {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown, fallback: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback);
  const base = typeof r.cloudBase === 'string' ? normalizeBase(r.cloudBase) : '';
  return {
    source: r.source === 'bundled' || r.source === 'cloud' || r.source === 'generated' ? r.source : 'auto',
    cloudBase: base,
    crossfade: Math.round(num(r.crossfade, defaultRec.crossfade, 0, 10) * 10) / 10,
    normalize: typeof r.normalize === 'boolean' ? r.normalize : defaultRec.normalize,
    mono: typeof r.mono === 'boolean' ? r.mono : defaultRec.mono,
    keep: Math.round(num(r.keep, defaultRec.keep, 1, 10)),
  };
}

/** A folder address on the web, without a trailing slash. Only https (or http on this computer) is accepted. */
export function normalizeBase(input: string): string {
  const text = input.trim().replace(/\/+$/, '');
  if (!text) return '';
  try {
    const url = new URL(text);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(url.hostname))) return url.href.replace(/\/+$/, '');
  } catch { /* Not an address. */ }
  return '';
}

// ---------------------------------------------------------------------------
// Signal processing. Plain arrays, so it is fully testable without an audio device.
// ---------------------------------------------------------------------------

/**
 * Blends the end of a recording into its beginning so that, when it loops, there is no click or jump.
 * The result is `seconds` shorter than the input (the overlap becomes the first part of the output).
 */
export function crossfadeLoop(channels: Float32Array[], sampleRate: number, seconds: number): Float32Array[] {
  const length = channels[0]?.length ?? 0;
  const wanted = Math.round(seconds * sampleRate);
  const fade = Math.max(0, Math.min(wanted, Math.floor(length / 3)));
  if (fade < 16) return channels.map((channel) => channel.slice());
  return channels.map((input) => {
    const out = new Float32Array(length - fade);
    for (let i = 0; i < out.length; i++) out[i] = input[i];
    for (let i = 0; i < fade; i++) {
      const t = (i + 1) / (fade + 1);
      // Equal power: the beginning rises while the tail that would have followed the loop point falls.
      out[i] = input[i] * Math.sin(t * Math.PI / 2) + input[length - fade + i] * Math.cos(t * Math.PI / 2);
    }
    return out;
  });
}

export function rms(channels: Float32Array[]): number {
  let sum = 0, count = 0;
  for (const channel of channels) { const step = Math.max(1, Math.floor(channel.length / 200000)); for (let i = 0; i < channel.length; i += step) { sum += channel[i] * channel[i]; count++; } }
  return count ? Math.sqrt(sum / count) : 0;
}
export function peak(channels: Float32Array[]): number {
  let max = 0;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) { const v = Math.abs(channel[i]); if (v > max) max = v; }
  return max;
}

/** Target loudness for recordings, chosen to sit where the generated sounds sit (see scripts/test-recordings.mjs). */
export const TARGET_RMS = 0.14;
/** Scales a recording towards the target loudness, never past a safe peak and never by more than 12 dB either way. */
export function normalizeGain(channels: Float32Array[], target = TARGET_RMS): number {
  const level = rms(channels), top = peak(channels);
  if (level < 1e-5 || top < 1e-5) return 1;
  const wanted = target / level;
  return Math.max(0.25, Math.min(4, wanted, 0.98 / top));
}

export function toMono(channels: Float32Array[]): Float32Array[] {
  if (channels.length <= 1) return channels;
  const length = channels[0].length, out = new Float32Array(length);
  for (const channel of channels) for (let i = 0; i < length; i++) out[i] += channel[i] / channels.length;
  return [out];
}

/** Everything done to decoded audio before it plays. Returns new channel data. */
export function prepare(channels: Float32Array[], sampleRate: number, settings: Pick<RecSettings, 'crossfade' | 'normalize' | 'mono'>): Float32Array[] {
  let data = settings.mono ? toMono(channels) : channels.map((channel) => channel.slice());
  if (settings.normalize) { const gain = normalizeGain(data); if (gain !== 1) for (const channel of data) for (let i = 0; i < channel.length; i++) channel[i] *= gain; }
  data = crossfadeLoop(data, sampleRate, settings.crossfade);
  return data;
}

// ---------------------------------------------------------------------------
// Storage of your own files and of downloaded ones (IndexedDB, with an in-memory stand-in for tests).
// ---------------------------------------------------------------------------

export interface FileStore {
  get(key: string): Promise<{ name: string; bytes: ArrayBuffer } | null>;
  put(key: string, value: { name: string; bytes: ArrayBuffer }): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}
export function memoryStore(): FileStore {
  const map = new Map<string, { name: string; bytes: ArrayBuffer }>();
  return {
    get: async (key) => map.get(key) ?? null,
    put: async (key, value) => { map.set(key, value); },
    remove: async (key) => { map.delete(key); },
    keys: async () => [...map.keys()],
  };
}
export function indexedDbStore(name: string): FileStore {
  let opened: Promise<IDBDatabase> | null = null;
  const open = () => (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
  const run = async <T,>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => { const request = fn(db.transaction('files', mode).objectStore('files')); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  };
  return {
    get: async (key) => { try { return ((await run('readonly', (store) => store.get(key))) as { name: string; bytes: ArrayBuffer } | undefined) ?? null; } catch { return null; } },
    put: async (key, value) => { await run('readwrite', (store) => store.put(value, key)); },
    remove: async (key) => { try { await run('readwrite', (store) => store.delete(key)); } catch { /* Nothing to remove. */ } },
    keys: async () => { try { return (await run('readonly', (store) => store.getAllKeys())).map(String); } catch { return []; } },
  };
}

// ---------------------------------------------------------------------------
// The loader.
// ---------------------------------------------------------------------------

export interface ManifestEntry { slot: string; file: string; title?: string; author?: string; license?: string; url?: string; freesoundId?: number; seconds?: number }
export interface Manifest { version: number; files: ManifestEntry[] }
export type SlotState = { state: 'idle' | 'loading' | 'ready' | 'missing'; origin?: RecOrigin; name?: string; seconds?: number; error?: string };

export interface Env {
  decode: (bytes: ArrayBuffer) => Promise<{ sampleRate: number; channels: Float32Array[] }>;
  make: (channels: Float32Array[], sampleRate: number) => AudioBuffer;
  fetchBytes: (url: string) => Promise<ArrayBuffer | null>;
  readFolder?: (slot: string) => Promise<{ name: string; bytes: ArrayBuffer } | null>;
  custom: FileStore;
  cache: FileStore;
  base: string;          // Where the app's own files live, for sounds/manifest.json and sounds/<file>
}

let env: Env | null = null;
let settings: RecSettings = { ...defaultRec };
let manifest: Manifest | null = null;
let manifestTried = false;
const buffers = new Map<string, AudioBuffer>();
const states = new Map<string, SlotState>();
const order: string[] = [];           // Most recently used last, for keeping memory in check
const inflight = new Map<string, Promise<void>>();
const tokens = new Map<string, number>();
let counter = 0;
let version = 0;
const listeners = new Set<() => void>();

const emit = () => { version++; listeners.forEach((listener) => listener()); };
export const subscribeRecordings = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const recordingsVersion = () => version;
export const getRecSettings = () => settings;
export const getManifest = () => manifest;
export function slotState(slot: string): SlotState { return states.get(slot) ?? { state: 'idle' }; }

export function configureRecordings(next: Env | null) { env = next; manifest = null; manifestTried = false; clearRecordings(); }
export function setRecSettings(next: RecSettings) {
  const reload = next.source !== settings.source || next.cloudBase !== settings.cloudBase || next.crossfade !== settings.crossfade
    || next.normalize !== settings.normalize || next.mono !== settings.mono;
  settings = next;
  if (reload) clearRecordings();
}
export function clearRecordings(slot?: string) {
  for (const key of slot ? [slot] : [...buffers.keys(), ...states.keys()]) { buffers.delete(key); states.delete(key); inflight.delete(key); tokens.delete(key); const at = order.indexOf(key); if (at >= 0) order.splice(at, 1); }
  emit();
}

async function loadManifest(): Promise<Manifest | null> {
  if (manifestTried || !env) return manifest;
  manifestTried = true;
  try {
    const bytes = await env.fetchBytes(`${env.base}sounds/manifest.json`);
    if (bytes) {
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Manifest>;
      manifest = { version: 1, files: Array.isArray(parsed.files) ? parsed.files.filter((entry): entry is ManifestEntry => Boolean(entry && typeof entry.slot === 'string' && typeof entry.file === 'string')) : [] };
    }
  } catch { manifest = null; }
  return manifest;
}
export const ensureManifest = () => loadManifest().then(() => { emit(); return manifest; });

async function findBytes(slot: SlotDef): Promise<{ origin: RecOrigin; name: string; bytes: ArrayBuffer } | null> {
  const e = env!;
  if (settings.source === 'generated') return null;
  const custom = await e.custom.get(slot.id);
  if (custom) return { origin: 'custom', name: custom.name, bytes: custom.bytes };
  const folder = await e.readFolder?.(slot.id).catch(() => null);
  if (folder) return { origin: 'folder', name: folder.name, bytes: folder.bytes };
  if (settings.source !== 'cloud') {
    const entry = (await loadManifest())?.files.find((file) => file.slot === slot.id);
    if (entry) {
      const bytes = await e.fetchBytes(`${e.base}sounds/${entry.file}`).catch(() => null);
      if (bytes) return { origin: 'bundled', name: entry.file, bytes };
    }
  }
  if (settings.source !== 'bundled' && settings.cloudBase) {
    const url = `${settings.cloudBase}/${slot.file}`;
    const cached = await e.cache.get(url);
    if (cached) return { origin: 'cloud', name: slot.file, bytes: cached.bytes };
    const bytes = await e.fetchBytes(url).catch(() => null);
    if (bytes) { await e.cache.put(url, { name: slot.file, bytes }).catch(() => undefined); return { origin: 'cloud', name: slot.file, bytes }; }
  }
  return null;
}

async function load(slot: SlotDef) {
  const e = env!;
  const mine = ++counter; tokens.set(slot.id, mine);
  states.set(slot.id, { state: 'loading' }); emit();
  try {
    const found = await findBytes(slot);
    if (tokens.get(slot.id) !== mine) return; // A newer request replaced this one.
    if (!found) { states.set(slot.id, { state: 'missing' }); return; }
    const decoded = await e.decode(found.bytes.slice(0));
    if (tokens.get(slot.id) !== mine) return;
    const data = prepare(decoded.channels, decoded.sampleRate, settings);
    const buffer = e.make(data, decoded.sampleRate);
    buffers.set(slot.id, buffer);
    order.push(slot.id);
    states.set(slot.id, { state: 'ready', origin: found.origin, name: found.name, seconds: Math.round(buffer.duration) });
    // Keep memory in check: drop the recordings used longest ago (they load again on demand).
    while (order.length > settings.keep) { const old = order.shift()!; if (old !== slot.id) { buffers.delete(old); states.set(old, { state: 'idle' }); } }
  } catch (error) {
    states.set(slot.id, { state: 'missing', error: error instanceof Error ? error.message.slice(0, 120) : 'This file could not be decoded.' });
  } finally { if (tokens.get(slot.id) === mine) inflight.delete(slot.id); emit(); }
}

/** The recording for a layer, if one is ready. Starts loading it the first time it is asked for. */
export function recordingFor(layer: string): AudioBuffer | null {
  if (!env || settings.source === 'generated') return null;
  const slot = slotByLayer(layer);
  if (!slot) return null;
  const buffer = buffers.get(slot.id);
  if (buffer) { const at = order.indexOf(slot.id); if (at >= 0 && at !== order.length - 1) { order.splice(at, 1); order.push(slot.id); } return buffer; }
  const state = states.get(slot.id)?.state;
  if (!inflight.has(slot.id) && state !== 'missing' && state !== 'loading') {
    const run = load(slot);
    inflight.set(slot.id, run);
  }
  return null;
}

/** Load a slot right now (for the Test button in Settings), whether or not a mix uses it. */
export async function loadSlot(slotId: string): Promise<SlotState> {
  const slot = slotById(slotId);
  if (!slot || !env) return { state: 'missing' };
  states.delete(slot.id); buffers.delete(slot.id);
  const run = load(slot);
  inflight.set(slot.id, run);
  await run;
  return slotState(slot.id);
}

export async function saveCustomFile(slotId: string, name: string, bytes: ArrayBuffer): Promise<SlotState> {
  if (!env || !slotById(slotId)) return { state: 'missing' };
  await env.custom.put(slotId, { name: name.slice(0, 120), bytes });
  return loadSlot(slotId);
}
export async function removeCustomFile(slotId: string) {
  if (!env) return;
  await env.custom.remove(slotId);
  clearRecordings(slotId);
}

/** Which slots have a file somewhere right now (without decoding anything). */
export async function availability(): Promise<Record<string, RecOrigin | null>> {
  const out: Record<string, RecOrigin | null> = {};
  if (!env) return out;
  const m = await loadManifest();
  const customKeys = await env.custom.keys();
  const cacheKeys = new Set(await env.cache.keys());
  for (const slot of SLOTS) {
    out[slot.id] = customKeys.includes(slot.id) ? 'custom'
      : m?.files.some((file) => file.slot === slot.id) ? 'bundled'
      : settings.cloudBase && cacheKeys.has(`${settings.cloudBase}/${slot.file}`) ? 'cloud' : null;
  }
  return out;
}
