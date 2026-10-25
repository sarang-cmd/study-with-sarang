import { getTodos } from '../lib/plan';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDesktop } from '../context/DesktopContext';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { desktop } from '../lib/desktop';
import { browserFetcher, type Fetcher } from '../lib/flowApi';
import { FlowEngine, type FlowDeps, type LocalListener } from '../lib/flowEngine';
import { idleUi, resolveKey, type FlowUi } from '../lib/flow';
import { playCue } from '../lib/flowCues';
import { createVoiceLocal } from '../lib/flowLocal';
import { browserListener, createRecorder } from '../lib/flowRecorder';
import { publishableProject, registerTester, setFlowUi, setFlowVoiceWanted, setKeyStatus } from '../lib/flowRuntime';
import { speak, stopSpeaking } from '../lib/flowSpeech';
import { deviceId, readKeys, usageStore } from '../lib/flowStore';
import { usePrefs } from '../lib/prefs';
import { buildVoiceConfig, buildVoiceEntries } from '../lib/voice';
import { FlowBarView } from './FlowBarView';
import { notify } from './ui/toast';

const desktopFetcher: Fetcher = (request) => desktop!.netFetch(request);
const isEditable = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Connects Flow to the app: the key (global on Windows, while this page is focused on the web), the microphone, the built-in recognizer,
 * the sound ducking, and the bar. Renders only the bar on the web (the desktop app shows it in its own small window).
 */
