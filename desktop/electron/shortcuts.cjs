'use strict';
/**
 * Global shortcut manager. Shortcuts are deliberately conservative so they do not steal keys
 * from browsers, editors, games or the system:
 *  - they need Ctrl/Cmd/Super, or be F13 to F24 or a media key (a Stream Deck can send those),
 *  - system combos such as Alt+F4 or Ctrl+Alt+Delete are refused,
 *  - Ctrl+Alt without Shift is flagged, because on many keyboards (including German ones)
 *    that pair is AltGr and is needed to type characters such as @ and the euro sign.
 */
const MODS = new Set(['command', 'cmd', 'control', 'ctrl', 'commandorcontrol', 'cmdorctrl', 'alt', 'option', 'altgr', 'shift', 'super', 'meta']);
const PRIMARY = new Set(['command', 'cmd', 'control', 'ctrl', 'commandorcontrol', 'cmdorctrl', 'super', 'meta']);
const HIGH_F = /^F(1[3-9]|2[0-4])$/i;
const MEDIA = new Set(['MediaPlayPause', 'MediaNextTrack', 'MediaPreviousTrack', 'MediaStop', 'VolumeUp', 'VolumeDown', 'VolumeMute']);
const RESERVED = [
  /^(ctrl|control)\+alt\+(delete|del)$/i, /^alt\+f4$/i, /^(ctrl|control)\+shift\+(esc|escape)$/i,
  /^(ctrl|control)\+(esc|escape)$/i, /^alt\+tab$/i, /^alt\+(esc|escape)$/i, /^(super|meta)\+l$/i, /^(super|meta)\+d$/i,
  /^(cmd|command)\+q$/i, /^(cmd|command)\+(space|tab)$/i,
  /^(ctrl|control|commandorcontrol|cmdorctrl)\+(c|v|x|z|y|a|s|w|t|n|r|f|p)$/i,
  // Browser and editor classics: reopen tab, new private window, DevTools, clear data, bookmarks, and so on.
  /^(ctrl|control|commandorcontrol|cmdorctrl)\+shift\+(t|n|w|p|i|j|c|b|o|r|delete|del|tab)$/i,
];

/** @returns {{ok: boolean, reason?: string, warning?: string}} */
function validate(accelerator) {
  if (typeof accelerator !== 'string' || !accelerator.trim() || accelerator.length > 60) return { ok: false, reason: 'Choose a key combination.' };
  const parts = accelerator.split('+').map((part) => part.trim());
  const key = parts.pop();
  if (!key) return { ok: false, reason: 'Add a key after the modifiers.' };
  if (MODS.has(key.toLowerCase())) return { ok: false, reason: 'Add a regular key after the modifiers.' };
  const lowered = parts.map((part) => part.toLowerCase());
  if (lowered.some((part) => !MODS.has(part))) return { ok: false, reason: 'That combination is not recognized.' };
  if (new Set(lowered).size !== lowered.length) return { ok: false, reason: 'A modifier is repeated.' };
  const standalone = HIGH_F.test(key) || MEDIA.has(key);
  if (!standalone && (lowered.length < 2 || !lowered.some((part) => PRIMARY.has(part)))) {
    return { ok: false, reason: 'Use at least two modifiers including Ctrl (or Cmd), such as Ctrl + Alt + Shift, or use F13 to F24 or a media key.' };
  }
  if (!standalone && /^F([1-9]|1[0-2])$/i.test(key) && lowered.length < 2) return { ok: false, reason: 'F1 to F12 need more modifiers.' };
  if (RESERVED.some((pattern) => pattern.test(accelerator))) return { ok: false, reason: 'That combination is used by the system or most apps.' };
  const ctrlAlt = lowered.some((part) => ['control', 'ctrl', 'commandorcontrol', 'cmdorctrl'].includes(part)) && lowered.some((part) => ['alt', 'option', 'altgr'].includes(part)) && !lowered.includes('shift');
  if (ctrlAlt && process.platform === 'win32') return { ok: true, warning: 'Ctrl+Alt is AltGr on many keyboards. Add Shift to keep typing @ and other characters.' };
  if (!standalone && lowered.length === 2) return { ok: true, warning: 'Browsers and editors use many two-modifier shortcuts. Ctrl + Alt + Shift is the safest choice.' };
  return { ok: true };
}

/**
 * The operating system repeats a held combination: the first repeat comes after the keyboard delay (500 ms by default),
 * then one every few tens of milliseconds. A global shortcut cannot tell a repeat from a new press, so it has to guess.
 * The old guess was "ignore anything within 700 ms", which also swallowed a quick second press. This one follows the
 * repeat stream itself: a press is only held back when it lands where a first repeat would, and is then confirmed by
 * whether more repeats follow. A deliberate second press fires at once or after a short wait.
 */
const DEFAULT_REPEAT = { delay: 500, interval: 33 };

