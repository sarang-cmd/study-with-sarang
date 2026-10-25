import { getConfig, BUILT_IN, configured } from './cloud';
import type { FlowKeyStatus } from './desktop';
import { idleUi, type FlowUi } from './flow';

/** Small shared state for Flow: what the key helper reports, what the bar is showing, and a few switches other parts need. */
let keyStatus: FlowKeyStatus = { status: 'off', message: '', hold: true };
let ui: FlowUi = idleUi();
let voiceWanted = false;
let tester: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const subscribeFlow = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getKeyStatus = () => keyStatus;
export const setKeyStatus = (next: FlowKeyStatus) => { keyStatus = next; emit(); };
export const getFlowUi = () => ui;
export const setFlowUi = (next: FlowUi) => { ui = next; emit(); };
/** Whether Flow wants the Windows speech recognizer kept running (so voice mode's own stop does not cut it off). */
export const getFlowVoiceWanted = () => voiceWanted;
export const setFlowVoiceWanted = (value: boolean) => { voiceWanted = value; };
/** Settings has a "Try it" button; the bridge registers what it runs. */
export const registerTester = (fn: (() => void) | null) => { tester = fn; };
export const runTester = () => tester?.();

/** The Supabase project that hosts Flow Cloud: the one chosen in Settings > Account, otherwise the built-in one. */
export function publishableProject(): { url: string; key: string } | undefined {
  const cfg = getConfig();
  if (configured() && cfg.url && cfg.anonKey) return { url: cfg.url, key: cfg.anonKey };
  return BUILT_IN.url && BUILT_IN.anonKey ? { url: BUILT_IN.url, key: BUILT_IN.anonKey } : undefined;
}
