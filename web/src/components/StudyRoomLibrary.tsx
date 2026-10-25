import { ArrowDown, ArrowUp, Clapperboard, Film, Link2, Play, Plus, Settings2, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSettings } from '../context/SettingsContext';
import { deleteRoomFile, putRoomFile, storageEstimate } from '../lib/roomFiles';
import { sectionNo } from '../lib/prefs';
import { MAX_SCENES, addScene, currentScene, importFromLibrary, moveScene, removeScene, renameScene, sceneFromLink, setRoom, sizeLabel, useRoom, useScenes } from '../lib/studyRoom';
import { Toggle } from './desktop/shared';
import { notify } from './ui/toast';

/** Library page: your own study-with-me videos for the Zen study room. */
export function StudyRoomLibrary({ onZen }: { onZen: () => void }) {
  const scenes = useScenes(); const room = useRoom(); const { openSettings } = useSettings();
  const [url, setUrl] = useState(''); const [title, setTitle] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [space, setSpace] = useState<{ used: number; quota: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const current = currentScene(scenes, room);
  useEffect(() => { void storageEstimate().then(setSpace); }, [scenes.length]);
  const fail = (message: string) => { setError(message); notify({ title: 'Study room', message, variant: 'error', id: 'room-status' }); };
  const addLink = (event: FormEvent) => {
    event.preventDefault();
    const scene = sceneFromLink(url, title);
    if (!scene) return fail('Use an HTTPS YouTube link, or a direct .mp4, .webm or .ogg link.');
    if (!addScene(scene)) return fail(`The study room holds up to ${MAX_SCENES} scenes.`);
    setUrl(''); setTitle(''); setError('');
  };
  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []).filter((f) => f.type.startsWith('video/')); event.currentTarget.value = '';
    if (!files.length) return fail('Pick video files such as .mp4 or .webm.');
    setBusy(true); setError(''); let added = 0;
    for (const file of files) {
      const id = crypto.randomUUID();
      try { await putRoomFile(id, file); } catch (e) { fail(e instanceof Error ? e.message : 'There was no room to keep that file.'); break; }
      const scene = addScene({ title: file.name.replace(/\.[^.]+$/, ''), kind: 'file', url: '', size: file.size }, id);
      if (!scene) { await deleteRoomFile(id).catch(() => undefined); fail(`The study room holds up to ${MAX_SCENES} scenes.`); break; }
      added++;
    }
    setBusy(false); if (added) notify({ title: 'Study room', message: `${added} video${added === 1 ? '' : 's'} added. They stay on this device.`, variant: 'success', id: 'room-status' });
  };
  const remove = (id: string, kind: string) => { removeScene(id); if (kind === 'file') void deleteRoomFile(id).catch(() => undefined); };
  const fromLibrary = () => { const n = importFromLibrary(); notify({ title: 'Study room', message: n ? `${n} video${n === 1 ? '' : 's'} copied from your playlist.` : 'Nothing new to copy from your playlist.', variant: 'success', id: 'room-status', record: false }); };
  const field = 'h-10 min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 text-[12px]';
  return <section id="study-room" aria-labelledby="room-heading" data-testid="study-room-card" className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="section-label mb-3">{sectionNo('08')}Study room</p><h2 id="room-heading" className="text-[26px] font-semibold leading-tight tracking-tight">Study with your own videos.</h2>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-muted">Put a study-with-me video, a library at night or a rainy window behind the Zen clock. It can replace the sound or play together with it. Your videos stay on this device.</p></div>
      <Clapperboard size={23} className="shrink-0 text-muted" />
    </div>
    <div className="mt-5 grid gap-2 sm:grid-cols-2">
      <Toggle label="Show the study room in Zen" hint={scenes.length ? undefined : 'Add a video below first.'} checked={room.on} onChange={(on) => setRoom({ on })} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!scenes.length} onClick={() => { setRoom({ on: true }); onZen(); }} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-5 text-[12px] font-semibold text-canvas disabled:opacity-45" data-testid="room-open-zen"><Play size={14} /> Open Zen with the study room</button>
        <button type="button" onClick={() => openSettings('studyroom')} className="studio-button"><Settings2 size={14} /> Options</button>
      </div>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div>
        <h3 className="text-[13px] font-semibold">Add a video</h3>
        <form onSubmit={addLink} className="mt-3 space-y-2.5">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3"><Link2 size={15} className="shrink-0 text-muted" /><input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Video link" placeholder="YouTube or direct video link (https)" className="h-10 w-full bg-transparent text-[12px] outline-none" /></label>
          <input type="text" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Scene name (optional)" placeholder="Give it a name (optional)" className={`${field} w-full`} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[11px] font-semibold text-canvas"><Plus size={14} /> Add link</button>
            <input ref={input} type="file" accept="video/*" multiple onChange={(e) => void addFiles(e)} className="hidden" aria-label="Add video files to the study room" data-testid="room-file-input" />
            <button type="button" disabled={busy} onClick={() => input.current?.click()} className="studio-button"><Upload size={14} /> {busy ? 'Saving...' : 'Add video files'}</button>
            <button type="button" onClick={fromLibrary} className="studio-button"><Film size={14} /> Copy from my playlist</button>
          </div>
          {error && <p role="alert" className="text-[11px]">{error}</p>}
        </form>
        <p className="mt-4 text-[11px] leading-relaxed text-muted">Files are kept in this app's own storage on this device. They are never uploaded and are not part of cloud sync, so add them again on another device.{space && space.quota > 0 ? ` Storage in use: ${sizeLabel(space.used)} of about ${sizeLabel(space.quota)} available.` : ''} YouTube videos only play if their owner allows embedding. Use videos you have the right to play.</p>
      </div>
      <div>
        <div className="flex items-center justify-between"><h3 className="text-[13px] font-semibold">Your scenes</h3><span className="font-mono text-[10px] text-muted">{scenes.length} / {MAX_SCENES}</span></div>
        {scenes.length ? <ol className="mt-3 max-h-[420px] space-y-2 overflow-y-auto" data-testid="room-scenes">{scenes.map((s, i) => <li key={s.id} data-scene-id={s.id} className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-2 ${current?.id === s.id ? 'border-ink bg-raised' : 'border-line'}`}>
          <button type="button" role="radio" aria-checked={current?.id === s.id} aria-label={`Use ${s.title}`} onClick={() => setRoom({ sceneId: s.id })} className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${current?.id === s.id ? 'border-ink bg-ink text-canvas' : 'border-line'}`}>{current?.id === s.id && <span className="block h-1.5 w-1.5 rounded-full bg-canvas" />}</button>
          <input value={s.title} onChange={(e) => renameScene(s.id, e.target.value)} aria-label={`Name for ${s.title}`} className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold outline-none" />
          <span className="shrink-0 font-mono text-[9px] uppercase text-muted">{s.kind === 'file' ? sizeLabel(s.size ?? 0) : s.kind === 'youtube' ? 'YouTube' : 'Link'}</span>
          <button type="button" disabled={i === 0} onClick={() => moveScene(s.id, -1)} aria-label={`Move ${s.title} up`} className="text-muted disabled:opacity-30"><ArrowUp size={13} /></button>
          <button type="button" disabled={i === scenes.length - 1} onClick={() => moveScene(s.id, 1)} aria-label={`Move ${s.title} down`} className="text-muted disabled:opacity-30"><ArrowDown size={13} /></button>
          <button type="button" onClick={() => remove(s.id, s.kind)} aria-label={`Remove ${s.title}`} className="text-muted hover:text-ink"><Trash2 size={13} /></button>
        </li>)}</ol> : <p className="mt-3 rounded-lg border border-dashed border-line p-5 text-center text-[11px] leading-relaxed text-muted">No scenes yet. Add a link or a file, or copy the videos from your playlist above.</p>}
      </div>
    </div>
  </section>;
}
