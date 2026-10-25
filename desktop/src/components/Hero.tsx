import { Maximize, Pause, Play, Sparkles, Waves } from 'lucide-react';
import { builtInMixes } from '../lib/mix';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { FLAGSHIP, baseRecipe } from '../lib/catalog';
import { dayStats, focusStreak, formatDuration } from '../lib/tracking';
import { useFullscreen } from '../hooks/useFullscreen';
import { Slider } from './Slider';
import { Visualizer } from './Visualizer';

const flowMix = builtInMixes[0].mix;

export function FlowCard({ compact = false }: { compact?: boolean }) {
  const { mix, playing, play, pause, loadMix, patchTune } = useSound();
  const onFlow = mix.base === FLAGSHIP;
  return <article className="relative overflow-hidden rounded-2xl bg-ink p-6 text-canvas sm:p-7" aria-labelledby="flow-heading">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] opacity-60">Flagship sound</p>
        <h2 id="flow-heading" className={`mt-3 font-semibold leading-none tracking-[-0.075em] ${compact ? 'text-[clamp(2.6rem,5vw,3.6rem)]' : 'text-[clamp(3.4rem,8vw,5.6rem)]'}`}>Flow<span className="opacity-40">.</span></h2>
      </div>
      <Sparkles size={22} className="mt-1 shrink-0 opacity-60" aria-hidden="true" />
    </div>
    <p className="mt-4 max-w-[430px] text-[13px] leading-[1.75] opacity-75">{baseRecipe.Flow.blurb[0].toUpperCase() + baseRecipe.Flow.blurb.slice(1)}. The sound most people in this studio start with, and the one that tends to ease you into the work.</p>
    <div className="mt-5 text-canvas"><Visualizer height={compact ? 56 : 76} bars={40} /></div>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      {onFlow ? <button type="button" onClick={() => { if (playing) pause(); else void play(); }} className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-canvas px-6 text-[13px] font-semibold text-ink transition-opacity hover:opacity-85">
        {playing ? <Pause size={16} /> : <Play size={16} />}{playing ? 'Pause Flow' : 'Play Flow'}</button>
        : <button type="button" onClick={() => loadMix(flowMix, 'builtin-flow', { play: true })} className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-canvas px-6 text-[13px] font-semibold text-ink transition-opacity hover:opacity-85"><Play size={16} /> Switch to Flow</button>}
      <span className="font-mono text-[11px] opacity-60">{onFlow ? (playing ? 'Now playing' : 'Selected') : `Current: ${mix.base}`}</span>
    </div>
    <div className={`mt-7 grid gap-4 border-t border-canvas/20 pt-5 sm:grid-cols-3 ${onFlow ? '' : 'pointer-events-none opacity-35'}`} aria-label="Flow tuning" role="group" aria-disabled={!onFlow}>
      <Slider inverted compact disabled={!onFlow} label="Depth" value={mix.tune.baseLevel} min={0} max={150} defaultValue={100} onChange={(baseLevel) => patchTune({ baseLevel })} format={(v) => `${v}%`} hint="How present the Flow bed is. 100% is the original." />
      <Slider inverted compact disabled={!onFlow} label="Texture" value={mix.tune.baseBright} min={30} max={200} defaultValue={100} onChange={(baseBright) => patchTune({ baseBright })} format={(v) => `${v}%`} hint="Opens or darkens the noise inside Flow." />
      <Slider inverted compact disabled={!onFlow} label="Motion" value={mix.tune.baseMotion} min={0} max={250} defaultValue={100} onChange={(baseMotion) => patchTune({ baseMotion })} format={(v) => `${v}%`} hint="How much the sound slowly shifts." />
    </div>
  </article>;
}

