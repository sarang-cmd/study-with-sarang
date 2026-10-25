import { useSyncExternalStore } from 'react';

/**
 * Live facts from the voice recognizer, kept outside React state so a level meter that updates several times a
 * second does not re-render the whole app. The settings page reads it; nothing else does.
 */
export interface VoiceMeter {
  level: number;            // 0 to 100, the microphone level the recognizer sees
  peak: number;             // Highest level since the meter was reset
  hypothesis: string;       // What it thinks it is hearing right now
  heard: number;            // Phrases it recognized
  rejected: number;         // Sounds it heard but could not match to a phrase
  lastRejected: string;
  lastHeardAt: number;      // Date.now() of the last recognized phrase
  lastSoundAt: number;      // Date.now() of the last time the level moved above silence
}
const empty = (): VoiceMeter => ({ level: 0, peak: 0, hypothesis: '', heard: 0, rejected: 0, lastRejected: '', lastHeardAt: 0, lastSoundAt: 0 });
let current = empty();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const getVoiceMeter = () => current;
export function patchVoiceMeter(patch: Partial<VoiceMeter>) { current = { ...current, ...patch }; emit(); }
export function resetVoiceMeter() { current = empty(); emit(); }
export function recordLevel(level: number, now = Date.now()) {
  current = { ...current, level, peak: Math.max(current.peak, level), lastSoundAt: level >= 4 ? now : current.lastSoundAt };
  emit();
}
export function useVoiceMeter(): VoiceMeter {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getVoiceMeter, getVoiceMeter);
}
