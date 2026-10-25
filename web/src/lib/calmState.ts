import { startWindDown, type SceneId, type WindDown } from './calm';
import { getPrefs } from './prefs';

/** What is open right now. Lives outside React so a voice command, a key and a button can all drive the same thing. */
export interface CalmView { open: boolean; tab: 'breathe' | 'ground' | 'wind' | 'scene'; scene: SceneId | null; pattern: string | null; saver: boolean }
let view: CalmView = { open: false, tab: 'breathe', scene: null, pattern: null, saver: false };
let wind: WindDown | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
export const subscribeCalm = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getCalmView = () => view;
export const getWindDown = () => wind;
export function openCalm(patch: Partial<CalmView> = {}) { view = { ...view, ...patch, open: true, saver: patch.saver ?? false }; emit(); }
export function closeCalm() { view = { ...view, open: false, saver: false, scene: null, pattern: null }; emit(); }
export function beginWindDown(now = Date.now(), minutes?: number) {
  const c = getPrefs().calm;
  const total = minutes ?? c.windMinutes;
  wind = startWindDown(now, total, Math.min(c.windFade, Math.max(1, total)), c.windDim); emit();
}
export function stopWindDown() { wind = null; emit(); }
export function finishWindDown() { if (wind) { wind = { ...wind, done: true }; emit(); } }
