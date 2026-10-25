import { useSyncExternalStore } from 'react';
import { parseVideoLink, readVideoPlaylist } from './videoPlaylist';

/**
 * The study room: your own study-with-me style video behind the Zen clock, instead of (or on top of) the sound.
 * Scenes are YouTube links, direct video links, or video files kept on this device (the file bytes live in IndexedDB, see roomFiles.ts).
 */
export type SceneKind = 'youtube' | 'url' | 'file';
export interface Scene { id: string; title: string; kind: SceneKind; url: string; videoId?: string; size?: number; addedAt: number }
export type RoomSound = 'replace' | 'mix';
export type RoomFollow = 'free' | 'timer' | 'focus';
export type RoomNext = 'loop-one' | 'loop-all' | 'shuffle' | 'stop';
export type RoomClock = 'big' | 'small' | 'hidden';
export interface RoomSettings {
  on: boolean;          // show the study room in Zen
  sceneId: string;      // the scene to play
  autoPlay: boolean;    // start as soon as Zen opens
  sound: RoomSound;     // replace: the soundscape pauses while the video plays; mix: both play
  volume: number;       // video volume, 0 to 100
  dim: number;          // darkening layer over the video, 0 to 80 percent
  blur: number;         // background blur in pixels, 0 to 24
  fit: 'cover' | 'contain';
  clock: RoomClock;
  follow: RoomFollow;   // free: you control it; timer: plays only while the timer runs; focus: only during focus blocks
  next: RoomNext;       // what happens when a scene ends
  showTitle: boolean;
}
export const MAX_SCENES = 40;
export const defaultRoom: RoomSettings = { on: false, sceneId: '', autoPlay: true, sound: 'replace', volume: 60, dim: 35, blur: 0, fit: 'cover', clock: 'big', follow: 'free', next: 'loop-all', showTitle: true };

const int = (v: unknown, min: number, max: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : d);
const flag = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d);

export function sanitizeRoom(raw: unknown): RoomSettings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}; const d = defaultRoom;
  return {
    on: flag(r.on, d.on), sceneId: typeof r.sceneId === 'string' ? r.sceneId.slice(0, 90) : '', autoPlay: flag(r.autoPlay, d.autoPlay), sound: pick(r.sound, ['replace', 'mix'], d.sound),
    volume: int(r.volume, 0, 100, d.volume), dim: int(r.dim, 0, 80, d.dim), blur: int(r.blur, 0, 24, d.blur), fit: pick(r.fit, ['cover', 'contain'], d.fit),
    clock: pick(r.clock, ['big', 'small', 'hidden'], d.clock), follow: pick(r.follow, ['free', 'timer', 'focus'], d.follow), next: pick(r.next, ['loop-one', 'loop-all', 'shuffle', 'stop'], d.next),
    showTitle: flag(r.showTitle, d.showTitle),
  };
}
export function sanitizeScenes(raw: unknown): Scene[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>(); const out: Scene[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    if (typeof s.id !== 'string' || !s.id || seen.has(s.id) || typeof s.title !== 'string') continue;
    const title = s.title.trim().slice(0, 80) || 'Untitled scene'; const addedAt = typeof s.addedAt === 'number' && Number.isFinite(s.addedAt) ? s.addedAt : 0;
    if (s.kind === 'file') { seen.add(s.id); out.push({ id: s.id.slice(0, 90), title, kind: 'file', url: '', size: int(s.size, 0, 1e12, 0), addedAt }); }
    else if (typeof s.url === 'string') {
      const parsed = parseVideoLink(s.url); if (!parsed) continue;
      seen.add(s.id); out.push({ id: s.id.slice(0, 90), title, kind: parsed.kind === 'youtube' ? 'youtube' : 'url', url: parsed.url, videoId: parsed.videoId, addedAt });
    }
    if (out.length >= MAX_SCENES) break;
  }
  return out;
}

