/**
 * Flow, the voice helper: settings, the push-to-talk key, and the small state machines behind it.
 * Hold the key and speak, or double-tap for hands-free. A short bar shows what Flow hears.
 * Everything here is plain logic, so it can be tested without a microphone or a window.
 */
import { PROVIDERS, defaultFlowApi, providerInfo, type FlowApiSettings, type ProviderId } from './flowApi';

// ---------------------------------------------------------------------------------------------- the key
export interface FlowKeyDef { id: string; label: string; codes: string[]; vks: number[]; accelerator: string; hint?: string }
export const FLOW_KEYS: FlowKeyDef[] = [
  { id: 'rctrl', label: 'Right Ctrl', codes: ['ControlRight'], vks: [0xA3], accelerator: 'CommandOrControl+Alt+Space', hint: 'Rarely used by other apps. Recommended.' },
  { id: 'rshift', label: 'Right Shift', codes: ['ShiftRight'], vks: [0xA1], accelerator: 'CommandOrControl+Alt+Space', hint: 'Can clash with typing with the right hand.' },
  { id: 'f8', label: 'F8', codes: ['F8'], vks: [0x77], accelerator: 'F8', hint: 'Some laptops need Fn.' },
  { id: 'f9', label: 'F9', codes: ['F9'], vks: [0x78], accelerator: 'F9', hint: 'Some laptops need Fn.' },
  { id: 'f10', label: 'F10', codes: ['F10'], vks: [0x79], accelerator: 'F10', hint: 'Windows uses F10 for the menu bar in some apps.' },
  { id: 'scroll', label: 'Scroll Lock', codes: ['ScrollLock'], vks: [0x91], accelerator: 'ScrollLock', hint: 'Almost never used. Not on every keyboard.' },
  { id: 'ctrlaltspace', label: 'Ctrl + Alt + Space', codes: ['ControlLeft', 'AltLeft', 'Space'], vks: [0xA2, 0xA4, 0x20], accelerator: 'CommandOrControl+Alt+Space' },
  { id: 'ctrlshiftspace', label: 'Ctrl + Shift + Space', codes: ['ControlLeft', 'ShiftLeft', 'Space'], vks: [0xA2, 0xA0, 0x20], accelerator: 'CommandOrControl+Shift+Space' },
];
export const CUSTOM_KEY = 'custom';

/** KeyboardEvent.code to Windows virtual key. Only keys that are sensible for a push-to-talk key. */
export const CODE_VK: Record<string, number> = {
  ControlLeft: 0xA2, ControlRight: 0xA3, ShiftLeft: 0xA0, ShiftRight: 0xA1, AltLeft: 0xA4, AltRight: 0xA5, Space: 0x20, Tab: 0x09, Backquote: 0xC0,
  Insert: 0x2D, Home: 0x24, End: 0x23, PageUp: 0x21, PageDown: 0x22, ScrollLock: 0x91, Pause: 0x13, CapsLock: 0x14,
  ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28, ContextMenu: 0x5D,
};
for (let i = 1; i <= 24; i++) CODE_VK[`F${i}`] = 0x6F + i;
for (let i = 0; i < 26; i++) CODE_VK[`Key${String.fromCharCode(65 + i)}`] = 0x41 + i;
for (let i = 0; i < 10; i++) { CODE_VK[`Digit${i}`] = 0x30 + i; CODE_VK[`Numpad${i}`] = 0x60 + i; }

const niceCode = (code: string) => code.replace(/^Key/, '').replace(/^Digit/, '').replace('ControlLeft', 'Left Ctrl').replace('ControlRight', 'Right Ctrl').replace('ShiftLeft', 'Left Shift').replace('ShiftRight', 'Right Shift').replace('AltLeft', 'Left Alt').replace('AltRight', 'Right Alt').replace(/^Arrow/, '');
const ORDER = ['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight'];
export const describeCodes = (codes: string[]) => [...codes].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99)).map(niceCode).join(' + ');

export function sanitizeCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = [...new Set(raw.filter((code): code is string => typeof code === 'string' && code in CODE_VK))].slice(0, 4);
  // AltRight is AltGr on many keyboards (it also presses Ctrl), so it is not a safe choice.
  return out.includes('AltRight') ? [] : out;
}

