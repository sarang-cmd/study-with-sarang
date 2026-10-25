/**
 * Media keys the way a browser does it. The page announces itself to the operating system as a media player (a silent
 * audio element plus the Media Session API), so the system sends Play/Pause to whichever player started most recently.
 * Pause a video in another window and the key controls that video; press play on this app and the key controls this
 * app. Nothing is grabbed globally.
 */
let lastAccepted = 0;
/**
 * The key can arrive twice (as a Media Session action and as a key press while the page is focused). Only the first one
 * in a short window counts, otherwise play and pause would cancel each other.
 */
export function acceptMediaAction(now = Date.now(), windowMs = 350): boolean {
  if (now - lastAccepted < windowMs) return false;
  lastAccepted = now;
  return true;
}
export const resetMediaGate = () => { lastAccepted = 0; };

/** One second of silence as a WAV (8 kHz, 8-bit mono). An audio track the system can see, with nothing to hear. */
export function silentWav(seconds = 1): Uint8Array {
  const rate = 8000, length = rate * seconds, bytes = new Uint8Array(44 + length);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, 36 + length, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, 'data'); view.setUint32(40, length, true);
  bytes.fill(128, 44); // 8-bit PCM silence is 128
  return bytes;
}

export interface SessionActions { play: () => void; pause: () => void; next: () => void }
export interface SessionState { playing: boolean; title: string; artwork?: boolean; album?: string; icon?: string }

/** The app icon in the sizes media controls ask for (Windows media flyout, lock screen, phone notification shade). */
export const ARTWORK_SIZES = [96, 128, 256, 512] as const;
export function artworkList(base: string, icon = 'default'): { src: string; sizes: string; type: string }[] {
  return ARTWORK_SIZES.map((size) => ({ src: new URL(`icons/${icon}/art-${size}.png`, base).href, sizes: `${size}x${size}`, type: 'image/png' }));
}

let element: HTMLAudioElement | null = null;
function ensureElement(): HTMLAudioElement | null {
  if (typeof document === 'undefined' || typeof Audio === 'undefined' || typeof URL === 'undefined') return null;
  if (element) return element;
  try {
    const url = URL.createObjectURL(new Blob([silentWav(1) as BlobPart], { type: 'audio/wav' }));
    const audio = new Audio(url);
    audio.loop = true; audio.preload = 'auto'; audio.setAttribute('aria-hidden', 'true');
    element = audio;
  } catch { element = null; }
  return element;
}

export type SeekMode = 'remaining' | 'elapsed' | 'off';
export interface PositionInput { mode: 'pomodoro' | 'countdown' | 'stopwatch'; seconds: number; totalSeconds: number }
/**
 * What the seek bar in the Windows media flyout (and other media controls) shows: the session's own clock.
 * "remaining": the bar drains and the left time counts down (25:00 down to 0 for a focus block, 5:00 for a break).
 * "elapsed": the bar fills. A stopwatch has no length, so it shows no bar.
 */
export function positionFor(mode: SeekMode, t: PositionInput): { duration: number; position: number } | null {
  if (mode === 'off' || t.mode === 'stopwatch' || !(t.totalSeconds > 0)) return null;
  const duration = Math.round(t.totalSeconds);
  const left = Math.max(0, Math.min(duration, Math.round(t.seconds)));
  return { duration, position: mode === 'remaining' ? left : duration - left };
}
/** A title for the flyout. "phase": what you are doing; "mix": the sound; "both": phase and sound together while a timer is going. */
export function titleFor(style: 'phase' | 'mix' | 'both', phase: string, timerActive: boolean, mixName: string): string {
  const mix = mixName.trim() || 'Focus sound';
  if (!timerActive || style === 'mix') return mix;
  return style === 'phase' ? phase : `${phase} \u00b7 ${mix}`;
}
/** Sets (or clears, with null) the position shown by the system. Safe to call every second. */
export function setSessionPosition(value: { duration: number; position: number } | null, _playing = false) {
  if (!supported()) return;
  try {
    const session = navigator.mediaSession;
    if (!value || typeof session.setPositionState !== 'function') { session.setPositionState?.(); return; }
    // The page updates this once a second itself, so the system should hold still in between. A rate of exactly 0 is rejected by browsers.
    session.setPositionState({ duration: value.duration, position: Math.max(0, Math.min(value.duration, value.position)), playbackRate: 0.001 });
  } catch { /* Not supported by this player. */ }
}

const supported = () => typeof navigator !== 'undefined' && 'mediaSession' in navigator;
function setHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null) { try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* This action is not supported here. */ } }

/** Turns the bridge on or off and tells the system what is happening. Call again whenever the state changes. */
export function syncMediaSession(enabled: boolean, state: SessionState, actions: SessionActions) {
  if (!supported()) return;
  const session = navigator.mediaSession;
  if (!enabled) {
    for (const action of ['play', 'pause', 'stop', 'nexttrack', 'previoustrack'] as MediaSessionAction[]) setHandler(action, null);
    element?.pause(); session.metadata = null; session.playbackState = 'none';
    return;
  }
  const run = (fn: () => void): MediaSessionActionHandler => () => { if (acceptMediaAction()) fn(); };
  setHandler('play', run(actions.play));
  setHandler('pause', run(actions.pause));
  setHandler('stop', run(actions.pause));
  setHandler('nexttrack', run(actions.next));
  setHandler('previoustrack', null);
  // The bar is for looking at, not seeking: the session's clock cannot be moved from the flyout.
  for (const action of ['seekto', 'seekforward', 'seekbackward'] as MediaSessionAction[]) setHandler(action, null);
  try {
    let artwork: ReturnType<typeof artworkList> = [];
    try { if (state.artwork !== false && typeof document !== 'undefined' && document.baseURI) artwork = artworkList(document.baseURI, state.icon); } catch { artwork = []; } // No icon is better than no player.
    session.metadata = new MediaMetadata({ title: state.title || 'Focus sound', artist: 'Study with Sarang', album: state.album || 'Focus', artwork });
  } catch { /* Not supported. */ }
  session.playbackState = state.playing ? 'playing' : 'paused';
  const audio = ensureElement();
  if (!audio) return;
  if (state.playing) void audio.play().catch(() => undefined); else audio.pause();
}
