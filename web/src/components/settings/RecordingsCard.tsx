import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { desktop } from '../../lib/desktop';
import { SLOTS, availability, getManifest, loadSlot, normalizeBase, recordingsVersion, removeCustomFile, saveCustomFile, slotState, subscribeRecordings, ensureManifest, type RecOrigin, type RecSource } from '../../lib/recordings';
import { publishableProject } from '../../lib/flowRuntime';
import { notify } from '../ui/toast';
import { setPrefs, usePrefs } from '../../lib/prefs';
import { Slider } from '../Slider';
import { Card, Toggle } from '../desktop/shared';
import { Row } from './parts';

const SOURCES: { id: RecSource; label: string }[] = [
  { id: 'auto', label: 'Automatic (your files, bundled, then cloud)' }, { id: 'bundled', label: 'Only files that came with the app' },
  { id: 'cloud', label: 'Only the cloud address below' }, { id: 'generated', label: 'Generated sounds only (no recordings)' },
];
const ORIGIN: Record<RecOrigin, string> = { custom: 'your file', folder: 'sounds folder', bundled: 'came with the app', cloud: 'cloud' };
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Settings > Sound > Real recordings. Each of the ten classic sounds can be a real recording; this shows which ones are, and lets you add your own. */
export function RecordingsCard() {
  const [prefs] = usePrefs();
  const rec = prefs.recordings;
  const version = useSyncExternalStore(subscribeRecordings, recordingsVersion, recordingsVersion);
  const [avail, setAvail] = useState<Record<string, RecOrigin | null>>({});
  const [cloud, setCloud] = useState(rec.cloudBase);
  const [busy, setBusy] = useState('');
  const [folder, setFolder] = useState<string[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const target = useRef('');
  useEffect(() => { void ensureManifest(); }, []);
  useEffect(() => { void availability().then(setAvail); void desktop?.listSounds().then(setFolder); }, [version, rec.source, rec.cloudBase]);
  useEffect(() => { setCloud(rec.cloudBase); }, [rec.cloudBase]);
  const set = (patch: Partial<typeof rec>) => setPrefs({ recordings: { ...rec, ...patch } });
  const manifest = getManifest();
  const project = publishableProject();

  async function test(id: string) {
    setBusy(id);
    const state = await loadSlot(id);
    setBusy('');
    notify({ message: state.state === 'ready' ? `${SLOTS.find((s) => s.id === id)?.label}: ${ORIGIN[state.origin ?? 'bundled']}, ${clock(state.seconds ?? 0)} long` : `${SLOTS.find((s) => s.id === id)?.label}: no usable recording, the generated sound plays`, variant: state.state === 'ready' ? 'success' : 'default', id: 'rec-test', duration: 3500 });
  }
  async function pick(files: FileList | null) {
    const file = files?.[0]; const id = target.current;
    if (!file || !id) return;
    if (file.size > 120 * 1024 * 1024) { notify({ message: 'That file is over 120 MB. Use a shorter loop (1 to 5 minutes is plenty).', variant: 'warning' }); return; }
    setBusy(id);
    const state = await saveCustomFile(id, file.name, await file.arrayBuffer());
    setBusy('');
    notify({ message: state.state === 'ready' ? `Using ${file.name} for ${SLOTS.find((s) => s.id === id)?.label}` : 'That file could not be played. Try an MP3, OGG or WAV.', variant: state.state === 'ready' ? 'success' : 'warning', id: 'rec-pick', duration: 3500 });
    if (picker.current) picker.current.value = '';
  }

  return <div className="grid gap-5">
    <Card title="Real recordings" hint="The ten classic sounds (rain, thunder, waves, wind, fire, birds, crickets, coffee shop, singing bowl, white noise) can be real recordings instead of generated ones. Until a recording exists for a sound, or if it fails to load, the generated sound plays, so nothing ever goes silent.">
      <div className="grid gap-2" data-testid="rec-list">
        {SLOTS.map((slot) => {
          const state = slotState(slot.id);
          const inFolder = folder.some((name) => name.toLowerCase().startsWith(`${slot.id}.`));
          const where = state.state === 'ready' ? state.origin : avail[slot.id] === 'custom' ? 'custom' : inFolder ? 'folder' : avail[slot.id];
          return <div key={slot.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-canvas px-3.5 py-2.5" data-testid={`rec-${slot.id}`}>
            <span className="min-w-0"><span className="block text-[11px] font-semibold">{slot.label}</span>
              <span className="block text-[10px] text-muted">{busy === slot.id || state.state === 'loading' ? 'Loading...' : where ? `Recording: ${ORIGIN[where]}${state.state === 'ready' ? `, ${clock(state.seconds ?? 0)} long${state.name ? `, ${state.name}` : ''}` : ''}` : `Generated sound (add ${slot.file})`}{state.error ? `. ${state.error}` : ''}</span></span>
            <span className="flex flex-wrap gap-1.5">
              <button type="button" className="studio-button" onClick={() => void test(slot.id)} disabled={busy === slot.id}>Check</button>
              <button type="button" className="studio-button" onClick={() => { target.current = slot.id; picker.current?.click(); }}>Choose file</button>
              {avail[slot.id] === 'custom' && <button type="button" className="studio-button" onClick={() => void removeCustomFile(slot.id)}>Remove</button>}
            </span>
          </div>;
        })}
      </div>
      <input ref={picker} type="file" accept="audio/*,.mp3,.ogg,.wav,.flac,.m4a,.opus" className="sr-only" aria-label="Choose a sound file" data-testid="rec-file" onChange={(e) => void pick(e.target.files)} />
      {desktop && <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" className="studio-button" onClick={() => void desktop?.openSoundsFolder()}>Open the sounds folder</button>
        <span className="text-[10px] text-muted">{folder.length ? `${folder.length} file${folder.length === 1 ? '' : 's'} found there.` : 'Drop files named rain.mp3, thunder.mp3 and so on into it.'}</span></div>}
      {!desktop && <p className="mt-3 text-[10px] leading-relaxed text-muted">Files you choose are kept in this browser only (they are not uploaded or synced).</p>}
    </Card>
    <Card title="Where recordings come from" hint="Add options for all: files that ship with the app, files you drop in, or files downloaded once from an address you choose.">
      <div className="grid gap-2">
        <Row label="Source" hint="Your own file for a sound always wins in Automatic."><select className="field !min-h-8 !w-auto max-w-[260px] !py-1 text-[11px]" value={rec.source} onChange={(e) => set({ source: e.target.value as RecSource })} aria-label="Recording source">{SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Row>
        <label className="block rounded-xl border border-line bg-canvas p-3 text-[11px] font-semibold">Cloud address (optional)
          <input className="field mt-1.5 !min-h-9 font-mono font-normal" spellCheck={false} value={cloud} onChange={(e) => setCloud(e.target.value)} onBlur={() => set({ cloudBase: normalizeBase(cloud) })} placeholder="https://example.com/sounds" aria-label="Cloud address" />
          <span className="mt-1 block text-[10px] font-normal text-muted">A folder that holds rain.mp3, thunder.mp3 and so on. Each is downloaded once and kept for offline use.{project ? '' : ''}</span>
          {project && <button type="button" className="studio-button mt-2" onClick={() => { const base = `${project.url.replace(/\/+$/, '')}/storage/v1/object/public/sounds`; setCloud(base); set({ cloudBase: base }); }}>Use my Supabase storage (bucket called sounds)</button>}
        </label>
      </div>
    </Card>
    <Card title="Playback" hint="How a recording is prepared so it loops cleanly and sits at a similar loudness to the generated sounds.">
      <div className="grid gap-2">
        <Slider label="Loop blend" value={rec.crossfade} min={0} max={10} step={0.5} defaultValue={3} onChange={(crossfade) => set({ crossfade })} format={(v) => `${v.toFixed(1)} s`} hint="The end of the recording is blended into its start so the loop has no click. Longer hides the join better in busy sounds." />
        <Toggle label="Even out loudness" hint="Brings every recording to a similar level, so rain and thunder do not need separate volume work." checked={rec.normalize} onChange={(normalize) => set({ normalize })} />
        <Toggle label="Use mono to save memory" hint="A decoded minute takes about 10 MB in mono and 20 MB in stereo. Stereo sounds wider but uses twice the memory." checked={rec.mono} onChange={(mono) => set({ mono })} />
        <Slider label="Recordings kept ready" value={rec.keep} min={1} max={10} defaultValue={5} onChange={(keep) => set({ keep })} format={(v) => `${v}`} hint="How many decoded recordings stay in memory. The least recently used one is dropped and loads again when needed." />
      </div>
    </Card>
    {manifest && manifest.files.length > 0 && <Card title="Credits" hint="The recordings that came with the app, with their authors and licences.">
      <ul className="grid gap-1.5 text-[11px]" data-testid="rec-credits">{manifest.files.map((f) => <li key={f.slot} className="rounded-lg border border-line px-3 py-2"><span className="font-semibold">{f.title ?? f.file}</span>{f.author ? ` by ${f.author}` : ''}{f.license ? `, ${f.license}` : ''}{f.url ? <span className="block break-all font-mono text-[10px] text-muted">{f.url}</span> : null}</li>)}</ul>
    </Card>}
  </div>;
}
