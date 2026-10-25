import { CheckSquare, RotateCcw, ShieldCheck, Undo2, Waves } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { dayStats } from '../lib/tracking';
import type { LayerId } from '../lib/catalog';
import type { LayerSetting, MixState } from '../lib/mix';
import { notify } from './ui/toast';
import { sectionNo } from '../lib/prefs';

type Level = 'chatter' | 'open' | 'loud';
const levels: { id: Level; label: string; hint: string; layers: Partial<Record<LayerId, number>> }[] = [
  { id: 'chatter', label: 'Some chatter', hint: 'A quiet house or library with the odd voice', layers: { 'Pink noise': 26, 'Brown noise': 14 } },
  { id: 'open', label: 'Open space', hint: 'Dorm, cafe, shared office', layers: { 'Pink noise': 38, 'Brown noise': 28, 'Box fan': 18 } },
  { id: 'loud', label: 'Loud', hint: 'Traffic, construction, a busy common room', layers: { 'Brown noise': 44, 'Pink noise': 42, 'Box fan': 32 } },
];
const CHECKLIST_KEY = 'study-with-sarang:checklist';
const checklist = ['Phone out of reach', 'Notifications silenced', 'Water and a snack nearby', 'One clear goal for this block', 'Extra tabs and apps closed'];

export function ShieldSection({ onZen }: { onZen: () => void }) {
  const { mix, setMix, listening } = useSound();
  const timer = useTimer();
  const [level, setLevel] = useState<Level>('open');
  const before = useRef<MixState | null>(null);
  const [applied, setApplied] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(() => {
    try { const raw: unknown = JSON.parse(localStorage.getItem(CHECKLIST_KEY) ?? '[]'); return checklist.map((_, i) => Array.isArray(raw) && raw[i] === true); } catch { return checklist.map(() => false); }
  });
  useEffect(() => { try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checked)); } catch { /* Kept for this visit. */ } }, [checked]);
  const today = dayStats(timer.sessions, listening, 1)[0];
  const drifts = today.distractions + (timer.hasSegment ? timer.distractions : 0);
  const ready = checked.filter(Boolean).length;

  function apply() {
    before.current = mix;
    const target = levels.find((item) => item.id === level)!;
    setMix((m) => {
      const layers = { ...m.layers };
      for (const [id, amount] of Object.entries(target.layers) as [LayerId, number][]) {
        const existing: LayerSetting | undefined = layers[id];
        layers[id] = { level: Math.max(existing?.level ?? 0, amount), pan: existing?.pan ?? 0, tone: existing?.tone ?? 0 };
      }
      return { ...m, layers, name: `${m.name.replace(/ \+ shield$/, '')} + shield` };
    });
    setApplied(true);
    notify({ title: 'Shield on', message: 'Steady noise was added under your mix. Masking works by being even, not loud, so keep the volume comfortable.', variant: 'success', id: 'shield-status', duration: 6500 });
  }
  function undo() {
    if (before.current) setMix(() => before.current!);
    before.current = null; setApplied(false);
  }
  const selected = levels.find((item) => item.id === level)!;

  return <section id="shield" aria-labelledby="shield-heading" className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7">
    <div className="flex items-start justify-between gap-4"><div><p className="section-label mb-3">{sectionNo('06')}Focus shield</p><h2 id="shield-heading" className="text-[26px] font-semibold leading-tight tracking-tight">When it is loud around you.</h2>
      <p className="mt-2 max-w-[600px] text-[12px] leading-relaxed text-muted">Tools for distracting places: steady masking noise, a quick way to count when your mind wanders, a short pre-session checklist and a zen view that hides everything else.</p></div><ShieldCheck size={23} className="shrink-0 text-muted" /></div>
    <div className="mt-6 grid gap-5 lg:grid-cols-3">
      <div className="rounded-xl border border-line bg-canvas p-4 sm:p-5">
        <h3 className="text-[14px] font-semibold tracking-tight">Noise shield</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">How noisy is it where you are? This adds pink and brown noise and a fan under your current mix.</p>
        <div className="mt-4 grid gap-2" role="radiogroup" aria-label="How noisy is it around you">{levels.map((item) => <button key={item.id} type="button" role="radio" aria-checked={level === item.id} onClick={() => setLevel(item.id)}
          className={`rounded-xl border px-3.5 py-2.5 text-left ${level === item.id ? 'border-ink bg-ink text-canvas' : 'border-line hover:border-ink'}`}><span className="block text-[12px] font-semibold">{item.label}</span><span className={`block text-[10px] ${level === item.id ? 'opacity-70' : 'text-muted'}`}>{item.hint}</span></button>)}</div>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={apply} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-[11px] font-semibold text-canvas hover:opacity-85"><ShieldCheck size={14} /> Apply shield</button>
          <button type="button" onClick={undo} disabled={!applied} className="studio-button"><Undo2 size={13} /> Undo</button></div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted">Adds: {Object.entries(selected.layers).map(([id, amount]) => `${id} ${amount}%`).join(', ')}. Hearing safety: loud masking can harm your ears over time. Raise the shield, not the volume.</p>
      </div>
      <div className="rounded-xl border border-line bg-canvas p-4 sm:p-5">
        <h3 className="text-[14px] font-semibold tracking-tight">Drift counter</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">Tap <strong className="text-ink">I drifted</strong> each time your attention wanders. Noticing it is the useful part.</p>
        <p className="mt-5 text-[44px] font-semibold leading-none tracking-[-0.06em] tabular-nums">{drifts}</p>
        <p className="mt-1 text-[11px] text-muted">drifts logged today{timer.tabAways ? `, plus ${timer.tabAways} tab ${timer.tabAways === 1 ? 'exit' : 'exits'} in this session` : ''}</p>
        <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={timer.markDistraction} className="studio-button" data-tip="Shortcut: D">I drifted</button>
          <button type="button" onClick={onZen} className="studio-button"><Waves size={13} /> Zen view</button></div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted">While a focus block runs, leaving this tab for more than a few seconds is counted automatically. Nothing is sent anywhere.</p>
      </div>
      <div className="rounded-xl border border-line bg-canvas p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2"><h3 className="text-[14px] font-semibold tracking-tight">Before you start</h3><span className="font-mono text-[10px] text-muted">{ready}/{checklist.length}</span></div>
        <ul className="mt-3 space-y-1.5">{checklist.map((item, i) => <li key={item}><label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 text-[12px] hover:bg-surface"><input type="checkbox" checked={checked[i]} onChange={() => setChecked((previous) => previous.map((value, n) => n === i ? !value : value))} className="h-4 w-4 accent-ink" /><span className={checked[i] ? 'text-muted line-through' : ''}>{item}</span></label></li>)}</ul>
        <div className="mt-4 flex items-center gap-2"><button type="button" onClick={() => setChecked(checklist.map(() => false))} className="studio-button"><RotateCcw size={13} /> Clear</button>
          {ready === checklist.length && <span className="flex items-center gap-1.5 text-[11px] font-semibold"><CheckSquare size={13} /> Ready</span>}</div>
      </div>
    </div>
  </section>;
}