/** Reads the keyboard repeat delay and rate from Windows. Anywhere else, or on error, the usual defaults. */
function readKeyboardRepeat(run) {
  try {
    if (process.platform !== 'win32') return DEFAULT_REPEAT;
    const exec = run ?? ((args) => require('node:child_process').execFileSync('reg', args, { encoding: 'utf8', timeout: 2000, windowsHide: true }));
    const read = (name) => { const m = /REG_SZ\s+(\d+)/.exec(exec(['query', 'HKCU\\Control Panel\\Keyboard', '/v', name])); return m ? Number(m[1]) : NaN; };
    const delay = read('KeyboardDelay'), speed = read('KeyboardSpeed');
    return {
      delay: Number.isFinite(delay) && delay >= 0 && delay <= 3 ? 250 + delay * 250 : DEFAULT_REPEAT.delay,
      interval: Number.isFinite(speed) && speed >= 0 && speed <= 31 ? Math.round(1000 / (2.5 + speed * (27.5 / 31))) : DEFAULT_REPEAT.interval,
    };
  } catch { return DEFAULT_REPEAT; }
}

function createShortcutManager({ globalShortcut, onFire, onResults, clock = () => Date.now(), repeat = DEFAULT_REPEAT, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let bindings = [];
  let enabled = true;
  let results = [];
  const streams = new Map(); // per binding: { lastEvent, lastPress, chain, pending }

  const MIN_GAP = 45;                                         // two real presses cannot be closer than this
  const delay = () => repeat.delay, interval = () => repeat.interval;
  const followMs = () => Math.min(700, Math.round(interval() * 1.6 + 30)); // how soon after a repeat the next one must come
  const ambiguous = (gap) => gap >= delay() - 100 && gap <= delay() + 200;

  function fire(binding) {
    const now = clock();
    // Volume is meant to repeat when held, so it only needs a small gap.
    if (/^volume\./.test(binding.command)) {
      const v = streams.get(binding.id) ?? {};
      if (now - (v.lastFire ?? -Infinity) >= 70) { streams.set(binding.id, { ...v, lastFire: now }); onFire(binding.command, binding); }
      return;
    }
    const st = streams.get(binding.id) ?? { lastEvent: -Infinity, lastPress: -Infinity, chain: false, pending: null };
    streams.set(binding.id, st);
    const sinceEvent = now - st.lastEvent;

    // An event soon after the previous one while we are unsure: it is the repeat stream, so the held one was a repeat.
    if (st.pending) {
      clearTimer(st.pending.timer); st.pending = null; st.chain = true; st.lastEvent = now; return;
    }
    // Inside a known repeat stream: swallow.
    if (st.chain && sinceEvent <= followMs()) { st.lastEvent = now; return; }
    st.chain = false;
    if (sinceEvent < MIN_GAP) { st.lastEvent = now; return; }

    const sincePress = now - st.lastPress;
    if (ambiguous(sincePress)) {
      // This could be the first repeat of a held key, or a deliberate second press. If more repeats follow it was a repeat.
      const at = now;
      st.lastEvent = now;
      st.pending = { timer: setTimer(() => {
        if (st.pending == null) return;
        st.pending = null; st.lastPress = at; onFire(binding.command, binding);
      }, followMs()) };
      return;
    }
    st.lastEvent = now; st.lastPress = now;
    onFire(binding.command, binding);
  }

  function apply() {
    try { globalShortcut.unregisterAll(); } catch { /* Nothing registered. */ }
    const taken = new Map();
    results = bindings.map((binding) => {
      const base = { id: binding.id, accelerator: binding.accelerator };
      if (!binding.accelerator) return { ...base, ok: true, active: false, reason: 'Not assigned.' };
      const check = validate(binding.accelerator);
      if (!check.ok) return { ...base, ok: false, active: false, reason: check.reason };
      const key = binding.accelerator.toLowerCase().replace(/commandorcontrol|cmdorctrl/g, 'ctrl').replace(/control/g, 'ctrl');
      if (taken.has(key)) return { ...base, ok: false, active: false, reason: `Already used by "${taken.get(key)}".` };
      taken.set(key, binding.label || binding.id);
      if (!enabled && !binding.always) return { ...base, ok: true, active: false, warning: check.warning, reason: 'Global shortcuts are switched off.' };
      try {
        const registered = globalShortcut.register(binding.accelerator, () => fire(binding));
        if (!registered) return { ...base, ok: false, active: false, reason: 'Another app already uses this combination.' };
        return { ...base, ok: true, active: true, warning: check.warning };
      } catch {
        return { ...base, ok: false, active: false, reason: 'This combination cannot be registered.' };
      }
    });
    onResults?.(results);
    return results;
  }

  return {
    validate,
    setBindings(list) {
      bindings = (Array.isArray(list) ? list : []).slice(0, 80).map((item) => ({
        id: String(item?.id ?? '').slice(0, 80),
        label: String(item?.label ?? '').slice(0, 80),
        accelerator: String(item?.accelerator ?? '').slice(0, 60),
        command: String(item?.command ?? '').slice(0, 160),
        always: item?.always === true,
      })).filter((item) => item.id && item.command);
      return apply();
    },
    setEnabled(value) { enabled = value !== false; return apply(); },
    isEnabled: () => enabled,
    results: () => results,
    dispose() { for (const st of streams.values()) if (st.pending) clearTimer(st.pending.timer); try { globalShortcut.unregisterAll(); } catch { /* Already gone. */ } },
  };
}

module.exports = { createShortcutManager, validate, readKeyboardRepeat, DEFAULT_REPEAT };