export function Hero({ onZen }: { onZen: () => void }) {
  const { listenToday, listening, playing, mix, loadMix } = useSound();
  const { sessions } = useTimer();
  const fullscreen = useFullscreen();
  const today = dayStats(sessions, listening, 1)[0];
  const streak = focusStreak(sessions);
  const stat = (label: string, value: string) => <div className="min-w-[96px]"><p className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</p><p className="mt-1 text-[18px] font-semibold tracking-tight tabular-nums">{value}</p></div>;
  return <section id="top" className="mx-auto w-full max-w-[1160px] px-5 pt-9 sm:px-9 sm:pt-12 lg:px-12 xl:px-16" aria-label="Introduction">
    <div className="grid items-end gap-10 lg:grid-cols-[1.02fr_.98fr] lg:gap-14">
      <div>
        <p className="section-label mb-5">Study with Sarang / sound, time, focus</p>
        <h1 className="text-[clamp(3rem,6vw,5.2rem)] font-semibold leading-[1.06] tracking-[-0.07em]">Find your<br />flow<span className="text-faint">.</span></h1>
        <p className="mt-5 max-w-[540px] text-[14px] leading-[1.8] text-muted sm:text-[15px]">One page, no sign in. A live-generated ambient studio with more than twenty layers, a focus timer, time tracking and your study playlist. Everything runs in your browser and stays there.</p>
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onZen} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-[12px] font-semibold text-canvas hover:opacity-85"><Waves size={15} /> Open zen view</button>
          {fullscreen.supported && <button type="button" onClick={() => void fullscreen.toggle()} className="studio-button min-h-11 px-4"><Maximize size={14} /> {fullscreen.active ? 'Exit full screen' : 'Full screen'}</button>}
          {!playing && mix.base !== FLAGSHIP && <button type="button" onClick={() => loadMix(flowMix, 'builtin-flow', { play: true })} className="studio-button min-h-11 px-4"><Play size={14} /> Start Flow</button>}
        </div>
        <div className="mt-9 flex flex-wrap gap-x-8 gap-y-4 border-t border-line pt-5">
          {stat('Focused today', formatDuration(today.focusSeconds, true))}
          {stat('Listening today', formatDuration(listenToday, true))}
          {stat('Day streak', `${streak} ${streak === 1 ? 'day' : 'days'}`)}
        </div>
      </div>
      <FlowCard />
    </div>
  </section>;
}

/** The new layout's slim opening strip: the headline, today's numbers and the quick actions on one line. */
export function HeroStrip({ onZen }: { onZen: () => void }) {
  const { listenToday, playing, mix, loadMix } = useSound();
  const { sessions } = useTimer();
  const fullscreen = useFullscreen();
  const today = dayStats(sessions, useSound().listening, 1)[0];
  const streak = focusStreak(sessions);
  const stat = (label: string, value: string) => <div className="min-w-[88px]"><p className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</p><p className="mt-0.5 text-[17px] font-semibold tracking-tight tabular-nums">{value}</p></div>;
  return <section id="top" className="mx-auto w-full max-w-[1160px] px-5 pt-8 sm:px-9 lg:px-12 xl:px-16" aria-label="Introduction">
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-line pb-6">
      <div>
        <p className="section-label mb-3">Study with Sarang / sound, time, focus</p>
        <h1 className="text-[clamp(2.2rem,4.4vw,3.3rem)] font-semibold leading-[1.05] tracking-[-0.06em]">Find your flow<span className="text-faint">.</span></h1>
      </div>
      <div className="flex flex-wrap items-end gap-x-7 gap-y-4">
        {stat('Focused today', formatDuration(today.focusSeconds, true))}
        {stat('Listening today', formatDuration(listenToday, true))}
        {stat('Day streak', `${streak} ${streak === 1 ? 'day' : 'days'}`)}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onZen} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-[12px] font-semibold text-canvas hover:opacity-85"><Waves size={14} /> Zen view</button>
          {fullscreen.supported && <button type="button" onClick={() => void fullscreen.toggle()} className="studio-button min-h-10 px-3.5"><Maximize size={14} /> {fullscreen.active ? 'Exit' : 'Full screen'}</button>}
          {!playing && mix.base !== FLAGSHIP && <button type="button" onClick={() => loadMix(flowMix, 'builtin-flow', { play: true })} className="studio-button min-h-10 px-3.5"><Play size={14} /> Start Flow</button>}
        </div>
      </div>
    </div>
  </section>;
}
