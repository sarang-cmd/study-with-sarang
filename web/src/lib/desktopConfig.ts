export interface Binding { id: string; label: string; command: string; accelerator: string; always?: boolean; macroId?: string }

const MOD = 'CommandOrControl+Alt+Shift+';
/**
 * Defaults use Ctrl+Alt+Shift (Cmd+Option+Shift on a Mac). Ctrl+Alt alone is AltGr on many keyboards
 * (needed for @ and the euro sign), and three modifiers are rarely claimed by other apps.
 */
export const isMediaBinding = (id: string) => id.startsWith('media.');
export const defaultBindings: Binding[] = [
  { id: 'sound.toggle', label: 'Play or pause sound', command: 'sound.toggle', accelerator: `${MOD}Space` },
  { id: 'sound.play', label: 'Start sound', command: 'sound.play', accelerator: `${MOD}P` },
  { id: 'sound.pause', label: 'Stop sound', command: 'sound.pause', accelerator: `${MOD}S` },
  { id: 'sound.next', label: 'Next variation', command: 'sound.next', accelerator: `${MOD}N` },
  { id: 'volume.up', label: 'Volume up', command: 'volume.up', accelerator: `${MOD}Up` },
  { id: 'volume.down', label: 'Volume down', command: 'volume.down', accelerator: `${MOD}Down` },
  { id: 'timer.toggle', label: 'Start or pause timer', command: 'timer.toggle', accelerator: `${MOD}T` },
  { id: 'timer.drift', label: 'Mark a distraction', command: 'timer.drift', accelerator: `${MOD}D` },
  { id: 'zen.toggle', label: 'Zen view', command: 'zen.toggle', accelerator: `${MOD}Z` },
  { id: 'window.toggle', label: 'Show or hide window', command: 'window.toggle', accelerator: `${MOD}H` },
  { id: 'window.compact', label: 'Collapse or expand mini bar', command: 'window.compact:toggle', accelerator: `${MOD}M` },
  // Keyboard media keys. They are alone on purpose (no modifiers); turn them off in Settings > Keys if another player should keep them.
  { id: 'media.playpause', label: 'Media key: Play/Pause', command: 'sound.toggle', accelerator: 'MediaPlayPause' },
  { id: 'media.next', label: 'Media key: Next track', command: 'sound.next', accelerator: 'MediaNextTrack' },
  { id: 'media.stop', label: 'Media key: Stop', command: 'sound.pause', accelerator: 'MediaStop' },
  { id: 'shortcuts.toggle', label: 'Turn global shortcuts on or off', command: 'shortcuts.toggle', accelerator: `${MOD}G`, always: true },
];

const KEY = 'study-with-sarang:desktop-shortcuts';
type Overrides = Record<string, string>;

export function readOverrides(): Overrides {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Overrides = Object.create(null) as Overrides;
    for (const [id, value] of Object.entries(raw)) if (typeof value === 'string' && value.length <= 60 && /^[\w.:-]{1,80}$/.test(id)) out[id] = value;
    return { ...out };
  } catch { return {}; }
}
export function writeOverrides(value: Overrides) { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* Kept for this session. */ } }

export function applyOverrides(overrides: Overrides): Binding[] {
  return defaultBindings.map((binding) => (Object.prototype.hasOwnProperty.call(overrides, binding.id) ? { ...binding, accelerator: overrides[binding.id] } : binding));
}

// --------------------------------------------------------------------------- key capture and display
const CODE_KEYS: Record<string, string> = {
  Space: 'Space', Enter: 'Return', NumpadEnter: 'Return', Backspace: 'Backspace', Tab: 'Tab', Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Escape: 'Escape',
  Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\', BracketLeft: '[', BracketRight: ']',
  MediaPlayPause: 'MediaPlayPause', MediaTrackNext: 'MediaNextTrack', MediaTrackPrevious: 'MediaPreviousTrack', MediaStop: 'MediaStop',
  AudioVolumeUp: 'VolumeUp', AudioVolumeDown: 'VolumeDown', AudioVolumeMute: 'VolumeMute',
};
export function keyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `num${code.slice(6)}`;
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return CODE_KEYS[code] ?? null;
}
export const isModifierCode = (code: string) => /^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/.test(code) || code === 'AltGraph';

/** Turns a keydown into an Electron accelerator, or null while only modifiers are held. */
export function eventToAccelerator(event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>, mac: boolean): string | null {
  if (isModifierCode(event.code)) return null;
  const key = keyFromCode(event.code);
  if (!key) return null;
  const parts: string[] = [];
  if (mac) { if (event.metaKey) parts.push('CommandOrControl'); if (event.ctrlKey) parts.push('Control'); }
  else { if (event.ctrlKey) parts.push('CommandOrControl'); if (event.metaKey) parts.push('Super'); }
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}

export function prettyAccelerator(accelerator: string, mac: boolean): string {
  if (!accelerator) return 'Not set';
  return accelerator.split('+').map((part) => {
    switch (part) {
      case 'CommandOrControl': case 'CmdOrCtrl': return mac ? '\u2318' : 'Ctrl';
      case 'Command': case 'Cmd': return '\u2318';
      case 'Control': case 'Ctrl': return mac ? '\u2303' : 'Ctrl';
      case 'Alt': case 'Option': return mac ? '\u2325' : 'Alt';
      case 'Shift': return mac ? '\u21E7' : 'Shift';
      case 'Super': case 'Meta': return mac ? '\u2318' : 'Win';
      case 'Up': return '\u2191';
      case 'Down': return '\u2193';
      case 'Left': return '\u2190';
      case 'Right': return '\u2192';
      case 'MediaPlayPause': return 'Play/Pause key';
      case 'MediaNextTrack': return 'Next key';
      case 'MediaPreviousTrack': return 'Previous key';
      default: return part.startsWith('num') ? `Num ${part.slice(3)}` : part;
    }
  }).join(mac ? ' ' : ' + ');
}

/** What the main process needs to register a shortcut. */
export function toPayload(bindings: Binding[]) {
  return bindings.map((item) => ({ id: item.id, label: item.label, accelerator: item.accelerator, command: item.command, always: item.always === true }));
}
