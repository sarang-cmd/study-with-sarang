import { RangeInput } from './RangeInput';
import { ChevronDown, Headphones, Pause, Play, RefreshCw, Star, Volume2, VolumeX } from 'lucide-react';
import { SOUND_TIMER_CHOICES, useSound } from '../context/SoundContext';
import { FLAGSHIP, baseIds, baseRecipe } from '../lib/catalog';
import { clock } from '../lib/tracking';
import { FineTune } from './FineTune';
import { Visualizer } from './Visualizer';
import { sectionNo } from '../lib/prefs';
import { useFeatures } from '../hooks/useFeatures';

export function Soundscape() {
  const f = useFeatures();
  const { mix, setBase, setVolume, playing, play, pause, next, variation, error, soundTimer } = useSound();
  return <section id="sound" aria-labelledby="sound-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
    <div className="flex items-start justify-between gap-4"><div><p className="section-label mb-3">{sectionNo('01')}Soundscape</p><h2 id="sound-heading" className="text-[26px] font-semibold leading-tight tracking-tight">Shape the atmosphere.</h2><p className="mt-2 text-[12px] leading-relaxed text-muted">Twelve base environments, made live by your browser. Flow is the flagship.</p></div><Headphones size={23} className="shrink-0 text-muted" /></div>
    <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Base environment">
      {baseIds.map((choice) => <button key={choice} type="button" aria-pressed={mix.base === choice} onClick={() => setBase(choice)} data-tip={baseRecipe[choice].blurb}
        className={`relative min-h-12 rounded-xl border px-3 text-left text-[12px] font-semibold ${mix.base === choice ? 'border-ink bg-ink text-canvas' : 'border-line bg-canvas text-muted hover:border-ink hover:text-ink'}`}>
        {choice}{choice === FLAGSHIP && <Star size={11} fill="currentColor" className="absolute right-2.5 top-2.5 opacity-70" aria-label="Flagship" />}</button>)}
    </div>
    <p className="mt-3 text-[11px] leading-relaxed text-muted">{baseRecipe[mix.base].blurb}</p>
    <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-line bg-canvas px-4 py-5">
      <div className="min-w-0"><p className="font-mono text-[10px] uppercase tracking-wider text-muted">{playing ? 'Now playing' : 'Ready'}</p><p className="mt-1 truncate text-[16px] font-semibold">{mix.base} / variation {variation.toString().padStart(2, '0')}</p></div>
      <div className="w-24 shrink-0 sm:w-36"><Visualizer height={40} bars={16} /></div>
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => { if (playing) pause(); else void play(); }} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-[12px] font-semibold text-canvas">{playing ? <Pause size={15} /> : <Play size={15} />} {playing ? 'Pause sound' : 'Play sound'}</button>
      <button type="button" onClick={next} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-canvas px-4 text-[12px] font-semibold hover:border-ink" data-tip="Regenerate the sound with a fresh random seed (N)"><RefreshCw size={14} /> Next variation</button>
    </div>
    <div className="mt-8"><div className="flex items-center justify-between text-[12px] font-semibold"><span className="inline-flex items-center gap-2">{mix.volume ? <Volume2 size={16} /> : <VolumeX size={16} />} Volume</span><span className="font-mono text-[11px] text-muted">{mix.volume}%</span></div>
      <RangeInput id="sound-volume" label="Volume" min={0} max={100} value={mix.volume} defaultValue={50} valueText={`${mix.volume}%`} onChange={setVolume} className="mt-1.5" />
      <p className="mt-2 text-[11px] text-muted">Keep it comfortable. Steady sound works at low volume.</p></div>
    <div className="mt-7 border-t border-line pt-5"><p className="text-[12px] font-semibold">Sound timer</p><p className="mt-1 text-[11px] text-muted">Fades out and pauses the sound. Counts only while sound plays.</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Sound timer">{SOUND_TIMER_CHOICES.map((time) => <button key={time} type="button" aria-pressed={soundTimer.minutes === time} onClick={() => soundTimer.set(time)} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${soundTimer.minutes === time ? 'border-ink bg-ink text-canvas' : 'border-line bg-canvas text-muted hover:border-ink'}`}>{time ? `${time} min` : 'No timer'}</button>)}</div>
      {soundTimer.minutes > 0 && <p className="mt-3 font-mono text-[26px] font-semibold tabular-nums tracking-tight" role="timer" aria-label="Sound timer remaining">{clock(Math.ceil(soundTimer.remainingMs / 1000))}</p>}</div>
    <details key={String(f.compactCards)} open={!f.compactCards} className="group mt-7 border-t border-line pt-5">
      <summary className="flex items-center justify-between gap-3 rounded-md text-[14px] font-semibold tracking-tight"><span>Fine tune<span className="ml-2 font-mono text-[10px] font-normal uppercase tracking-wider text-muted">tone, space, movement</span></span><ChevronDown size={16} className="chevron text-muted" /></summary>
      <FineTune />
    </details>
    {error && <p role="alert" className="mt-4 rounded-lg border border-line bg-canvas p-3 text-[11px]">{error}</p>}
    <p className="calm-hide mt-7 border-t border-line pt-5 text-[11px] leading-[1.7] text-muted">Original audio, generated on your device, with no recordings and no third-party content. No brainwave alignment, clinical effect or improved concentration is promised. Keep the volume comfortable.</p>
  </section>;
}