export interface ResolvedKey { id: string; label: string; codes: string[]; vks: number[]; accelerator: string }
export function resolveKey(keyId: string, customCodes: string[]): ResolvedKey {
  if (keyId === CUSTOM_KEY) {
    const codes = sanitizeCodes(customCodes);
    if (codes.length) {
      const mods = codes.filter((code) => /^(Control|Shift|Alt)/.test(code));
      const last = codes.find((code) => !/^(Control|Shift|Alt)/.test(code));
      const accelerator = last && mods.length ? [...mods.map((m) => (m.startsWith('Control') ? 'CommandOrControl' : m.startsWith('Shift') ? 'Shift' : 'Alt')), last.replace(/^Key/, '').replace(/^Digit/, '')].join('+') : 'CommandOrControl+Alt+Space';
      return { id: CUSTOM_KEY, label: describeCodes(codes), codes, vks: codes.map((code) => CODE_VK[code]), accelerator };
    }
  }
  const preset = FLOW_KEYS.find((item) => item.id === keyId) ?? FLOW_KEYS[0];
  return { id: preset.id, label: preset.label, codes: preset.codes, vks: preset.vks, accelerator: preset.accelerator };
}

// ---------------------------------------------------------------------------------------------- settings
export type GestureMode = 'both' | 'hold' | 'handsfree';
export type UnsureMode = 'ask' | 'auto' | 'never';
export type BarStyle = 'wave' | 'bars' | 'orb' | 'ring';
export type BarPlace = 'bottom' | 'top' | 'center';
export interface FlowSettings extends FlowApiSettings {
  enabled: boolean;
  keyId: string; keyCodes: string[];
  mode: GestureMode;
  tapMs: number;             // A press shorter than this is a tap, not a hold
  doubleMs: number;          // Time allowed between the two taps of a double tap
  silenceMs: number;         // Hands-free: how long a pause ends the request
  maxSeconds: number;        // Longest single request
  unsure: UnsureMode;        // What to do when the built-in understanding is not sure
  barStyle: BarStyle; barPlace: BarPlace; barSize: 'small' | 'medium' | 'large'; barText: boolean;
  cues: boolean;             // Soft start and finish sounds
  localFree: boolean;        // Desktop: also let the Windows recognizer write down sentences that are not in its list (needed for phrases like "add a to-do ...")
  localWarm: number;         // Desktop: minutes the built-in recognizer stays ready after use (0 = start fresh every time)
  browserSpeech: boolean;    // Web: use the browser's own speech recognition first (the browser vendor may process the audio)
  answers: boolean;          // Allow the AI to answer questions, not only run commands
  speakAnswers: boolean; speakDone: boolean;
  ttsRate: number; ttsPitch: number; ttsVolume: number;
  ttsSystemVoice: string;    // The system voice you picked (its name), or empty for the best match
  duck: number;              // Percent the app's own sound is lowered while Flow listens (0 = not at all)
  micWarm: number;           // Seconds the microphone stays open after a request so the next one starts at once (0 = close at once)
}
export const defaultFlow: FlowSettings = {
  ...defaultFlowApi,
  enabled: false, keyId: 'rctrl', keyCodes: [], mode: 'both', tapMs: 260, doubleMs: 450, silenceMs: 1400, maxSeconds: 20, unsure: 'ask',
  barStyle: 'wave', barPlace: 'bottom', barSize: 'medium', barText: true, cues: true, localFree: true, localWarm: 5, browserSpeech: false,
  answers: true, speakAnswers: true, speakDone: false, ttsRate: 1, ttsPitch: 1, ttsVolume: 1, ttsSystemVoice: '', duck: 80, micWarm: 8,
};

