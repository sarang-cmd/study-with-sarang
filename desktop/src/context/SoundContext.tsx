import { feedback } from '../lib/feedback';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { installRecordings } from '../lib/recordingsEnv';
import { setRecSettings, subscribeRecordings } from '../lib/recordings';
import { StudioEngine, setLoudnessBoost, setVolumeCap } from '../lib/synth';
import { LOUDNESS_BOOST, getPrefs, usePrefs } from '../lib/prefs';
import { decodeShare, defaultLayer, defaultMix, defaultTune, readCurrent, sanitizeMix, writeCurrent } from '../lib/mix';
import type { LayerSetting, MixState, Tune } from '../lib/mix';
import type { BaseId, LayerId } from '../lib/catalog';
import { localDay, readListening, writeListening } from '../lib/tracking';
import { notify } from '../components/ui/toast';

export const SOUND_TIMER_CHOICES = [0, 15, 25, 50, 90] as const;
const SOUND_TIMER_KEY = 'study-with-sarang:sound-timer';
const FADE_SECONDS = 15;

interface SoundValue {
  mix: MixState; seed: number; variation: number; playing: boolean; error: string; activeId: string | null;
  setMix: (update: (mix: MixState) => MixState) => void;
  setBase: (base: BaseId) => void;
  setVolume: (volume: number) => void;
  patchTune: (patch: Partial<Tune>) => void;
  resetTune: () => void;
  setLayer: (id: LayerId, patch: Partial<LayerSetting>) => void;
  clearLayers: () => void;
  loadMix: (mix: MixState, id?: string | null, options?: { play?: boolean }) => void;
  setActiveId: (id: string | null) => void;
  play: () => Promise<void>; pause: () => void; toggle: () => void; next: () => void; nudgeVolume: (delta: number) => void;
  analyser: () => AnalyserNode | null;
  setBreakDuck: (level: number) => void;
  setActivityDuck: (level: number) => void;
  /** Named volume reductions that stack by taking the quietest (Flow listening, the wind-down timer). 1 = no reduction. */
  setDuckSource: (source: string, level: number, fast?: boolean) => void;
  soundTimer: { minutes: number; remainingMs: number; set: (minutes: number) => void };
  listening: Record<string, number>;
  listenToday: number;
}

const SoundContext = createContext<SoundValue | null>(null);