export function FlowBridge() {
  const sound = useSound();
  const timer = useTimer();
  const dctx = useDesktop();
  const [prefs] = usePrefs();
  const flow = prefs.flow;
  const [webUi, setWebUi] = useState<FlowUi>(idleUi());
  const engine = useRef<FlowEngine | null>(null);
  const latest = useRef({ flow, sound, timer, dctx, prefs });
  latest.current = { flow, sound, timer, dctx, prefs };
  const warmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = useMemo(() => resolveKey(flow.keyId, flow.keyCodes), [flow.keyId, flow.keyCodes]);
  const keyRef = useRef(key); keyRef.current = key;

  // ---- the engine --------------------------------------------------------------------------
  useEffect(() => {
    const recorder = createRecorder({ warmSeconds: () => latest.current.flow.micWarm, onLevel: (level, bars) => engine.current?.level(level, bars) });
    const voiceLocal = desktop ? createVoiceLocal((cb) => desktop!.onVoice(cb), () => latest.current.dctx.voice.minConfidence) : null;
    const api = { fetcher: desktop ? desktopFetcher : browserFetcher, usage: usageStore, device: deviceId() };

    const ensureVoice = (): LocalListener | null => {
      const { dctx: d, flow: f } = latest.current;
      if (!desktop || !voiceLocal) return null;
      setFlowVoiceWanted(true);
      if (warmTimer.current) { clearTimeout(warmTimer.current); warmTimer.current = null; }
      if (d.voiceStatus.status === 'listening') return voiceLocal;
      if (d.voiceStatus.status === 'off' || d.voiceStatus.status === 'error') {
        const entries = buildVoiceEntries(d.allMixNames(), d.macros.filter((m) => m.voice).map((m) => m.name));
        desktop.voiceStart(buildVoiceConfig(entries, d.voice.wake, false, f.language === 'auto' ? d.voice.language : f.language, f.localFree));
      }
      return null; // Still starting: this request goes to the service instead.
    };
    const releaseVoice = () => {
      const { dctx: d, flow: f } = latest.current;
      if (!desktop) return;
      if (warmTimer.current) clearTimeout(warmTimer.current);
      if (f.localWarm <= 0) { setFlowVoiceWanted(false); if (!d.voice.enabled && !d.voiceTesting) desktop.voiceStop(); return; }
      warmTimer.current = setTimeout(() => { warmTimer.current = null; setFlowVoiceWanted(false); const c = latest.current.dctx; if (!c.voice.enabled && !c.voiceTesting) desktop!.voiceStop(); }, f.localWarm * 60_000);
    };

    const deps: FlowDeps = {
      settings: () => latest.current.flow,
      keys: readKeys,
      api,
      publishable: publishableProject,
      recorder,
      local: () => (desktop ? ensureVoice() : latest.current.flow.browserSpeech ? browserListener(() => latest.current.flow.language) : null),
      context: () => {
        const { dctx: d, sound: s, timer: t, prefs: p } = latest.current;
        const macroNames = d.macros.filter((m) => m.voice).map((m) => m.name);
        const todoNames = getTodos().filter((x) => !x.done).map((x) => x.text);
        return { mixNames: d.allMixNames(), macroNames, todoNames, subjectNames: [], playing: s.playing, volume: s.mix.volume, timerRunning: t.running, level: p.uiLevel };
      },
      execute: (command) => latest.current.dctx.ask(command),
      say: (text, kind) => {
        const f = latest.current.flow;
        if (kind === 'answer' ? f.speakAnswers : f.speakDone) void speak(text, f, readKeys(), api).then((r) => {
          // A voice service that failed is told to you once, not hidden behind the system voice.
          if (r.error) notify({ title: 'Voice service did not work', message: `${r.error} The system voice was used instead. Settings > Flow voice and AI > Voice replies.`, variant: 'warning', id: 'tts-failed', kind: 'system', duration: 6000 });
        });
      },
      cue: (kind) => { if (latest.current.flow.cues) playCue(kind); },
      publish: (ui) => {
        const dark = document.documentElement.classList.contains('dark');
        const full = { ...ui, dark, key: keyRef.current.label };
        const f = latest.current.flow;
        latest.current.sound.setDuckSource('flow', ui.phase === 'listening' ? 1 - f.duck / 100 : 1, true);
        if (ui.phase === 'listening') stopSpeaking();
        if (ui.phase === 'idle' || ui.phase === 'done' || ui.phase === 'error') releaseVoice();
        setFlowUi(full);
        if (desktop) desktop.flowUi(full); else setWebUi(full);
      },
    };
    const instance = new FlowEngine(deps);
    engine.current = instance;
    const tick = setInterval(() => instance.tick(), 40);
    registerTester(() => { instance.keyToggle(); });
    return () => {
      clearInterval(tick); registerTester(null); instance.dispose(); recorder.close(); engine.current = null;
      if (warmTimer.current) clearTimeout(warmTimer.current);
      setFlowVoiceWanted(false);
    };
  }, []);

  // ---- the desktop key ---------------------------------------------------------------------
  useEffect(() => {
    if (!desktop) return;
    void desktop.flowConfigure({ enabled: flow.enabled, vks: key.vks, accelerator: key.accelerator }).then((status) => { if (status) setKeyStatus(status); });
  }, [flow.enabled, key]);
  useEffect(() => {
    if (!desktop) return;
    const offs = [
      desktop.onFlowKey((type) => {
        const e = engine.current; if (!e || !latest.current.flow.enabled) return;
        if (type === 'down') e.keyDown(); else if (type === 'up') e.keyUp(); else if (type === 'toggle') e.keyToggle(); else if (type === 'abort') e.abort(); else if (type === 'esc') e.cancel();
      }),
      desktop.onFlowStatus(setKeyStatus),
      desktop.onFlowBar((action) => {
        const e = engine.current; if (!e) return;
        if (action === 'run' || action === 'ask') e.choose(action); else if (action === 'cancel') { e.choose('cancel'); e.cancel(); } else if (action === 'stop') e.stopNow();
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  // ---- the web key (only while this page has focus, which is all a browser allows) -----------
  useEffect(() => {
    if (desktop || !flow.enabled) return;
    const pressed = new Set<string>();
    let active = false;
    const wanted = () => keyRef.current.codes;
    const complete = () => wanted().length > 0 && wanted().every((code) => pressed.has(code));
    const isModifier = (code: string) => /^(Control|Shift|Alt|Meta)/.test(code);
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Escape' && engine.current?.isActive) { engine.current.cancel(); return; }
      if (event.repeat) return;
      pressed.add(event.code);
      const mine = wanted().includes(event.code);
      if (active && !mine) { active = false; engine.current?.abort(); return; }
      if (!active && mine && complete() && [...pressed].every((code) => wanted().includes(code))) {
        if (isEditable(event.target) && wanted().some((code) => !isModifier(code))) return;
        active = true; if (wanted().some((code) => !isModifier(code))) event.preventDefault(); engine.current?.keyDown();
      }
    };
    const up = (event: KeyboardEvent) => {
      pressed.delete(event.code);
      if (active && !complete()) { active = false; engine.current?.keyUp(); }
    };
    const blur = () => { pressed.clear(); if (active) { active = false; engine.current?.abort(); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [flow.enabled, key]);

  // ---- turning Flow off closes everything ---------------------------------------------------
  useEffect(() => { if (!flow.enabled) engine.current?.cancel(); }, [flow.enabled]);

  if (desktop || !flow.enabled || webUi.phase === 'idle') return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-3" style={flow.barPlace === 'center' ? { top: '50%', transform: 'translateY(-50%)' } : flow.barPlace === 'top' ? { top: 24 } : { bottom: 24 }}>
      <div className="pointer-events-none" style={{ width: 560, maxWidth: '100%', height: 250 }}>
        <FlowBarView ui={webUi} onAction={(action) => { const e = engine.current; if (!e) return; if (action === 'run' || action === 'ask') e.choose(action); else if (action === 'cancel') { e.choose('cancel'); e.cancel(); } else e.stopNow(); }} />
      </div>
    </div>
  );
}