const PROVIDER_IDS: ProviderId[] = PROVIDERS.map((item) => item.id);
export function sanitizeFlow(raw: unknown): FlowSettings {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = defaultFlow;
  const flag = (v: unknown, f: boolean) => (typeof v === 'boolean' ? v : f);
  const num = (v: unknown, f: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : f);
  const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) : '');
  const provider = (v: unknown, f: ProviderId | 'off', allowOff = true): ProviderId | 'off' => (allowOff && v === 'off' ? 'off' : PROVIDER_IDS.includes(v as ProviderId) ? (v as ProviderId) : f);
  const sttProvider = provider(r.sttProvider, d.sttProvider);
  const chatProvider = provider(r.chatProvider === 'cloud' ? 'off' : r.chatProvider, d.chatProvider); // The free shared helper is for dictation only
  const tts = r.ttsEngine === 'system' || r.ttsEngine === 'off' ? r.ttsEngine : PROVIDER_IDS.includes(r.ttsEngine as ProviderId) && providerInfo(r.ttsEngine as string).tts ? (r.ttsEngine as ProviderId) : d.ttsEngine;
  const url = (v: unknown) => { const s = str(v, 200).replace(/\/+$/, ''); return /^https:\/\//.test(s) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(s) ? s : ''; };
  return {
    enabled: flag(r.enabled, d.enabled),
    keyId: r.keyId === CUSTOM_KEY || FLOW_KEYS.some((k) => k.id === r.keyId) ? (r.keyId as string) : d.keyId,
    keyCodes: sanitizeCodes(r.keyCodes),
    mode: r.mode === 'hold' || r.mode === 'handsfree' ? r.mode : 'both',
    tapMs: Math.round(num(r.tapMs, d.tapMs, 120, 600)), doubleMs: Math.round(num(r.doubleMs, d.doubleMs, 200, 900)),
    silenceMs: Math.round(num(r.silenceMs, d.silenceMs, 600, 5000)), maxSeconds: Math.round(num(r.maxSeconds, d.maxSeconds, 4, 90)),
    unsure: r.unsure === 'auto' || r.unsure === 'never' ? r.unsure : 'ask',
    barStyle: r.barStyle === 'bars' || r.barStyle === 'orb' || r.barStyle === 'ring' ? r.barStyle : 'wave',
    barPlace: r.barPlace === 'top' || r.barPlace === 'center' ? r.barPlace : 'bottom',
    barSize: r.barSize === 'small' || r.barSize === 'large' ? r.barSize : 'medium', barText: flag(r.barText, d.barText),
    cues: flag(r.cues, d.cues), localFree: flag(r.localFree, d.localFree), localWarm: Math.round(num(r.localWarm, d.localWarm, 0, 60)), browserSpeech: flag(r.browserSpeech, d.browserSpeech),
    answers: flag(r.answers, d.answers), speakAnswers: flag(r.speakAnswers, d.speakAnswers), speakDone: flag(r.speakDone, d.speakDone),
    ttsRate: Math.round(num(r.ttsRate, d.ttsRate, .5, 2) * 100) / 100, ttsPitch: Math.round(num(r.ttsPitch, d.ttsPitch, .5, 2) * 100) / 100, ttsVolume: Math.round(num(r.ttsVolume, d.ttsVolume, 0, 1) * 100) / 100,
    ttsSystemVoice: str(r.ttsSystemVoice, 120),
    duck: Math.round(num(r.duck, d.duck, 0, 100)), micWarm: Math.round(num(r.micWarm, d.micWarm, 0, 60)),
    sttProvider, chatProvider, ttsEngine: tts,
    sttModel: str(r.sttModel, 80), chatModel: str(r.chatModel, 80), ttsModel: str(r.ttsModel, 80), ttsVoice: str(r.ttsVoice, 60),
    customUrl: url(r.customUrl), cloudUrl: url(r.cloudUrl),
    language: r.language === 'en' || r.language === 'de' ? r.language : 'auto',
    dailyLimit: Math.round(num(r.dailyLimit, d.dailyLimit, 0, 1000)), cloudLimit: Math.round(num(r.cloudLimit, d.cloudLimit, 1, 1000)),
  };
}

// ---------------------------------------------------------------------------------------------- the gesture
export type GestureAction = 'start' | 'stop' | 'cancel' | 'handsfree';
export type GesturePhase = 'idle' | 'holding' | 'tapwait' | 'handsfree';

/**
 * Turns key down and up events into what Flow should do.
 *  Hold:         down starts listening, up (after a real hold) stops and processes it.
 *  Double tap:   two quick taps switch to hands-free; a later tap, a pause in speech or Esc ends it.
 *  Mode "hold" only holds; "handsfree" starts on one tap.
 * Time is passed in, so tests need no clock.
 */
