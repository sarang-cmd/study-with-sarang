import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { notify } from '../components/ui/toast';
import { useFullscreen } from '../hooks/useFullscreen';
import { splitCommand } from '../lib/commands';
import { getPrefs } from '../lib/prefs';
import { beginWindDown, closeCalm, openCalm, stopWindDown } from '../lib/calmState';
import { toggleSimple } from '../lib/uiActions';
import { addTodo, getPlan, getTodos, setPlan, toggleTodo } from '../lib/plan';
import { scheduleReviews } from '../lib/reviews';
import { examDate, daysUntil, getProfile } from '../lib/subjects';
import { answerInfo, spokenDuration } from '../lib/answers';
import { applyTheme } from '../hooks/useTheme';
import { acceptMediaAction } from '../lib/mediaSession';
import { applyOverrides, isMediaBinding, readOverrides, toPayload, writeOverrides, type Binding } from '../lib/desktopConfig';
import { desktop, isDesktop, type DesktopInfo, type DesktopState, type ShortcutResult, type VoiceEvent, type VoiceStatus } from '../lib/desktop';
import { clampInt, isWindowStep, readMacros, sanitizeMacros, stepCommand, writeMacros, type Macro, type MacroStep } from '../lib/macros';
import { builtInMixes, readSavedMixes } from '../lib/mix';
import { clock } from '../lib/tracking';
import { parseIntent, norm } from '../lib/intent';
import { buildVoiceConfig, buildVoiceEntries, matchHeard, wakeList, readVoice, writeVoice, type VoiceSettings } from '../lib/voice';
import { patchVoiceMeter, getVoiceMeter, recordLevel, resetVoiceMeter } from '../lib/voiceMeter';
import { feedback } from '../lib/feedback';
import { getPuck, setPuck } from '../lib/puck';
import { addNote, osNotify } from '../lib/notifications';
import { getFlowVoiceWanted } from '../lib/flowRuntime';
import { useSound } from './SoundContext';
import { useTimer } from './TimerContext';

interface UiHooks { toggleZen: () => void; openZen: () => void; closeZen: () => void; toggleFullscreen: () => void; openSettings: (tab?: string) => void; togglePalette: () => void; toggleLayout: () => void; goPage: (id: string) => void }
export interface Heard { text: string; command: string | null; at: number; confidence?: number; reason?: 'confidence' | 'wake' }
export interface DesktopContextValue {
  available: boolean; info: DesktopInfo | null; state: DesktopState | null; mac: boolean;
  bindings: Binding[]; shortcutResults: Record<string, ShortcutResult>;
  setAccelerator: (id: string, accelerator: string) => void; resetBindings: () => void;
  runSteps: (steps: MacroStep[], alive: () => boolean, touched?: () => void) => Promise<void>;
  macros: Macro[]; setMacros: (update: (current: Macro[]) => Macro[]) => void; runMacro: (macro: Macro) => void; macroRunning: string | null;
  voice: VoiceSettings; setVoice: (patch: Partial<VoiceSettings>) => void; voiceTesting: boolean; setVoiceTesting: (on: boolean) => void; voiceStatus: { status: VoiceStatus; language?: string; message?: string }; lastHeard: Heard | null;
  run: (command: string, source?: 'page' | 'external') => void;
  /** Runs a command and returns the sentence to show or speak (questions, music, timers). Used by Flow. */
  ask: (command: string) => Promise<string | void>;
  registerUi: (hooks: Partial<UiHooks>) => void; allMixNames: () => string[];
}

const Context = createContext<DesktopContextValue | null>(null);
const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

