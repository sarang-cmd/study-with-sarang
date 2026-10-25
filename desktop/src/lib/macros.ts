import { newId } from './mix';

/** A macro is a short list of steps run in order, from one shortcut, voice phrase, tray or Stream Deck button. */
export type StepType = 'mix' | 'volume' | 'play' | 'pause' | 'timer-start' | 'timer-pause' | 'timer-reset' | 'timer-skip' | 'zen' | 'window-hide' | 'window-show' | 'window-compact' | 'window-expand' | 'zen-open' | 'zen-close' | 'drift' | 'finish' | 'breathe' | 'ground' | 'puck' | 'snap' | 'notify' | 'wait';
export interface MacroStep { type: StepType; value: string }
export interface Macro { id: string; name: string; steps: MacroStep[]; shortcut: string; voice: boolean }

export const SNAP_VALUES = ['left', 'right', 'top', 'bottom', 'topleft', 'topright', 'bottomleft', 'bottomright', 'third-left', 'third-middle', 'third-right', 'center'];
export const STEP_TYPES: { type: StepType; label: string; value?: 'mix' | 'number' | 'text' | 'layout'; hint?: string; desktopOnly?: boolean }[] = [
  { type: 'mix', label: 'Load mix', value: 'mix', hint: 'A built-in or saved mix' },
  { type: 'volume', label: 'Set volume', value: 'number', hint: '0 to 100' },
  { type: 'play', label: 'Start sound' },
  { type: 'pause', label: 'Stop sound' },
  { type: 'timer-start', label: 'Start timer' },
  { type: 'timer-pause', label: 'Pause timer' },
  { type: 'timer-reset', label: 'Reset timer' },
  { type: 'timer-skip', label: 'Skip to next block' },
  { type: 'zen', label: 'Toggle zen view' },
  { type: 'zen-open', label: 'Open zen view' },
  { type: 'zen-close', label: 'Close zen view' },
  { type: 'drift', label: 'Mark a distraction' },
  { type: 'finish', label: 'Finish and log the session' },
  { type: 'breathe', label: 'Open the breathing guide' },
  { type: 'ground', label: 'Open the grounding exercise' },
  { type: 'puck', label: 'Show or hide the puck' },
  { type: 'notify', label: 'Show a message', value: 'text', hint: 'Appears as a notification' },
  { type: 'window-show', label: 'Show window', desktopOnly: true },
  { type: 'window-hide', label: 'Hide to tray', desktopOnly: true },
  { type: 'window-compact', label: 'Collapse to mini bar', desktopOnly: true },
  { type: 'window-expand', label: 'Expand to full window', desktopOnly: true },
  { type: 'snap', label: 'Snap the window', value: 'layout', hint: 'Half, quarter or third of the screen', desktopOnly: true },
  { type: 'wait', label: 'Wait (seconds)', value: 'number', hint: '1 to 600' },
];
const TYPES = new Set<string>(STEP_TYPES.map((item) => item.type));
export const MAX_STEPS = 20;
export const MAX_MACROS = 30;

const KEY = 'study-with-sarang:macros';

/** The command a step runs, or null when the runner handles it itself (waits) or it is not complete. */
export function stepCommand(step: MacroStep): string | null {
  switch (step.type) {
    case 'mix': return step.value ? `mix.load:${step.value}` : null;
    case 'volume': return `volume.set:${clampInt(step.value, 0, 100, 40)}`;
    case 'play': return 'sound.play';
    case 'pause': return 'sound.pause';
    case 'timer-start': return 'timer.start';
    case 'timer-pause': return 'timer.pause';
    case 'timer-reset': return 'timer.reset';
    case 'timer-skip': return 'timer.skip';
    case 'zen': return 'zen.toggle';
    case 'zen-open': return 'zen.open';
    case 'zen-close': return 'zen.close';
    case 'drift': return 'timer.drift';
    case 'finish': return 'timer.finish';
    case 'breathe': return 'calm.breathe';
    case 'ground': return 'calm.ground';
    case 'puck': return 'puck.toggle';
    case 'snap': return SNAP_VALUES.includes(step.value) ? `window.snap:${step.value}` : null;
    case 'window-hide': return 'window.hide';
    case 'window-show': return 'window.show';
    case 'window-compact': return 'window.compact';
    case 'window-expand': return 'window.expand';
    default: return null;
  }
}

/** Window steps are carried out by the main process, so the runner sends them there. */
export const isWindowStep = (type: string) => type.startsWith('window-');

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  return Number.isFinite(n) && String(value ?? '').trim() !== '' ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

export function describeStep(step: MacroStep): string {
  const def = STEP_TYPES.find((item) => item.type === step.type);
  if (!def) return step.type;
  if (step.type === 'wait') return `Wait ${clampInt(step.value, 1, 600, 5)} s`;
  if (step.type === 'volume') return `Volume ${clampInt(step.value, 0, 100, 40)}%`;
  if (step.type === 'notify') return step.value ? `Message "${step.value}"` : 'Show a message (write it)';
  if (step.type === 'snap') return `Snap ${step.value || 'left'}`;
  if (step.type === 'mix') return step.value ? `Load "${step.value}"` : 'Load mix (choose one)';
  return def.label;
}

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');

function sanitizeStep(raw: unknown): MacroStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.type !== 'string' || !TYPES.has(item.type)) return null;
  const type = item.type as StepType;
  let value = clean(item.value, 80);
  if (type === 'volume') value = String(clampInt(value, 0, 100, 40));
  else if (type === 'wait') value = String(clampInt(value, 1, 600, 5));
  else if (type === 'notify') value = clean(item.value, 120);
  else if (type === 'snap') value = SNAP_VALUES.includes(value) ? value : 'left';
  else if (type !== 'mix') value = '';
  return { type, value };
}

export function sanitizeMacros(raw: unknown): Macro[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>(); const out: Macro[] = [];
  for (const entry of raw.slice(0, MAX_MACROS)) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const name = clean(item.name, 40);
    if (!name) continue;
    let id = clean(item.id, 80);
    if (!/^[\w-]{1,80}$/.test(id) || seen.has(id)) id = newId();
    seen.add(id);
    const steps = (Array.isArray(item.steps) ? item.steps : []).slice(0, MAX_STEPS).map(sanitizeStep).filter((step): step is MacroStep => step !== null);
    out.push({ id, name, steps, shortcut: clean(item.shortcut, 60), voice: item.voice !== false });
  }
  return out;
}

export const starterMacros = (): Macro[] => [
  { id: 'starter-flow-session', name: 'Start Flow session', shortcut: '', voice: true, steps: [{ type: 'mix', value: 'Flow' }, { type: 'volume', value: '46' }, { type: 'play', value: '' }, { type: 'timer-start', value: '' }] },
  { id: 'starter-wrap-up', name: 'Wrap up', shortcut: '', voice: true, steps: [{ type: 'timer-pause', value: '' }, { type: 'pause', value: '' }] },
];

export function readMacros(): Macro[] {
  try {
    const stored = localStorage.getItem(KEY);
    // Never saved: offer the starters. Saved as an empty list: the user deleted them, so keep it empty.
    return stored === null ? starterMacros() : sanitizeMacros(JSON.parse(stored));
  } catch { return starterMacros(); }
}
export function writeMacros(macros: Macro[]) { try { localStorage.setItem(KEY, JSON.stringify(macros)); } catch { /* Kept for this session. */ } }
export const newMacro = (): Macro => ({ id: newId(), name: 'New macro', steps: [{ type: 'play', value: '' }], shortcut: '', voice: true });