export class Gesture {
  phase: GesturePhase = 'idle';
  private pressedAt = 0;
  private waitUntil = 0;
  constructor(private emit: (action: GestureAction) => void, public options: { mode: GestureMode; tapMs: number; doubleMs: number }) {}

  down(now: number) {
    const { mode } = this.options;
    if (this.phase === 'idle') { this.phase = 'holding'; this.pressedAt = now; this.emit('start'); return; }
    if (this.phase === 'tapwait' && now <= this.waitUntil) { this.phase = 'handsfree'; this.emit('handsfree'); return; }
    if (this.phase === 'handsfree') { this.phase = 'idle'; this.emit('stop'); return; }
    if (this.phase === 'tapwait') { this.phase = 'holding'; this.pressedAt = now; this.emit('cancel'); this.emit('start'); return; }
    void mode;
  }
  up(now: number) {
    if (this.phase !== 'holding') return;
    const held = now - this.pressedAt;
    const { mode, tapMs, doubleMs } = this.options;
    if (held >= tapMs || mode === 'hold') { this.phase = 'idle'; this.emit(held >= 200 ? 'stop' : 'cancel'); return; }
    if (mode === 'handsfree') { this.phase = 'handsfree'; this.emit('handsfree'); return; }
    this.phase = 'tapwait'; this.waitUntil = now + doubleMs;
  }
  /** Call regularly (for example every 50 ms). A single tap that nobody followed up is dropped. */
  tick(now: number) { if (this.phase === 'tapwait' && now > this.waitUntil) { this.phase = 'idle'; this.emit('cancel'); } }
  /** The listening ended on its own (silence, time limit, Esc, an error). */
  reset() { this.phase = 'idle'; }
  /** The key toggles (no key-up events exist, for example on macOS and Linux). */
  toggle(now: number) { if (this.phase === 'idle') { this.phase = 'handsfree'; this.emit('start'); this.emit('handsfree'); } else { void now; this.phase = 'idle'; this.emit('stop'); } }
}

// ---------------------------------------------------------------------------------------------- voice activity
/** Decides, from a stream of loudness readings, when speech started and when a pause is long enough to end the request. */
export class Vad {
  spoke = false;
  private quietSince = 0;
  private startedAt = 0;
  peak = 0;
  constructor(public options: { silenceMs: number; maxMs: number; threshold?: number }) {}
  threshold() { return this.options.threshold ?? .04; }
  /** @returns 'end' when listening should finish, 'speech' on the first loud reading, otherwise null */
  feed(level: number, now: number): 'speech' | 'end' | 'limit' | null {
    if (!this.startedAt) this.startedAt = now;
    if (level > this.peak) this.peak = level;
    if (now - this.startedAt >= this.options.maxMs) return 'limit';
    if (level >= this.threshold()) {
      const first = !this.spoke; this.spoke = true; this.quietSince = 0;
      return first ? 'speech' : null;
    }
    if (!this.spoke) return now - this.startedAt >= Math.max(this.options.silenceMs * 3, 5000) ? 'end' : null; // Nobody spoke: give up after a while
    if (!this.quietSince) this.quietSince = now;
    return now - this.quietSince >= this.options.silenceMs ? 'end' : null;
  }
  /** Was there anything worth sending? A recording that never rose above the noise floor is not. */
  heardSomething() { return this.spoke && this.peak >= this.threshold() * 1.2; }
}

// ---------------------------------------------------------------------------------------------- what the bar shows
export type FlowPhase = 'idle' | 'listening' | 'thinking' | 'confirm' | 'done' | 'error';
export interface FlowConfirm { heard: string; guess: string; guessLabel: string; canAsk: boolean }
export interface FlowUi {
  phase: FlowPhase; mode: 'hold' | 'handsfree'; text: string; message: string; level: number; bars: number[];
  confirm: FlowConfirm | null; style: BarStyle; place: BarPlace; size: 'small' | 'medium' | 'large'; showText: boolean; dark: boolean; key: string; seq: number;
}
export const idleUi = (): FlowUi => ({ phase: 'idle', mode: 'hold', text: '', message: '', level: 0, bars: [], confirm: null, style: 'wave', place: 'bottom', size: 'medium', showText: true, dark: false, key: '', seq: 0 });
