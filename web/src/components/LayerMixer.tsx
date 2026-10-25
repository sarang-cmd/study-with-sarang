import { RangeInput } from './RangeInput';
import { AudioLines, AudioWaveform, Bell, BellRing, Bird, BookOpen, Bug, ChevronDown, Clock, CloudLightning, CloudRain, CloudRainWind, Coffee, Droplets, Fan, Flame, Keyboard, Leaf, Moon, Orbit, Plane, Radio, Search, Shuffle, Spline, TrainFront, Wind, Waves, X, CircleDot } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useSound } from '../context/SoundContext';
import { layerCategories, layerIds, layerInfo, layers } from '../lib/catalog';
import type { LayerCategory, LayerId } from '../lib/catalog';
import { activeLayers, surpriseMix } from '../lib/mix';
import { sectionNo } from '../lib/prefs';

const icons: Record<LayerId, LucideIcon> = {
  Rainfall: CloudRain, 'Distant thunder': CloudLightning, 'Shore waves': Waves, Wind, Hearth: Flame, Birdsong: Bird, Crickets: Bug, Café: Coffee,
  'Soft bells': Bell, 'White noise': Radio, 'Brown noise': AudioWaveform, 'Pink noise': AudioLines, 'Box fan': Fan, 'Heavy rain': CloudRainWind,
  Stream: Spline, Waterfall: Droplets, 'Night train': TrainFront, 'Airplane cabin': Plane, Clock, Keyboard, 'Library hush': BookOpen,
  'Singing bowls': CircleDot, 'Wind chimes': BellRing, 'Deep space': Orbit, Owl: Moon, Frogs: Leaf,
};

type Filter = 'All' | 'Active' | LayerCategory;

function LayerCard({ id }: { id: LayerId }) {
  const { mix, setLayer } = useSound();
  const Icon = icons[id];
  const setting = mix.layers[id];
  const level = setting?.level ?? 0;
  const pan = setting?.pan ?? 0, tone = setting?.tone ?? 0;
  const inputId = `layer-${layerIds.indexOf(id)}`;
  return <div className={`rounded-xl border bg-canvas p-3.5 transition-colors ${level ? 'border-ink' : 'border-line'}`} data-tip={layerInfo[id].blurb}>
    <label htmlFor={inputId} className="flex items-center justify-between gap-2 text-[11px] font-semibold"><span className="inline-flex min-w-0 items-center gap-2"><Icon size={16} strokeWidth={1.65} className="shrink-0" aria-hidden="true" /><span className="truncate">{id}</span></span><span className="font-mono text-[10px] text-muted">{level ? `${level}%` : 'off'}</span></label>
    <RangeInput id={inputId} min={0} max={100} value={level} defaultValue={0} valueText={level ? `${level}%` : 'off'} onChange={(value) => setLayer(id, { level: value })} label={`${id} volume`} className="mt-1.5" />
    {level > 0 && <details className="mt-1.5">
      <summary className="flex items-center gap-1 text-[10px] font-semibold text-muted hover:text-ink"><ChevronDown size={11} className="chevron" /> Pan and tone</summary>
      <div className="mt-2 space-y-2">
        <label className="block text-[10px] font-semibold"><span className="flex justify-between"><span>Pan</span><span className="font-mono text-muted">{pan === 0 ? 'center' : pan < 0 ? `L ${-pan}` : `R ${pan}`}</span></span>
          <RangeInput min={-100} max={100} value={pan} defaultValue={0} origin="center" onChange={(value) => setLayer(id, { pan: value })} label={`${id} pan`} className="mt-0.5" /></label>
        <label className="block text-[10px] font-semibold"><span className="flex justify-between"><span>Tone</span><span className="font-mono text-muted">{tone === 0 ? 'neutral' : tone < 0 ? 'darker' : 'brighter'}</span></span>
          <RangeInput min={-100} max={100} value={tone} defaultValue={0} origin="center" onChange={(value) => setLayer(id, { tone: value })} label={`${id} tone`} className="mt-0.5" /></label>
        <p className="text-[10px] text-faint">Double-click a slider to reset it.</p>
      </div>
    </details>}
  </div>;
}

export function LayerMixer() {
  const { mix, setMix, clearLayers } = useSound();
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const active = activeLayers(mix).length;
  const shown = useMemo(() => layers.filter((layer) => {
    if (filter === 'Active' && !(mix.layers[layer.id]?.level)) return false;
    if (filter !== 'All' && filter !== 'Active' && layer.category !== filter) return false;
    const needle = query.trim().toLowerCase();
    return !needle || layer.id.toLowerCase().includes(needle) || layer.blurb.toLowerCase().includes(needle) || layer.category.toLowerCase().includes(needle);
  }), [filter, query, mix.layers]);
  const filters: Filter[] = ['All', 'Active', ...layerCategories];
  return <section id="layers" aria-labelledby="layers-heading" className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="section-label mb-3">{sectionNo('03')}Layers</p><h2 id="layers-heading" className="text-[26px] font-semibold leading-tight tracking-tight">Layer your own ambience.</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">{layerIds.length} sounds in seven families. {active ? `${active} active` : 'All layers are off'}. Mix as many as you like, each with its own volume, pan and tone.</p></div>
      <div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => setMix((m) => surpriseMix(m))} className="studio-button" data-tip="Generate a fresh three-layer blend from different families"><Shuffle size={13} /> Mix for me</button><button type="button" onClick={clearLayers} disabled={!active} className="studio-button" data-tip="Silence all layers"><X size={13} /> Clear</button></div>
    </div>
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-full border border-line bg-canvas px-3.5 sm:max-w-[260px]"><Search size={14} className="shrink-0 text-muted" aria-hidden="true" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a sound" aria-label="Find a sound" className="h-9 w-full min-w-0 bg-transparent text-[12px] text-ink outline-none placeholder:text-faint" /></label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter sounds">{filters.map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}
        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${filter === item ? 'border-ink bg-ink text-canvas' : 'border-line bg-canvas text-muted hover:border-ink hover:text-ink'}`}>{item}{item === 'Active' && active > 0 ? ` ${active}` : ''}</button>)}</div>
    </div>
    {shown.length ? <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{shown.map((layer) => <LayerCard key={layer.id} id={layer.id} />)}</div>
      : <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-[12px] text-muted">{filter === 'Active' ? 'No layers are on yet. Pick a family and raise a slider.' : 'No sounds match that search.'}</p>}
    <p className="mt-5 text-[11px] leading-[1.7] text-muted">All of these are synthesized locally in your browser. Birdsong, owls, frogs, café and keyboard are stylized textures, not field recordings or human voices. Changes to your mix are saved in this browser automatically.</p>
  </section>;
}
