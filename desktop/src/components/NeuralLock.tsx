import { motion, useReducedMotion } from 'framer-motion';
import { Radio, TriangleAlert } from 'lucide-react';
import { NEURAL_LIMITS, NEURAL_PRESETS } from '../lib/neural';
import { setPrefs, usePrefs } from '../lib/prefs';
import { Slider } from './Slider';
import { Toggle } from './desktop/shared';

/** A picture of the pulse: the loudness swings by `depth` at `rate` times a second (drawn slowed down). */
function PulsePicture({ rate, depth, on }: { rate: number; depth: number; on: boolean }) {
  const reduce = useReducedMotion();
  const w = 320; const h = 56; const cycles = Math.max(2, Math.min(10, Math.round(rate / 3)));
  const pts = Array.from({ length: 161 }, (_, i) => { const x = (i / 160) * w; const swing = (depth / 100) * .5 * Math.sin((i / 160) * cycles * Math.PI * 2); const amp = (1 - (depth / 100) / 2 + swing) * .9; return `${x.toFixed(1)},${(h / 2 - amp * (h / 2 - 4) * Math.sin(i * .9)).toFixed(1)}`; });
  const env = Array.from({ length: 81 }, (_, i) => { const x = (i / 80) * w; const amp = (1 - depth / 200 + (depth / 200) * Math.sin((i / 80) * cycles * Math.PI * 2)) * (h / 2 - 4); return [x.toFixed(1), amp.toFixed(1)] as const; });
  const top = env.map(([x, a]) => `${x},${(h / 2 - Number(a)).toFixed(1)}`).join(' '); const bottom = [...env].reverse().map(([x, a]) => `${x},${(h / 2 + Number(a)).toFixed(1)}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Loudness pulsing ${rate} times a second, ${depth} percent deep${on ? '' : ' (off)'}`} className="h-14 w-full" data-testid="neural-picture">
    <polygon points={`${top} ${bottom}`} fill="currentColor" opacity={on ? .12 : .05} />
    <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="1" opacity={on ? .55 : .2} />
    {on && !reduce && <motion.line y1="2" y2={h - 2} stroke="currentColor" strokeWidth="1.5" animate={{ x1: [0, w], x2: [0, w] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} opacity=".7" />}
  </svg>;
}

/** The "neural lock" option. `compact` is the small Studio version; the full version lives on the Focus page with the honest explanation. */
export function NeuralLock({ compact = false }: { compact?: boolean }) {
  const [prefs] = usePrefs();
  const n = prefs.neural;
  const set = (patch: Partial<typeof n>) => setPrefs({ neural: { ...n, ...patch } });
  const preset = NEURAL_PRESETS.find((p) => p.rate === n.rate && p.depth === n.depth);
  return <section id={compact ? 'neural-compact' : 'neural'} aria-labelledby={compact ? 'neural-heading-c' : 'neural-heading'} data-testid={compact ? 'neural-compact' : 'neural-lock'} className={`rounded-2xl border bg-surface p-5 sm:p-7 ${n.on ? 'border-ink' : 'border-line'} ${compact ? '' : 'mt-6'}`}>
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-canvas"><Radio size={16} /></span>
      <div className="min-w-0 flex-1">
        <p className="section-label mb-1">Optional · experimental</p>
        <h2 id={compact ? 'neural-heading-c' : 'neural-heading'} className={`${compact ? 'text-[18px]' : 'text-[26px]'} font-semibold leading-tight tracking-tight`}>Neural lock<span className="text-faint">.</span></h2>
        <p className="mt-2 max-w-[640px] text-[12px] leading-relaxed text-muted">{compact ? 'A gentle rhythm under your sound, inspired by research on how the brain follows rhythmic sound. Off until you switch it on.' : 'Researchers have found that the brain\'s electrical activity can follow the rhythm in a sound ("phase locking"). One 2024 study used music whose loudness pulsed at fixed rates, around 16 times a second, and saw stronger coupling and, for some people with attention difficulties, better focus in lab tasks. This switch adds a soft pulse like that to whatever you are playing, so you can find out whether it does anything for you.'}</p>
      </div>
    </div>
    <div className="mt-4 grid gap-3">
      <Toggle label="Add the rhythm to my sound" hint={n.on ? `Pulsing ${n.rate} times a second, ${n.depth}% deep. It follows your volume and any mix you play.` : 'Starts from the next sound you play, or right away if one is playing.'} checked={n.on} onChange={(on) => set({ on })} />
      <PulsePicture rate={n.rate} depth={n.depth} on={n.on} />
      <div role="radiogroup" aria-label="Presets" className="flex flex-wrap gap-2">
        {NEURAL_PRESETS.map((p) => <button key={p.id} type="button" role="radio" aria-checked={preset?.id === p.id} data-tip={p.hint} onClick={() => set({ rate: p.rate, depth: p.depth, on: true })} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${preset?.id === p.id ? 'border-ink bg-ink text-canvas' : 'border-line hover:border-ink'}`}>{p.label}</button>)}
      </div>
      {!compact && <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="Rate" value={n.rate} min={NEURAL_LIMITS.rate.min} max={NEURAL_LIMITS.rate.max} defaultValue={16} onChange={(rate) => set({ rate })} format={(v) => `${v} Hz`} hint="Pulses per second." />
        <Slider label="Depth" value={n.depth} min={NEURAL_LIMITS.depth.min} max={NEURAL_LIMITS.depth.max} defaultValue={30} onChange={(depth) => set({ depth })} format={(v) => `${v}%`} hint="How much the loudness swings. Lower is subtler." />
      </div>}
    </div>
    {!compact && <div className="mt-5 grid gap-3 text-[11.5px] leading-[1.7] text-muted md:grid-cols-2">
      <p><strong className="text-ink">What this is.</strong> A plain sine pulse on the loudness of your mix. It is inspired by the published work, not copied from it: the study used specially made music, and this does not reproduce those sounds.</p>
      <p className="flex gap-2"><TriangleAlert size={14} className="mt-1 shrink-0 text-ink" /><span><strong className="text-ink">What it is not.</strong> Not a treatment, not tested by us, and no promise of better grades. Start low, keep the volume comfortable, and stop if it bothers you or you feel unwell. If you have epilepsy or a sound sensitivity, ask a doctor first. Compare a block with it and a block without, and trust what you find. The explanation and source are further down this page.</span></p>
    </div>}
    {compact && <p className="mt-3 text-[11px] text-muted"><a href="#neural" className="font-semibold text-ink underline underline-offset-4">How it works, and what we do not claim</a></p>}
  </section>;
}