export function DesktopProvider({ children }: { children: ReactNode }) {
  const sound = useSound();
  const timer = useTimer();
  const [info, setInfo] = useState<DesktopInfo | null>(null);
  const [state, setState] = useState<DesktopState | null>(null);
  const [overrides, setOverrides] = useState(readOverrides);
  const [macros, setMacrosState] = useState(readMacros);
  const [voice, setVoiceState] = useState(readVoice);
  const [voiceStatus, setVoiceStatus] = useState<{ status: VoiceStatus; language?: string; message?: string }>({ status: 'off' });
  const [lastHeard, setLastHeard] = useState<Heard | null>(null);
  const [voiceTesting, setVoiceTestingState] = useState(false);
  const [macroRunning, setMacroRunning] = useState<string | null>(null);
  const fullscreen = useFullscreen();
  const ui = useRef<Partial<UiHooks>>({});
  const voiceTestingRef = useRef(false);
  const token = useRef(0);
  const mac = (info?.platform ?? '') === 'darwin';
  const latest = useRef({ sound, timer, macros, voice });
  latest.current = { sound, timer, macros, voice };

  const allMixNames = useCallback(() => [...builtInMixes.map((item) => item.mix.name), ...readSavedMixes().map((item) => item.name)], []);
  const findMix = useCallback((name: string) => {
    const wanted = name.trim().toLowerCase();
    if (!wanted) return null;
    const saved = readSavedMixes();
    const all = [...builtInMixes.map((item) => ({ mix: item.mix, id: item.id })), ...saved.map((item) => ({ mix: item.mix, id: item.id }))];
    if (/^[1-9]$/.test(wanted) && builtInMixes[Number(wanted) - 1]) return all[Number(wanted) - 1];
    return all.find((item) => item.mix.name.toLowerCase() === wanted) ?? all.find((item) => item.mix.name.toLowerCase().startsWith(wanted)) ?? null;
  }, []);

  const runMacroRef = useRef<(macro: Macro) => void>(() => undefined);
  /** Runs one command. Commands for the window and the app go to the main process, the rest run here. */
  const execute = useCallback(async (text: string, source: 'page' | 'external' | 'flow'): Promise<string | void> => {
    const { id, arg } = splitCommand(text);
    const { sound: s, timer: t } = latest.current;
    /** A sentence for the person. Flow shows and speaks it; everything else gets a short toast. */
    const reply = (message: string) => { if (source !== 'flow') notify({ message, variant: 'default', duration: 3200 }); return message; };
    const music = async (action: 'pause' | 'play' | 'toggle' | 'next' | 'prev' | 'stop'): Promise<string> => {
      if (desktop?.media) {
        const r = await desktop.media(action);
        if (r && r.result.ok && r.result.status !== 'nothing') return reply(r.text);
        // Nothing in another app: use the app's own sound for the things that make sense.
        if ((action === 'pause' || action === 'stop') && s.playing) { s.pause(); return reply('No other player was playing, so I paused the Study with Sarang sound.'); }
        if (action === 'play' || action === 'toggle') { if (!s.playing) { await s.play(); return reply('Nothing was paused in other apps, so I started your Study with Sarang sound.'); } }
        if (action === 'next' && s.playing) { s.next(); return reply('Next variation of your Study with Sarang sound.'); }
        return reply(r?.text || 'No other player is playing right now.');
      }
      // A browser page cannot reach other apps. Say so, and do the nearest useful thing.
      if (action === 'pause' || action === 'stop') { if (s.playing) { s.pause(); return reply('A browser cannot control other apps, so I paused the sound in this page.'); } }
      if (action === 'play' || action === 'toggle') { if (!s.playing) { await s.play(); return reply('A browser cannot control other apps, so I started the sound in this page.'); } }
      return reply('A browser cannot control other apps. The desktop app can.');
    };
    switch (id) {
      case 'music.pause': return music('pause');
      case 'music.play': return music('play');
      case 'music.toggle': return music('toggle');
      case 'music.next': return music('next');
      case 'music.prev': return music('prev');
      case 'music.stop': return music('stop');
      case 'info': {
        if (arg === 'playing') {
          if (!desktop?.media) return reply('A browser cannot see what other apps play. The desktop app can.');
          const r = await desktop.media('info');
          return reply(r?.text || 'Nothing is playing in another app.');
        }
        const sessions = t.sessions; const exam = daysUntil(examDate(getProfile()));
        return reply(answerInfo(arg, { now: new Date(), sessions, goal: getPlan().goal, todos: getTodos(), examDays: exam, timer: { mode: t.mode, phase: t.phase, running: t.running, seconds: t.seconds } }));
      }
      case 'timer.left': return reply(answerInfo('left', { now: new Date(), sessions: [], goal: '', todos: [], examDays: null, timer: { mode: t.mode, phase: t.phase, running: t.running, seconds: t.seconds } }));
      case 'timer.session': {
        const [minPart, ...rest] = arg.split(';'); const goal = rest.join(';').trim(); const minutes = clampInt(minPart, 0, 600, 0);
        if (t.running) return reply('A session is already running. Pause or finish it first.');
        if (goal) setPlan({ goal });
        if (minutes) {
          if (t.mode === 'countdown') t.setSettings({ countdownMin: minutes });
          else { if (t.mode === 'stopwatch') t.setMode('pomodoro'); t.setSettings({ focusMin: minutes }); }
        }
        if (t.mode === 'pomodoro' && t.phase !== 'focus') t.skip();
        t.startNow();
        return reply(`Focus started${minutes ? `: ${spokenDuration(minutes * 60)}` : ''}${goal ? `, ${goal}` : ''}. Good luck.`);
      }
      case 'timer.countdown': {
        const minutes = clampInt(arg, 1, 600, 0); if (!minutes) return;
        if (t.running) return reply('A timer is already running. Pause or finish it first.');
        t.setMode('countdown'); t.setSettings({ countdownMin: minutes }); t.startNow();
        return reply(`Countdown started: ${spokenDuration(minutes * 60)}.`);
      }
      case 'goal.start': {
        if (t.running) return reply('A session is already running.');
        if (arg) setPlan({ goal: arg.slice(0, 140) });
        if (t.mode === 'pomodoro' && t.phase !== 'focus') t.skip();
        t.startNow();
        return reply(`Starting: ${arg}.`);
      }
      case 'goal.set': { if (!arg) return; setPlan({ goal: arg.slice(0, 140) }); return reply(`Goal set: ${arg}.`); }
      case 'goal.clear': setPlan({ goal: '' }); return reply('Goal cleared.');
      case 'todo.add': { const added = arg ? addTodo(arg, getPlan().subject) : null; return reply(added ? `Added to your to-dos: ${added.text}.` : 'I could not add that to-do.'); }
      case 'todo.done': {
        const wanted = arg.trim().toLowerCase();
        const item = getTodos().find((x) => !x.done && x.text.toLowerCase() === wanted) ?? getTodos().find((x) => !x.done && x.text.toLowerCase().includes(wanted));
        if (!item) return reply(`I could not find an open to-do called "${arg}".`);
        toggleTodo(item.id); return reply(`Ticked off: ${item.text}.`);
      }
      case 'review.add': {
        const count = arg ? scheduleReviews(arg, getPlan().subject, getPrefs().session.reviewDays) : 0;
        return reply(count ? `I will remind you to review ${arg} on ${count} day${count === 1 ? '' : 's'}.` : 'I could not schedule that review.');
      }
      case 'break.start': {
        if (t.mode !== 'pomodoro') return reply('Breaks are part of Pomodoro mode.');
        if (t.phase !== 'focus') return reply('You are already on a break.');
        t.skip(); return reply('Break time. Step away from the screen for a bit.');
      }
      case 'break.end': {
        if (t.mode !== 'pomodoro' || t.phase === 'focus') return reply('You are already in a focus block.');
        t.skip(); return reply('Back to work.');
      }
      case 'page.go': ui.current.goPage?.(arg); return;
      case 'theme.set': {
        const dark = document.documentElement.classList.contains('dark');
        applyTheme(arg === 'toggle' ? !dark : arg === 'dark');
        return reply(arg === 'toggle' ? 'Theme switched.' : `${arg === 'dark' ? 'Dark' : 'Light'} mode.`);
      }
      case 'bell.open': window.dispatchEvent(new CustomEvent('swa:open-bell')); return;
      case 'help.open': ui.current.openSettings?.('flow'); return;
      case 'toast': notify({ message: arg, variant: 'default', duration: 1800 }); return;
      case 'sound.toggle': s.toggle(); return;
      case 'sound.play': await s.play(); return;
      case 'sound.pause': s.pause(); return;
      case 'sound.next': s.next(); return;
      case 'volume.up': s.nudgeVolume(5); return;
      case 'volume.down': s.nudgeVolume(-5); return;
      case 'volume.set': s.setVolume(clampInt(arg, 0, 100, s.mix.volume)); return;
      case 'timer.toggle': t.toggle(); return;
      case 'timer.start': if (!t.running) t.start(); return;
      case 'timer.pause': if (t.running) t.pause(); return;
      case 'timer.reset': t.reset(); return;
      case 'timer.skip': t.skip(); return;
      case 'timer.drift': t.markDistraction(); return;
      case 'timer.finish': t.finish(); return;
      case 'puck.toggle': { const p = getPuck(); if (isDesktop) setPuck({ desk: p.desk === 'off' ? 'always' : 'off' }); else setPuck({ page: p.page === 'off' ? 'always' : 'off' }); return; }
      case 'settings.open': ui.current.openSettings?.(arg || undefined); return;
      case 'palette.open': ui.current.togglePalette?.(); return;
      case 'layout.toggle': ui.current.toggleLayout?.(); return;
      case 'zen.toggle': ui.current.toggleZen?.(); return;
      case 'zen.open': ui.current.openZen?.(); return;
      case 'zen.close': ui.current.closeZen?.(); return;
      case 'fullscreen.toggle': ui.current.toggleFullscreen?.(); return;
      case 'mix.load': {
        const found = findMix(arg);
        if (found) { s.loadMix(found.mix, found.id, { play: true }); feedback(`Loaded ${found.mix.name}`, { sound: 'start', id: 'sound' }); }
        else notify({ message: `No mix called "${arg}"`, variant: 'warning' });
        return;
      }
      case 'macro.run': {
        const wanted = arg.trim().toLowerCase();
        const macro = latest.current.macros.find((item) => item.id === arg || item.name.toLowerCase() === wanted);
        if (macro) runMacroRef.current(macro);
        else notify({ message: `No macro called "${arg}"`, variant: 'warning' });
        return;
      }
      case 'calm.open': openCalm({ tab: arg === 'scene' || arg === 'ground' || arg === 'wind' ? arg : 'breathe' }); return;
      case 'calm.close': closeCalm(); return;
      case 'calm.breathe': openCalm({ tab: 'breathe', pattern: arg || null }); return;
      case 'calm.ground': openCalm({ tab: 'ground' }); return;
      case 'calm.scene': openCalm({ tab: 'scene', scene: (arg || null) as never }); return;
      case 'calm.wind': {
        if (arg === 'off') { stopWindDown(); notify({ message: 'Wind-down cancelled', variant: 'default', duration: 1800 }); return; }
        const minutes = clampInt(arg, 1, 240, getPrefs().calm.windMinutes);
        beginWindDown(Date.now(), arg ? minutes : undefined);
        notify({ message: `Winding down over ${minutes} minutes`, variant: 'default', duration: 2200 });
        return;
      }
      case 'ui.simple': {
        const level = getPrefs().uiLevel;
        if (arg === 'on' ? level !== 'simple' : arg === 'off' ? level === 'simple' : true) toggleSimple();
        return;
      }
      case 'voice.toggle': setVoiceState((current) => ({ ...current, enabled: !current.enabled })); return;
      default:
        // Window and app commands are carried out by the main process.
        if (source !== 'external' && desktop) desktop.command(text);
    }
  }, [findMix]);

  /** Runs a list of steps one after another. `alive` lets the caller stop it; `touched` is told each time a step really did something. */
  const runSteps = useCallback(async (steps: MacroStep[], alive: () => boolean, touched?: () => void) => {
    for (const step of steps) {
      if (!alive()) return;
      if (step.type === 'wait') { await sleep(clampInt(step.value, 1, 600, 5) * 1000); continue; }
      if (step.type === 'notify') {
        if (!step.value) continue;
        touched?.();
        notify({ title: 'Automation', message: step.value, variant: 'default', duration: 6000 });
        addNote({ kind: 'reminder', title: 'Message', message: step.value });
        if (desktop) osNotify('Study with Sarang', step.value);
        await sleep(90); continue;
      }
      const command = stepCommand(step);
      if (!command) continue;
      touched?.();
      if (isWindowStep(step.type)) desktop?.command(command); else await execute(command, 'page');
      await sleep(90);
    }
  }, [execute]);

  /** A new run cancels the one before it, so two macros never fight over the sound. */
  const runMacro = useCallback((macro: Macro) => {
    const mine = ++token.current;
    setMacroRunning(macro.id);
    void (async () => {
      try { await runSteps(macro.steps, () => mine === token.current); }
      finally { if (mine === token.current) setMacroRunning(null); }
    })();
  }, [runSteps]);
  runMacroRef.current = runMacro;

  const run = useCallback((command: string, source: 'page' | 'external' = 'page') => { void execute(command, source); }, [execute]);
  const ask = useCallback((command: string) => execute(command, 'flow'), [execute]);

  // ---- connect to the shell ----------------------------------------------------------------
  useEffect(() => {
    const api = desktop;
    if (!api) return;
    let gone = false;
    const unsubscribe = [
      api.onState((next) => setState(next)),
      api.onCommand((command) => { void execute(command.arg ? `${command.id}:${command.arg}` : command.id, 'external'); }),
      api.onVoice((event) => handleVoice(event)),
    ];
    void api.getInfo().then((value) => {
      if (gone || !value) return;
      setInfo(value); setState(value.state);
      api.ready(); // Anything queued while the page loaded (a Stream Deck press that started the app) runs now.
    });
    return () => { gone = true; unsubscribe.forEach((off) => off()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- page classes: title bar space, glass, compact ---------------------------------------
  useEffect(() => {
    const root = document.documentElement;
    if (!isDesktop) return;
    root.classList.add('desktop');
    return () => root.classList.remove('desktop', 'glass', 'titlebar', 'compact');
  }, []);
  useEffect(() => {
    if (!info) return;
    const root = document.documentElement;
    root.classList.toggle('glass', info.glass);
    root.classList.toggle('titlebar', info.titlebar !== 'none');
    root.classList.toggle('titlebar-mac', info.titlebar === 'inset');
    root.style.setProperty('--titlebar', info.titlebar === 'none' || fullscreen.active ? '0px' : `${info.titlebarHeight}px`);
  }, [info, fullscreen.active]);
  useEffect(() => { document.documentElement.classList.toggle('compact', Boolean(state?.compact)); }, [state?.compact]);

  // Keep the native title bar colors in step with the page theme.
  useEffect(() => {
    const api = desktop;
    if (!api) return;
    const send = () => api.setTheme(document.documentElement.classList.contains('dark'));
    send();
    const watcher = new MutationObserver(send);
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => watcher.disconnect();
  }, []);

  // ---- shortcuts ---------------------------------------------------------------------------
  const defaults = useMemo(() => applyOverrides(overrides), [overrides]);
  const bindings = useMemo<Binding[]>(() => [
    ...defaults,
    ...macros.filter((macro) => macro.shortcut).map((macro) => ({ id: `macro:${macro.id}`, label: `Macro: ${macro.name}`, command: `macro.run:${macro.id}`, accelerator: macro.shortcut, macroId: macro.id })),
  ], [defaults, macros]);
  const [registered, setRegistered] = useState<ShortcutResult[]>([]);
  // When the app started in "most recent player" mode the system routes the media keys itself (lib/mediaSession), so they must not also be grabbed globally.
  const mediaKeysOn = state?.behavior.mediaKeys !== false && !state?.behavior.mediaFollowActive;
  useEffect(() => {
    if (!desktop || !info) return;
    const timeout = setTimeout(() => { void desktop?.setShortcuts(toPayload(mediaKeysOn ? bindings : bindings.filter((item) => !isMediaBinding(item.id)))).then(setRegistered); }, 150);
    return () => clearTimeout(timeout);
  }, [bindings, info, mediaKeysOn]);
  const shortcutResults = useMemo(() => {
    const byId = new Map((state?.shortcutResults ?? registered).map((item) => [item.id, item]));
    return Object.fromEntries(bindings.map((item) => [item.id, byId.get(item.id) ?? { id: item.id, accelerator: item.accelerator, ok: true, active: false }]));
  }, [bindings, state?.shortcutResults, registered]);
  const setAccelerator = useCallback((id: string, accelerator: string) => {
    if (id.startsWith('macro:')) { setMacrosState((current) => current.map((macro) => (macro.id === id.slice(6) ? { ...macro, shortcut: accelerator } : macro))); return; }
    setOverrides((current) => ({ ...current, [id]: accelerator }));
  }, []);
  const resetBindings = useCallback(() => setOverrides({}), []);
  useEffect(() => { writeOverrides(overrides); }, [overrides]);

  // ---- Pause/Break and media keys while this page is focused ------------------------------
  // On Windows the shell claims Pause/Break and the media keys system-wide, so the page never sees them. Everywhere else
  // (the web app, macOS, Linux) they work while the page has focus.
  const pauseSetting = state?.behavior.pauseKey;
  const pauseCommand = state?.behavior.pauseKeyCommand ?? 'sound.toggle';
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented) return;
      const prefs = getPrefs();
      const target = event.target instanceof HTMLElement ? event.target : null;
      const typing = Boolean(target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)));
      if (event.code === 'Pause') {
        if (isDesktop ? pauseSetting === false : !prefs.pauseKey) return;
        event.preventDefault(); void execute(pauseCommand, 'page');
      } else if (!isDesktop && prefs.mediaKeys && !typing) {
        const map: Record<string, string> = { MediaPlayPause: 'sound.toggle', MediaTrackNext: 'sound.next', MediaStop: 'sound.pause' };
        const command = map[event.code] ?? map[event.key];
        if (command) { event.preventDefault(); if (acceptMediaAction()) void execute(command, 'page'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [execute, pauseSetting, pauseCommand]);

  // ---- macros ------------------------------------------------------------------------------
  const setMacros = useCallback((update: (current: Macro[]) => Macro[]) => setMacrosState((current) => sanitizeMacros(update(current))), []);
  useEffect(() => { writeMacros(macros); }, [macros]);

  // ---- voice -------------------------------------------------------------------------------
  const entries = useMemo(() => buildVoiceEntries(allMixNames(), macros.filter((macro) => macro.voice).map((macro) => macro.name)), [macros, allMixNames, sound.activeId]);
  const entriesRef = useRef(entries); entriesRef.current = entries;
  function handleVoice(event: VoiceEvent) {
    if (event.type === 'status') { setVoiceStatus({ status: event.status, language: event.language, message: event.message }); return; }
    if (event.type === 'level') { recordLevel(event.level); return; }
    if (event.type === 'hypothesis') { patchVoiceMeter({ hypothesis: event.text }); return; }
    if (event.type === 'rejected') { if (event.grammar === 'dict') return; patchVoiceMeter({ rejected: getVoiceMeter().rejected + 1, lastRejected: event.text ?? '', hypothesis: '' }); return; }
    // The recognizer may be running only for Flow (which reads these events itself): voice mode must not act on them.
    if (!latest.current.voice.enabled && !voiceTestingRef.current) return;
    const settings = latest.current.voice;
    if (event.grammar === 'dict') {
      // Free speech is only acted on in voice mode, after the wake word, and only when it is a command Flow knows.
      if (voiceTestingRef.current && !settings.enabled) return;
      if (!settings.freeSpeech || !settings.useWake || event.confidence < Math.max(0.3, settings.minConfidence - 0.15)) return;
      const spoken = norm(event.text);
      const starts = wakeList(settings.wake).some((w) => spoken.startsWith(`${norm(w)} `));
      if (!starts) return;
      const intent = parseIntent(event.text, { mixNames: allMixNames(), macroNames: latest.current.macros.filter((m) => m.voice).map((m) => m.name), todoNames: getTodos().filter((x) => !x.done).map((x) => x.text) });
      setLastHeard({ text: event.text, command: intent?.command ?? null, at: Date.now(), confidence: event.confidence, reason: intent ? undefined : 'wake' });
      if (intent) { patchVoiceMeter({ heard: getVoiceMeter().heard + 1, lastHeardAt: Date.now(), hypothesis: '' }); feedback(`Heard "${event.text}"`, { id: 'voice-heard', sound: null, duration: 1400 }); void execute(intent.command, 'page'); }
      return;
    }
    patchVoiceMeter({ heard: getVoiceMeter().heard + 1, lastHeardAt: Date.now(), hypothesis: '' });
    if (event.confidence < settings.minConfidence) { setLastHeard({ text: event.text, command: null, at: Date.now(), confidence: event.confidence, reason: 'confidence' }); return; }
    const command = matchHeard(event.text, entriesRef.current, settings.wake, settings.useWake);
    setLastHeard({ text: event.text, command, at: Date.now(), confidence: event.confidence, reason: command ? undefined : 'wake' });
    if (command) { feedback(`Heard "${event.text}"`, { id: 'voice-heard', sound: null, duration: 1400 }); void execute(command, 'external'); }
  }
  const voiceKey = JSON.stringify([voice.enabled || voiceTesting, voice.wake, voice.useWake, voice.language, voice.freeSpeech, entries.map((entry) => entry.command)]);
  useEffect(() => {
    const api = desktop;
    if (!api || !info?.voiceSupported) return;
    if (!voice.enabled && !voiceTesting) { if (!getFlowVoiceWanted()) api.voiceStop(); return; }
    const timeout = setTimeout(() => api.voiceStart(buildVoiceConfig(entriesRef.current, voice.wake, voice.useWake, voice.language, voice.freeSpeech && voice.useWake)), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceKey, info?.voiceSupported]);
  const setVoice = useCallback((patch: Partial<VoiceSettings>) => setVoiceState((current) => ({ ...current, ...patch })), []);
  voiceTestingRef.current = voiceTesting;
  const setVoiceTesting = useCallback((on: boolean) => { if (on) resetVoiceMeter(); setVoiceTestingState(on); }, []);
  useEffect(() => { if (voice.enabled) resetVoiceMeter(); }, [voice.enabled]);
  useEffect(() => { writeVoice(voice); }, [voice]);

  // ---- tell the tray what is going on ------------------------------------------------------
  const timerLabel = timer.running || timer.hasSegment ? clock(timer.seconds) : '';
  useEffect(() => {
    desktop?.report({ playing: sound.playing, mixName: sound.mix.name, timerRunning: timer.running, timerLabel, phase: timer.phase === 'focus' ? 'focus' : 'break' });
  }, [sound.playing, sound.mix.name, timer.running, timerLabel, timer.phase]);

  const value = useMemo<DesktopContextValue>(() => ({
    available: isDesktop, info, state, mac, bindings, shortcutResults, setAccelerator, resetBindings, macros, setMacros, runMacro, runSteps, macroRunning,
    voice, setVoice, voiceTesting, setVoiceTesting, voiceStatus, lastHeard, run, ask, registerUi: (hooks) => { ui.current = { ...ui.current, ...hooks }; }, allMixNames,
  }), [info, state, mac, bindings, shortcutResults, setAccelerator, resetBindings, macros, setMacros, runMacro, runSteps, macroRunning, voice, setVoice, voiceTesting, setVoiceTesting, voiceStatus, lastHeard, run, allMixNames]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDesktop(): DesktopContextValue {
  const value = useContext(Context);
  if (!value) throw new Error('useDesktop must be used inside DesktopProvider');
  return value;
}
