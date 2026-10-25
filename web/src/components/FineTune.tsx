import { RotateCcw } from 'lucide-react';
import { useSound } from '../context/SoundContext';
import { defaultTune } from '../lib/mix';
import { Slider } from './Slider';

const pct = (value: number) => `${value}%`;

export function FineTune() {
  const { mix, patchTune, resetTune } = useSound();
  const { tune } = mix;
  const changed = (Object.keys(defaultTune) as (keyof typeof defaultTune)[]).some((key) => tune[key] !== defaultTune[key]);
  const group = 'grid gap-2.5 sm:grid-cols-2';
  return <div className="mt-2">
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] leading-relaxed text-muted">Changes apply instantly and are saved inside each mix. Every default matches the original sound.</p>
      <button type="button" onClick={resetTune} disabled={!changed} className="studio-button shrink-0"><RotateCcw size={13} /> Reset</button>
    </div>
    <h4 className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">{mix.base} bed</h4>
    <div className={`mt-2 ${group}`}>
      <Slider label="Depth" value={tune.baseLevel} min={0} max={150} defaultValue={100} onChange={(baseLevel) => patchTune({ baseLevel })} format={pct} hint="How present the main bed is under your layers" />
      <Slider label="Texture" value={tune.baseBright} min={30} max={200} defaultValue={100} onChange={(baseBright) => patchTune({ baseBright })} format={pct} hint="Opens or darkens the noise in the bed" />
      <Slider label="Motion" value={tune.baseMotion} min={0} max={250} defaultValue={100} onChange={(baseMotion) => patchTune({ baseMotion })} format={pct} hint="How much the bed slowly shifts" />
    </div>
    <h4 className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">Tone and space</h4>
    <div className={`mt-2 ${group}`}>
      <Slider label="Warmth" value={tune.warmth} defaultValue={100} onChange={(warmth) => patchTune({ warmth })} format={(v) => v === 100 ? 'open' : v < 25 ? 'dark' : `${v}%`} hint="Softens the top end of the whole mix. Lower is warmer and darker." />
      <Slider label="Low cut" value={tune.lowcut} defaultValue={0} onChange={(lowcut) => patchTune({ lowcut })} format={(v) => v === 0 ? 'off' : `${v}%`} hint="Removes rumble and low end, handy on laptop speakers" />
      <Slider label="Space" value={tune.space} defaultValue={0} onChange={(space) => patchTune({ space })} format={(v) => v === 0 ? 'dry' : `${v}%`} hint="Adds a soft sense of room around everything" />
      <Slider label="Stereo width" value={tune.width} defaultValue={60} onChange={(width) => patchTune({ width })} format={pct} hint="How far apart layers sit when panned" />
    </div>
    <h4 className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">Movement</h4>
    <div className={`mt-2 ${group}`}>
      <Slider label="Breathing" value={tune.breathing} defaultValue={0} onChange={(breathing) => patchTune({ breathing })} format={(v) => v === 0 ? 'off' : `${v}%`} hint="A slow swell in the overall volume" />
      <Slider label="Breathing speed" value={tune.breathRate} defaultValue={40} onChange={(breathRate) => patchTune({ breathRate })} format={(v) => `${(1 / (.04 + .26 * v / 100)).toFixed(0)} s`} hint="Seconds per swell. Only matters when breathing is on." />
    </div>
  </div>;
}
