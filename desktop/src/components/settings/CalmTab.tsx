import { useSyncExternalStore } from 'react';
import { PATTERNS, SCENES, stepsFor, type PatternId, type SceneId } from '../../lib/calm';
import { beginWindDown, getWindDown, openCalm, stopWindDown, subscribeCalm } from '../../lib/calmState';
import { setPrefs, usePrefs } from '../../lib/prefs';
import { Slider } from '../Slider';
import { Card, Toggle } from '../desktop/shared';
import { Row, Segmented } from './parts';

const num = 'field !min-h-8 !w-[64px] !py-1 text-center text-[11px]';

export function CalmTab() {
  const [prefs] = usePrefs();
  const c = prefs.calm;
  const set = (patch: Partial<typeof c>) => setPrefs({ calm: { ...c, ...patch } });
  const steps = stepsFor(c);
  const pattern = PATTERNS.find((p) => p.id === c.pattern);
  const wind = useSyncExternalStore(subscribeCalm, getWindDown, getWindDown);
  const winding = Boolean(wind && !wind.done);
  return <div className="grid gap-5">
    <Card title="Calm" hint="Quiet tools for between blocks: a breathing guide, moving scenes, a grounding exercise and a sleep timer. Open them from the leaf button in the header, the command palette (Ctrl+K) or by voice: Flow, I need to breathe.">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="studio-button" onClick={() => openCalm({ tab: 'breathe' })}>Breathe</button>
        <button type="button" className="studio-button" onClick={() => openCalm({ tab: 'scene' })}>Scenes</button>
        <button type="button" className="studio-button" onClick={() => openCalm({ tab: 'ground' })}>Grounding</button>
        <button type="button" className="studio-button" onClick={() => openCalm({ tab: 'wind' })}>Sleep timer</button>
      </div>
    </Card>
    <Card title="Breathing" hint="A circle grows as you breathe in and shrinks as you breathe out.">
      <div className="grid gap-2">
        <Row label="Pattern" hint={pattern?.blurb}><select className="field !min-h-8 !w-auto !py-1 text-[11px]" value={c.pattern} onChange={(e) => set({ pattern: e.target.value as PatternId })} aria-label="Breathing pattern">{PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Row>
        {c.pattern === 'custom' && <Row label="In, hold, out, rest (seconds)"><span className="flex gap-1.5">{steps.map((v, i) => <input key={i} className={num} type="number" min={i === 1 || i === 3 ? 0 : 1} max={20} step={0.5} value={v} aria-label={['Breathe in', 'Hold', 'Breathe out', 'Rest'][i]} onChange={(e) => { const next = [...c.custom] as typeof c.custom; next[i] = Number(e.target.value); set({ custom: next }); }} />)}</span></Row>}
        <Slider label="Breaths" value={c.cycles} min={0} max={30} defaultValue={0} onChange={(cycles) => set({ cycles })} format={(v) => (v === 0 ? 'until I stop' : `${v}`)} />
        <Toggle label="Soft tone as the breath turns" hint="A quiet note when you switch from in to out." checked={c.breathSound} onChange={(breathSound) => set({ breathSound })} />
        <Toggle label="Show the seconds" checked={c.breathCount} onChange={(breathCount) => set({ breathCount })} />
        <Slider label="Grounding pace" value={c.groundingPace} min={0} max={30} defaultValue={0} onChange={(groundingPace) => set({ groundingPace })} format={(v) => (v === 0 ? 'I tap next' : `${v} s per step`)} hint="The 5-4-3-2-1 exercise: five things you see, four you feel, and so on." />
      </div>
    </Card>
    <Card title="Scenes" hint="Slow, gentle visuals behind the breathing guide or on their own. They stay grayscale like the rest of the app.">
      <div className="grid gap-2">
        <Row label="Scene" hint={SCENES.find((s) => s.id === c.scene)?.blurb}><select className="field !min-h-8 !w-auto !py-1 text-[11px]" value={c.scene} onChange={(e) => set({ scene: e.target.value as SceneId })} aria-label="Scene">{SCENES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Row>
        <Slider label="How much is on screen" value={c.intensity} min={10} max={100} defaultValue={60} onChange={(intensity) => set({ intensity })} format={(v) => `${v}%`} />
        <Slider label="Speed" value={c.speed} min={25} max={200} step={5} defaultValue={100} onChange={(speed) => set({ speed })} format={(v) => `${v}%`} />
        <Toggle label="React to the sound" hint="The scene swells softly with the music or ambience that is playing." checked={c.sceneSound} onChange={(sceneSound) => set({ sceneSound })} />
        <Row label="Motion" hint="Automatic follows your system's reduce motion setting. Reduced makes everything nearly still."><Segmented<'auto' | 'full' | 'reduced'> label="Motion" value={c.motion} onChange={(motion) => set({ motion })} options={[{ id: 'auto', label: 'Automatic' }, { id: 'full', label: 'Full' }, { id: 'reduced', label: 'Reduced' }]} /></Row>
        <Toggle label="Screensaver" hint="Show the scene after a while without any activity in this app. Any key or click brings you back." checked={c.screensaver} onChange={(screensaver) => set({ screensaver })} />
        {c.screensaver && <Slider label="After" value={c.screensaverMinutes} min={1} max={60} defaultValue={5} onChange={(screensaverMinutes) => set({ screensaverMinutes })} format={(v) => `${v} min`} />}
      </div>
    </Card>
    <Card title="Sleep timer" hint="The sound slowly fades out, the screen dims and playback stops.">
      <div className="grid gap-2">
        <Slider label="Length" value={c.windMinutes} min={1} max={180} defaultValue={30} onChange={(windMinutes) => set({ windMinutes })} format={(v) => `${v} min`} />
        <Slider label="Fade over the last" value={Math.min(c.windFade, c.windMinutes)} min={1} max={60} defaultValue={10} onChange={(windFade) => set({ windFade })} format={(v) => `${v} min`} />
        <Toggle label="Dim the screen" checked={c.windDim} onChange={(windDim) => set({ windDim })} />
        <div className="flex gap-2"><button type="button" className="studio-button" onClick={() => (winding ? stopWindDown() : beginWindDown())}>{winding ? 'Stop the sleep timer' : `Start ${c.windMinutes} minutes`}</button></div>
      </div>
    </Card>
    <Card title="Intention" hint="A line you wrote for yourself, shown while you breathe and in Zen.">
      <div className="grid gap-2">
        <Toggle label="Show my intention" checked={c.intentionOn} onChange={(intentionOn) => set({ intentionOn })} />
        <input className="field" maxLength={140} value={c.intention} onChange={(e) => set({ intention: e.target.value })} placeholder="For example: one page at a time" aria-label="Intention" />
      </div>
    </Card>
  </div>;
}