function initialState(): { mix: MixState; seed: number; activeId: string | null; shared: boolean } {
  try {
    const match = /^#mix=([A-Za-z0-9_-]+)$/.exec(window.location.hash);
    if (match) {
      const shared = decodeShare(match[1]);
      if (shared) return { mix: shared, seed: 1597, activeId: null, shared: true };
    }
  } catch { /* Fall through to stored state. */ }
  const stored = readCurrent();
  return stored ? { ...stored, shared: false } : { mix: defaultMix(), seed: 1597, activeId: 'builtin-flow', shared: false };
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(initialState);
  const engine = useRef<StudioEngine | null>(null);
  const suspendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mix, setMixState] = useState<MixState>(initial.mix);
  const [seed, setSeed] = useState(initial.seed);
  const [activeId, setActiveId] = useState<string | null>(initial.activeId);
  const [variation, setVariation] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const mixRef = useRef(mix); mixRef.current = mix;
  const seedRef = useRef(seed); seedRef.current = seed;
  const playingRef = useRef(false); playingRef.current = playing;
  const breakDuck = useRef(1);
  const fadeDuck = useRef(1);
  const activityDuck = useRef(1);
  const duckSources = useRef(new Map<string, number>());
  const duckFast = useRef(false);
  const [prefs] = usePrefs();

  // A shared link is read once, then removed from the address bar so that a later
  // reload shows your own saved state instead of re-applying the link.
  useEffect(() => {
    if (!initial.shared) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    notify({ title: 'Shared mix loaded', message: `"${initial.mix.name}" is ready. Press play to hear it. Save it if you want to keep it.`, variant: 'success', id: 'share-status', duration: 7000 });
  }, [initial]);

  useEffect(() => { engine.current?.sync(mix, seed); }, [mix, seed]);
  // Real recordings: set up the loader, and rebuild the layers when a recording becomes (or stops being) available.
  useEffect(() => { installRecordings(); }, []);
  useEffect(() => { setRecSettings(prefs.recordings); }, [prefs.recordings]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = subscribeRecordings(() => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; engine.current?.sync(mixRef.current, seedRef.current); }, 60);
    });
    return () => { off(); if (timer) clearTimeout(timer); };
  }, []);
  useEffect(() => { if (playingRef.current) engine.current?.setMaster(mix.volume / 100); }, [mix.volume]);
  // The optional rhythm layer (Settings, Neural lock). Depth 0 when off, so the sound is exactly the normal mix.
  useEffect(() => { engine.current?.setPulse(prefs.neural.rate, prefs.neural.on ? prefs.neural.depth / 100 : 0); }, [prefs.neural.on, prefs.neural.rate, prefs.neural.depth]);
  // Loudness and volume cap (Settings > Sound). Applied to the live sound as soon as they change.
  useEffect(() => {
    setLoudnessBoost(LOUDNESS_BOOST[prefs.loudness]); setVolumeCap(prefs.volumeCap);
    if (playingRef.current) engine.current?.setMaster(mixRef.current.volume / 100, .15);
  }, [prefs.loudness, prefs.volumeCap]);
  useEffect(() => {
    const timeout = window.setTimeout(() => writeCurrent({ mix, seed, activeId }), 300);
    return () => window.clearTimeout(timeout);
  }, [mix, seed, activeId]);

  const applyDuck = useCallback(() => engine.current?.setDuck(Math.min(breakDuck.current, fadeDuck.current, activityDuck.current, ...duckSources.current.values()), duckFast.current ? .07 : .4), []);
  const setDuckSource = useCallback((source: string, level: number, fast = false) => {
    if (level >= .999) duckSources.current.delete(source); else duckSources.current.set(source, Math.max(0, Math.min(1, level)));
    duckFast.current = fast; applyDuck();
  }, [applyDuck]);
  const setActivityDuck = useCallback((level: number) => { activityDuck.current = Math.max(0, Math.min(1, level)); applyDuck(); }, [applyDuck]);
  const setBreakDuck = useCallback((level: number) => { breakDuck.current = level; applyDuck(); }, [applyDuck]);

  const play = useCallback(async () => {
    setError('');
    try {
      if (!engine.current) engine.current = new StudioEngine();
      const player = engine.current;
      if (suspendTimer.current) clearTimeout(suspendTimer.current);
      await player.context.resume();
      player.sync(mixRef.current, seedRef.current);
      player.setPulse(getPrefs().neural.rate, getPrefs().neural.on ? getPrefs().neural.depth / 100 : 0, .001);
      applyDuck();
      player.rampMaster(mixRef.current.volume / 100, getPrefs().fadeIn);
      setPlaying(true);
    } catch { setError('Audio is unavailable. Try a modern browser and start playback with a click or tap.'); }
  }, [applyDuck]);

  const pause = useCallback(() => {
    const player = engine.current;
    if (player) {
      const out = getPrefs().fadeOut;
      player.rampMaster(0, out);
      suspendTimer.current = setTimeout(() => { if (player.context.state === 'running') void player.context.suspend(); }, Math.round(out * 1000) + 70);
    }
    setPlaying(false);
  }, []);
  const toggle = useCallback(() => {
    if (playingRef.current) { pause(); feedback('Sound paused', { sound: 'pause', id: 'sound' }); } else { void play(); feedback('Sound playing', { sound: 'start', id: 'sound' }); }
  }, [pause, play]);

  // "Start playing when the app opens" (Settings > Sound). Only when the system allows sound without a click, which
  // the desktop app does. In a browser it starts only if the browser permits it; it never waits for a later click.
  useEffect(() => {
    if (!getPrefs().startPlaying || initial.shared) return;
    const timeout = window.setTimeout(() => {
      try {
        if (!engine.current) engine.current = new StudioEngine();
        if (engine.current.context.state !== 'running') { engine.current.dispose(); engine.current = null; return; }
        void play();
      } catch { /* Not allowed here. */ }
    }, 600);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = useCallback(() => {
    setSeed(Math.floor(Math.random() * 2147483646) + 1); setVariation((count) => count + 1);
    feedback(`Next variation of ${mixRef.current.name}`, { sound: 'next', id: 'sound' });
  }, []);

  const setMix = useCallback((update: (mix: MixState) => MixState) => setMixState((previous) => update(previous)), []);
  const setBase = useCallback((base: BaseId) => setMixState((previous) => ({ ...previous, base })), []);
  const setVolume = useCallback((volume: number) => setMixState((previous) => ({ ...previous, volume: Math.max(0, Math.min(100, Math.round(volume))) })), []);
  const patchTune = useCallback((patch: Partial<Tune>) => setMixState((previous) => ({ ...previous, tune: { ...previous.tune, ...patch } })), []);
  const resetTune = useCallback(() => setMixState((previous) => ({ ...previous, tune: { ...defaultTune } })), []);
  const setLayer = useCallback((id: LayerId, patch: Partial<LayerSetting>) => setMixState((previous) => {
    const merged = { ...defaultLayer, ...previous.layers[id], ...patch };
    const layers = { ...previous.layers };
    if (merged.level > 0) layers[id] = merged; else delete layers[id];
    return { ...previous, layers };
  }), []);
  const nudgeVolume = useCallback((delta: number) => {
    const volume = Math.max(0, Math.min(100, Math.round(mixRef.current.volume + delta)));
    setMixState((previous) => ({ ...previous, volume }));
    feedback(`Volume ${volume}%`, { sound: null, id: 'volume', duration: 1000 });
  }, []);
  const clearLayers = useCallback(() => setMixState((previous) => ({ ...previous, layers: {} })), []);

  const loadMix = useCallback((incoming: MixState, id: string | null = null, options?: { play?: boolean }) => {
    const clean = sanitizeMix(incoming, incoming.name);
    mixRef.current = clean;
    setMixState(clean); setActiveId(id);
    if (options?.play) void play();
  }, [play]);

  // --- Sound timer: counts only while sound plays, fades out at the end. ---
  const [timerMinutes, setTimerMinutes] = useState(() => {
    try { const saved = Number(localStorage.getItem(SOUND_TIMER_KEY)); return (SOUND_TIMER_CHOICES as readonly number[]).includes(saved) ? saved : 0; } catch { return 0; }
  });
  const [remainingMs, setRemainingMs] = useState(timerMinutes * 60_000);
  const setSoundTimer = useCallback((minutes: number) => {
    if (!(SOUND_TIMER_CHOICES as readonly number[]).includes(minutes)) return;
    setTimerMinutes(minutes); setRemainingMs(minutes * 60_000);
    fadeDuck.current = 1; applyDuck();
    try { localStorage.setItem(SOUND_TIMER_KEY, String(minutes)); } catch { /* Kept for this visit. */ }
  }, [applyDuck]);
  useEffect(() => {
    if (!playing || !timerMinutes) return;
    let last = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const delta = now - last; last = now;
      setRemainingMs((value) => Math.max(0, value - delta));
    }, 500);
    return () => window.clearInterval(interval);
  }, [playing, timerMinutes]);
  useEffect(() => {
    if (!playing || !timerMinutes) { fadeDuck.current = 1; applyDuck(); return; }
    fadeDuck.current = remainingMs <= FADE_SECONDS * 1000 ? Math.max(0, remainingMs / (FADE_SECONDS * 1000)) : 1;
    applyDuck();
    if (remainingMs <= 0) {
      pause(); fadeDuck.current = 1; setRemainingMs(timerMinutes * 60_000);
      notify({ title: 'Sound timer finished', message: 'The sound faded out and paused.', variant: 'success', id: 'sound-timer' });
    }
  }, [remainingMs, playing, timerMinutes, pause, applyDuck]);

  // --- Time spent listening, saved per day, in the browser only. ---
  const [listening, setListening] = useState(readListening);
  useEffect(() => {
    if (!playing) return;
    let pending = 0;
    const flush = () => {
      if (!pending) return;
      const day = localDay(new Date()), add = pending; pending = 0;
      setListening((previous) => { const next = { ...previous, [day]: (previous[day] ?? 0) + add }; writeListening(next); return next; });
    };
    const tick = window.setInterval(() => { pending++; if (pending >= 10) flush(); }, 1000);
    return () => { window.clearInterval(tick); flush(); };
  }, [playing]);
  const listenToday = listening[localDay(new Date())] ?? 0;

  useEffect(() => () => { if (suspendTimer.current) clearTimeout(suspendTimer.current); engine.current?.dispose(); engine.current = null; }, []);

  const value = useMemo<SoundValue>(() => ({
    mix, seed, variation, playing, error, activeId, setMix, setBase, setVolume, patchTune, resetTune, setLayer, clearLayers, loadMix, setActiveId,
    play, pause, toggle, next, nudgeVolume, analyser: () => engine.current?.analyser ?? null, setBreakDuck, setActivityDuck, setDuckSource,
    soundTimer: { minutes: timerMinutes, remainingMs, set: setSoundTimer }, listening, listenToday,
  }), [mix, seed, variation, playing, error, activeId, setMix, setBase, setVolume, patchTune, resetTune, setLayer, clearLayers, loadMix, play, pause, toggle, next, nudgeVolume, setBreakDuck, setActivityDuck, setDuckSource, timerMinutes, remainingMs, setSoundTimer, listening, listenToday]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundValue {
  const value = useContext(SoundContext);
  if (!value) throw new Error('SoundProvider is missing.');
  return value;
}
