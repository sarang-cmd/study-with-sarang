import { Moon, Wind, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSound } from '../context/SoundContext';
import { BREATH_TONES } from '../lib/flowCues';
import { GROUNDING, PATTERNS, SCENES, breathAt, cycleSeconds, minutesLeft, stepsFor, type PatternId, type SceneId } from '../lib/calm';
import { beginWindDown, closeCalm, getCalmView, getWindDown, openCalm, stopWindDown, subscribeCalm } from '../lib/calmState';
import { createScene } from '../lib/calmScenes';
import { setPrefs, usePrefs } from '../lib/prefs';
import { RangeInput } from './RangeInput';
import { Toggle } from './TimerSettingsForm';
import { useSyncExternalStore } from 'react';

export const useCalmView = () => useSyncExternalStore(subscribeCalm, getCalmView, getCalmView);
export const useWindDown = () => useSyncExternalStore(subscribeCalm, getWindDown, getWindDown);

const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${on ? 'border-ink bg-ink text-canvas' : 'border-line bg-canvas text-ink hover:bg-raised'}`;

/** The moving background. Draws grayscale shapes with the page's text color, and breathes a little with the sound that is playing. */
function CalmScene({ scene, intensity, speed, reactive, reduced }: { scene: SceneId; intensity: number; speed: number; reactive: boolean; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sound = useSound();
  const analyser = useRef(sound.analyser); analyser.current = sound.analyser;
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const instance = createScene(scene);
    let raf = 0, last = performance.now(), energy = 0, w = 1, h = 1;
    let data: Uint8Array<ArrayBuffer> | null = null;
    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1), box = canvas.getBoundingClientRect();
      w = Math.max(1, box.width); h = Math.max(1, box.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(100, now - last);
      if (dt < 28) return; // About 30 frames a second is plenty for something this slow, and kinder to a laptop battery
      last = now;
      let target = 0;
      const node = reactive ? analyser.current() : null;
      if (node) { data ??= new Uint8Array(node.frequencyBinCount); node.getByteFrequencyData(data); let sum = 0; for (let i = 0; i < 40; i++) sum += data[i]; target = Math.min(1, sum / 40 / 160); }
      energy += (target - energy) * .08;
      ctx.clearRect(0, 0, w, h);
      const ink = getComputedStyle(canvas).color;
      instance.draw(ctx, w, h, { time: now, dt, energy, intensity, speed: reduced ? Math.min(speed, 100) * .4 : speed, reduced, ink });
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [scene, intensity, speed, reactive, reduced]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full text-ink" aria-hidden="true" />;
}

function useReduced(motion: 'auto' | 'full' | 'reduced') {
  const [system, setSystem] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { if (typeof matchMedia !== 'function') return; const q = matchMedia('(prefers-reduced-motion: reduce)'); const on = () => setSystem(q.matches); q.addEventListener('change', on); return () => q.removeEventListener('change', on); }, []);
  return motion === 'reduced' || (motion === 'auto' && system);
}

function Breathe({ pattern }: { pattern: PatternId }) {
  const [prefs] = usePrefs();
  const c = prefs.calm;
  const steps = stepsFor({ pattern, custom: c.custom });
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState(0);
  const start = useRef(0);
  const lastPhase = useRef('');
  useEffect(() => {
    if (!running) return;
    start.current = performance.now(); lastPhase.current = '';
    let raf = 0;
    const loop = (t: number) => { setNow((t - start.current) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, pattern, c.custom]);
  const state = breathAt(steps, running ? now : 0);
  const total = cycleSeconds(steps);
  const doneCycles = c.cycles > 0 && running && now >= c.cycles * total;
  useEffect(() => { if (doneCycles) setRunning(false); }, [doneCycles]);
  useEffect(() => {
    if (!running || !c.breathSound || state.phase === lastPhase.current) return;
    lastPhase.current = state.phase; BREATH_TONES(state.phase);
  }, [running, state.phase, c.breathSound]);
  const scale = running ? state.scale : .5;
  const info = PATTERNS.find((p) => p.id === pattern) ?? PATTERNS[0];
  return <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-7 text-center">
    <div className="relative flex h-[min(46vh,320px)] w-[min(46vh,320px)] items-center justify-center" aria-hidden="true">
      <div className="absolute inset-0 rounded-full border border-line" />
      <div className="absolute rounded-full border border-ink/30" style={{ inset: `${(1 - (.45 + scale * .55)) * 50 - 6}%`, opacity: .6 }} />
      <div className="absolute rounded-full bg-ink/10" style={{ width: `${46 + scale * 54}%`, height: `${46 + scale * 54}%`, transition: running ? 'none' : 'all .6s ease' }}>
        <div className="absolute inset-[18%] rounded-full bg-ink/15" />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-[19px] font-semibold tracking-tight" data-testid="breath-label">{running ? state.label : 'Ready'}</span>
        {running && c.breathCount && <span className="mt-1 font-mono text-[28px] font-semibold tabular-nums">{state.secondsLeft}</span>}
      </div>
    </div>
    <div aria-live="polite" className="sr-only">{running ? state.label : ''}</div>
    <div className="flex flex-wrap items-center justify-center gap-2">
      {PATTERNS.map((p) => <button key={p.id} type="button" className={chip(pattern === p.id)} onClick={() => { setPrefs({ calm: { ...c, pattern: p.id } }); }}>{p.label}</button>)}
    </div>
    <p className="max-w-[420px] text-[12px] leading-relaxed text-muted">{info.blurb}{running && c.cycles > 0 ? ` Round ${Math.min(c.cycles, state.cycle + 1)} of ${c.cycles}.` : ''}</p>
    {pattern === 'custom' && <div className="grid w-full max-w-[440px] grid-cols-4 gap-2 text-left">
      {['In', 'Hold', 'Out', 'Rest'].map((label, i) => <label key={label} className="text-[10px] font-semibold text-muted">{label} (s)
        <input type="number" min={i === 1 || i === 3 ? 0 : 1} max={20} step={.5} value={c.custom[i]} onChange={(e) => { const custom = [...c.custom] as typeof c.custom; custom[i] = Number(e.target.value); setPrefs({ calm: { ...c, custom } }); }} className="field mt-1 !min-h-8 !py-1 text-[12px]" /></label>)}
    </div>}
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setRunning((v) => !v)} className="rounded-full bg-ink px-6 py-2.5 text-[12px] font-semibold text-canvas hover:opacity-90" data-testid="breath-toggle">{running ? 'Stop' : 'Begin'}</button>
      <label className="flex items-center gap-2 text-[11px] font-semibold text-muted">Rounds
        <select value={c.cycles} onChange={(e) => setPrefs({ calm: { ...c, cycles: Number(e.target.value) } })} className="field !min-h-8 !w-auto !py-1 text-[11px]" aria-label="Rounds">
          {[0, 3, 5, 8, 10, 15, 20].map((n) => <option key={n} value={n}>{n === 0 ? 'Until I stop' : n}</option>)}
        </select></label>
    </div>
  </div>;
}

function Ground() {
  const [prefs] = usePrefs();
  const pace = prefs.calm.groundingPace;
  const [step, setStep] = useState(0);
  const finished = step >= GROUNDING.length;
  useEffect(() => {
    if (!pace || finished) return;
    const id = setTimeout(() => setStep((s) => s + 1), pace * 1000);
    return () => clearTimeout(id);
  }, [pace, step, finished]);
  const current = GROUNDING[Math.min(step, GROUNDING.length - 1)];
  return <div className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-6 text-center">
    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">5 - 4 - 3 - 2 - 1 grounding</p>
    {finished ? <div className="space-y-3"><p className="text-[22px] font-semibold tracking-tight">Take one slow breath.</p><p className="text-[13px] text-muted">Notice that you are here, and that you are okay. Come back whenever you need it.</p></div>
      : <div className="space-y-4" aria-live="polite"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-line bg-surface font-mono text-[44px] font-semibold" data-testid="ground-count">{current.count}</div>
        <p className="text-[19px] font-medium leading-snug tracking-tight">{current.prompt}</p></div>}
    <div className="flex items-center gap-1.5" aria-hidden="true">{GROUNDING.map((_, i) => <span key={i} className={`h-1.5 w-8 rounded-full ${i <= step ? 'bg-ink' : 'bg-line'}`} />)}</div>
    <div className="flex gap-2">
      <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className={`${chip(false)} disabled:opacity-40`}>Back</button>
      {finished ? <button type="button" onClick={() => setStep(0)} className={chip(true)}>Start again</button> : <button type="button" onClick={() => setStep((s) => s + 1)} className={chip(true)} data-testid="ground-next">{step === GROUNDING.length - 1 ? 'Finish' : 'Next'}</button>}
    </div>
  </div>;
}

function WindDown() {
  const [prefs] = usePrefs();
  const c = prefs.calm;
  const wind = useWindDown();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const active = wind && !wind.done;
  return <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5">
    <div className="text-center"><Moon size={26} className="mx-auto text-muted" aria-hidden="true" /><h2 className="mt-3 text-[22px] font-semibold tracking-tight">Wind down</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">Fades the sound out slowly, then pauses it. Good for falling asleep or ending the day. The screen can dim with it.</p></div>
    {active ? <div className="rounded-2xl border border-line bg-surface p-5 text-center"><p className="font-mono text-[34px] font-semibold tabular-nums" data-testid="wind-left">{minutesLeft(wind, now)} min</p><p className="mt-1 text-[12px] text-muted">until the sound is gone</p>
      <button type="button" onClick={stopWindDown} className={`${chip(false)} mt-4`}>Cancel</button></div>
      : <>
        <label className="rounded-xl border border-line bg-canvas px-3.5 py-3"><span className="flex justify-between text-[11px] font-semibold"><span>Total time</span><span className="font-mono">{c.windMinutes} min</span></span>
          <RangeInput min={5} max={180} step={5} value={c.windMinutes} defaultValue={30} onChange={(windMinutes) => setPrefs({ calm: { ...c, windMinutes } })} label="Wind-down minutes" className="mt-2" /></label>
        <label className="rounded-xl border border-line bg-canvas px-3.5 py-3"><span className="flex justify-between text-[11px] font-semibold"><span>Fade over the last</span><span className="font-mono">{Math.min(c.windFade, c.windMinutes)} min</span></span>
          <RangeInput min={1} max={60} step={1} value={Math.min(c.windFade, c.windMinutes)} defaultValue={10} onChange={(windFade) => setPrefs({ calm: { ...c, windFade } })} label="Fade minutes" className="mt-2" /></label>
        <Toggle label="Dim the screen too" hint="A dark veil grows over the last minutes. Move the mouse or press a key to bring it back." checked={c.windDim} onChange={(windDim) => setPrefs({ calm: { ...c, windDim } })} />
        <button type="button" onClick={() => { beginWindDown(); }} className="rounded-full bg-ink px-6 py-2.5 text-[12px] font-semibold text-canvas hover:opacity-90" data-testid="wind-start">Start winding down</button>
      </>}
  </div>;
}

function SceneControls() {
  const [prefs] = usePrefs();
  const c = prefs.calm;
  const set = (patch: Partial<typeof c>) => setPrefs({ calm: { ...c, ...patch } });
  return <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
    <div className="flex flex-wrap justify-center gap-2">{SCENES.map((s) => <button key={s.id} type="button" className={chip(c.scene === s.id)} title={s.blurb} onClick={() => set({ scene: s.id })}>{s.label}</button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="rounded-xl border border-line bg-canvas/90 px-3.5 py-3"><span className="flex justify-between text-[11px] font-semibold"><span>Amount</span><span className="font-mono">{c.intensity}%</span></span><RangeInput min={10} max={100} value={c.intensity} defaultValue={60} onChange={(intensity) => set({ intensity })} label="Scene amount" className="mt-2" /></label>
      <label className="rounded-xl border border-line bg-canvas/90 px-3.5 py-3"><span className="flex justify-between text-[11px] font-semibold"><span>Speed</span><span className="font-mono">{c.speed}%</span></span><RangeInput min={25} max={200} value={c.speed} defaultValue={100} onChange={(speed) => set({ speed })} label="Scene speed" className="mt-2" /></label>
    </div>
    <Toggle label="Move with the sound" hint="The scene swells gently with whatever is playing." checked={c.sceneSound} onChange={(sceneSound) => set({ sceneSound })} />
    <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas/90 px-3.5 py-2.5"><span className="text-[11px] font-semibold">Motion</span>
      <select value={c.motion} onChange={(e) => set({ motion: e.target.value as typeof c.motion })} className="field !min-h-8 !w-auto !py-1 text-[11px]" aria-label="Motion"><option value="auto">Follow system</option><option value="full">Full</option><option value="reduced">Reduced</option></select></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <Toggle label="Screensaver" hint={`Show this scene after ${c.screensaverMinutes} minutes without input, while the app is open.`} checked={c.screensaver} onChange={(screensaver) => set({ screensaver })} />
      <label className="rounded-xl border border-line bg-canvas/90 px-3.5 py-3"><span className="flex justify-between text-[11px] font-semibold"><span>After</span><span className="font-mono">{c.screensaverMinutes} min</span></span><RangeInput min={1} max={60} value={c.screensaverMinutes} defaultValue={5} onChange={(screensaverMinutes) => set({ screensaverMinutes })} label="Screensaver minutes" className="mt-2" /></label>
    </div>
  </div>;
}

const TABS = [['breathe', 'Breathe'], ['ground', 'Ground'], ['wind', 'Wind down'], ['scene', 'Scenes']] as const;

export function CalmOverlay() {
  const view = useCalmView();
  const [prefs] = usePrefs();
  const c = prefs.calm;
  const reduced = useReduced(c.motion);
  const ref = useRef<HTMLDivElement>(null);
  const clock = useClock(view.open && view.saver);
  // A command can ask for a particular scene or breathing pattern; apply it once, then it is just a setting.
  useEffect(() => {
    if (!view.open) return;
    if (view.scene && SCENES.some((s) => s.id === view.scene) && view.scene !== c.scene) setPrefs({ calm: { ...c, scene: view.scene } });
    if (view.pattern) {
      const wanted = view.pattern === 'relax' || view.pattern === '478' || view.pattern === 'box' || view.pattern === 'coherent' ? view.pattern : null;
      if (wanted && wanted !== c.pattern) setPrefs({ calm: { ...c, pattern: wanted } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.open, view.scene, view.pattern]);
  useEffect(() => {
    if (!view.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); closeCalm(); } else if (view.saver) closeCalm(); };
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    let armed = false; const arm = setTimeout(() => { armed = true; }, 700);
    const wake = () => { if (view.saver && armed) closeCalm(); };
    window.addEventListener('pointermove', wake); window.addEventListener('pointerdown', wake);
    return () => { clearTimeout(arm); window.removeEventListener('keydown', onKey); window.removeEventListener('pointermove', wake); window.removeEventListener('pointerdown', wake); };
  }, [view.open, view.saver]);
  if (!view.open) return null;
  return <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Calm" data-testid="calm" className="fixed inset-0 z-[80] flex flex-col bg-canvas text-ink outline-none arrive">
    <CalmScene scene={c.scene} intensity={c.intensity} speed={c.speed} reactive={c.sceneSound} reduced={reduced} />
    {view.saver ? <div className="relative flex flex-1 items-center justify-center"><p className="font-mono text-[min(18vw,160px)] font-semibold tabular-nums tracking-tight opacity-30">{clock}</p></div> : <>
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-2"><Wind size={16} aria-hidden="true" /><h2 className="text-[14px] font-semibold tracking-tight">Calm</h2></div>
        <div className="flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Calm tools">{TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={view.tab === id} onClick={() => openCalm({ tab: id })} className={chip(view.tab === id)}>{label}</button>)}</div>
        <button type="button" onClick={closeCalm} aria-label="Close calm" className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-ink"><X size={18} /></button>
      </div>
      {c.intentionOn && c.intention && <p className="relative px-6 text-center text-[13px] italic text-muted" data-testid="intention">&ldquo;{c.intention}&rdquo;</p>}
      <div className="relative flex flex-1 items-center overflow-y-auto px-5 py-6 sm:px-8"><div className="w-full">
        {view.tab === 'breathe' && <Breathe pattern={c.pattern} />}
        {view.tab === 'ground' && <Ground />}
        {view.tab === 'wind' && <WindDown />}
        {view.tab === 'scene' && <SceneControls />}
      </div></div>
      <p className="relative px-6 pb-4 text-center text-[10px] text-muted">Esc closes this screen. Sound keeps playing.</p>
    </>}
  </div>;
}

function useClock(on: boolean) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!on) return;
    const tick = () => setText(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    tick(); const id = setInterval(tick, 5000); return () => clearInterval(id);
  }, [on]);
  return text;
}