/** The scene to play after `currentId` ends. Null means stop. `random` is injectable for tests. */
export function pickNext(scenes: Scene[], currentId: string, mode: RoomNext, random: () => number = Math.random): Scene | null {
  if (!scenes.length) return null;
  const at = scenes.findIndex((s) => s.id === currentId);
  if (mode === 'loop-one') return scenes[at >= 0 ? at : 0];
  if (mode === 'shuffle') { if (scenes.length === 1) return scenes[0]; let n = Math.floor(random() * (scenes.length - 1)); if (at >= 0 && n >= at) n++; return scenes[Math.min(n, scenes.length - 1)]; }
  if (at < 0) return scenes[0];
  if (at + 1 < scenes.length) return scenes[at + 1];
  return mode === 'loop-all' ? scenes[0] : null;
}
export const currentScene = (scenes: Scene[], settings: RoomSettings): Scene | null => scenes.find((s) => s.id === settings.sceneId) ?? scenes[0] ?? null;
/** Should the video be playing right now because of the timer? Null means "leave it to the person". */
export function desiredPlayback(follow: RoomFollow, t: { running: boolean; phase: 'focus' | 'short' | 'long' }): boolean | null {
  if (follow === 'free') return null;
  return follow === 'timer' ? t.running : t.running && t.phase === 'focus';
}
export function sceneFromLink(link: string, title: string): Omit<Scene, 'id' | 'addedAt'> | null {
  const p = parseVideoLink(link); if (!p) return null;
  return { title: title.trim().slice(0, 80) || (p.kind === 'youtube' ? `YouTube ${p.videoId}` : 'Direct video'), kind: p.kind === 'youtube' ? 'youtube' : 'url', url: p.url, videoId: p.videoId };
}
export const sizeLabel = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : bytes >= 1e6 ? `${Math.round(bytes / 1e6)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);

// ---- store ------------------------------------------------------------------------------------------
const KEY = 'study-with-sarang:study-room';
let settings: RoomSettings = { ...defaultRoom }; let scenes: Scene[] = [];
try { if (typeof localStorage !== 'undefined') { const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null'); settings = sanitizeRoom(raw?.settings); scenes = sanitizeScenes(raw?.scenes); } } catch { /* start empty */ }
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
function save() { try { localStorage.setItem(KEY, JSON.stringify({ settings, scenes })); } catch { /* kept for this visit */ } }
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getRoom = () => settings;
export const getScenes = () => scenes;
export const useRoom = () => useSyncExternalStore(subscribe, getRoom, getRoom);
export const useScenes = () => useSyncExternalStore(subscribe, getScenes, getScenes);
export function setRoom(patch: Partial<RoomSettings>) { settings = sanitizeRoom({ ...settings, ...patch }); save(); emit(); }
let counter = 0;
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `scene-${Date.now().toString(36)}-${counter++}`);
export function addScene(input: Omit<Scene, 'id' | 'addedAt'>, id = newId()): Scene | null {
  if (scenes.length >= MAX_SCENES) return null;
  const next = sanitizeScenes([{ ...input, id, addedAt: Date.now() }]); if (!next.length) return null;
  scenes = [...scenes, next[0]]; if (!settings.sceneId) settings = { ...settings, sceneId: next[0].id }; save(); emit(); return next[0];
}
export function removeScene(id: string) { scenes = scenes.filter((s) => s.id !== id); if (settings.sceneId === id) settings = { ...settings, sceneId: scenes[0]?.id ?? '' }; save(); emit(); }
export function renameScene(id: string, title: string) { scenes = scenes.map((s) => (s.id === id ? { ...s, title: title.slice(0, 80) } : s)); save(); emit(); }
export function moveScene(id: string, by: -1 | 1) {
  const i = scenes.findIndex((s) => s.id === id), j = i + by; if (i < 0 || j < 0 || j >= scenes.length) return;
  const next = scenes.slice(); [next[i], next[j]] = [next[j], next[i]]; scenes = next; save(); emit();
}
/** Copies the YouTube and direct links from the Library video playlist that are not in the study room yet. Returns how many were added. */
export function importFromLibrary(): number {
  const known = new Set(scenes.map((s) => s.url)); let added = 0;
  for (const item of readVideoPlaylist()) { if (item.kind === 'local' || known.has(item.url)) continue; if (addScene({ title: item.title, kind: item.kind === 'youtube' ? 'youtube' : 'url', url: item.url, videoId: item.videoId })) added++; }
  return added;
}
export function resetRoomForTest() { settings = { ...defaultRoom }; scenes = []; emit(); }

// ---- the live player: the Zen view registers one so the media keys and the sound logic can reach it ---------
export interface RoomController { toggle: () => void; next: () => void; prev: () => void }
let live = { active: false, playing: false, title: '' }; let controller: RoomController | null = null;
export const getLive = () => live;
export const useLive = () => useSyncExternalStore(subscribe, getLive, getLive);
export function setLive(patch: Partial<typeof live>) { const next = { ...live, ...patch }; if (next.active === live.active && next.playing === live.playing && next.title === live.title) return; live = next; emit(); }
export function registerController(c: RoomController | null) { controller = c; }
export const roomController = () => controller;
