import { Copy, Download, FileDown, FileUp, Link2, Play, Save, Star, Trash2, Copy as Duplicate, Pencil, RefreshCw, Archive } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { baseRecipe } from '../lib/catalog';
import { copyText, downloadFile, fileSafe, readFileText, stamp } from '../lib/browser';
import { activeLayers, builtInMixes, compactMix, envelope, mixFile, mixesEqual, mixesFile, newId, parseImport, readSavedMixes, shareURL, writeSavedMixes } from '../lib/mix';
import type { MixState, SavedMix } from '../lib/mix';
import { PLAYLIST_EVENT, PLAYLIST_KEY, readVideoPlaylist, sanitizePlaylist } from '../lib/videoPlaylist';
import { sanitizeListening, writeListening, readListening } from '../lib/tracking';
import { notify } from './ui/toast';
import { sectionNo } from '../lib/prefs';

function MixCard({ title, blurb, mix, active, onLoad, onPlay, children }: { title: string; blurb?: string; mix: MixState; active: boolean; onLoad: () => void; onPlay: () => void; children?: React.ReactNode }) {
  const count = activeLayers(mix).length;
  return <div className={`flex flex-col rounded-xl border bg-canvas p-4 ${active ? 'border-ink' : 'border-line'}`}>
    <div className="flex items-start justify-between gap-2"><h4 className="min-w-0 truncate text-[13px] font-semibold tracking-tight">{title}</h4>{active && <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-canvas">Loaded</span>}</div>
    {blurb && <p className="mt-1 text-[11px] leading-relaxed text-muted">{blurb}</p>}
    <p className="mt-2 font-mono text-[10px] text-muted">{mix.base} · {count} {count === 1 ? 'layer' : 'layers'}</p>
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={onPlay} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[11px] font-semibold text-canvas hover:opacity-85"><Play size={12} /> Play</button>
      <button type="button" onClick={onLoad} className="inline-flex h-8 items-center rounded-full border border-line px-3 text-[11px] font-semibold hover:border-ink">Load</button>
      {children}
    </div>
  </div>;
}

export function MixLibrary() {
  const { mix, setMix, activeId, loadMix, setActiveId, seed, listening } = useSound();
  const timer = useTimer();
  const [saved, setSaved] = useState<SavedMix[]>(readSavedMixes);
  const file = useRef<HTMLInputElement>(null);
  const warned = useRef(false);

  useEffect(() => {
    if (!writeSavedMixes(saved) && !warned.current) {
      warned.current = true;
      notify({ title: 'Browser storage is full or blocked', message: 'Your saved mixes cannot be stored. Download them as JSON to keep a copy.', variant: 'error', id: 'storage-status' });
    }
  }, [saved]);

  const source = builtInMixes.find((item) => item.id === activeId)?.mix ?? saved.find((item) => item.id === activeId)?.mix ?? null;
  const savedActive = saved.find((item) => item.id === activeId) ?? null;
  const sourceName = builtInMixes.find((item) => item.id === activeId)?.mix.name ?? savedActive?.name ?? null;
  const modified = !!source && !mixesEqual(source, mix);
  const renamed = !!savedActive && savedActive.name !== mix.name.trim();
  const sorted = [...saved].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt));

  function saveNew() {
    const name = mix.name.trim().slice(0, 60) || 'Untitled mix';
    const now = new Date().toISOString();
    const item: SavedMix = { id: newId(), name, favorite: false, createdAt: now, updatedAt: now, mix: { ...mix, name } };
    setSaved((previous) => [item, ...previous].slice(0, 200));
    setActiveId(item.id); setMix((m) => ({ ...m, name }));
    notify({ title: 'Mix saved', message: `"${name}" is in your browser. It stays there until you delete it.`, variant: 'success', id: 'mix-status' });
  }
  function updateSaved() {
    if (!savedActive) return;
    const name = mix.name.trim().slice(0, 60) || savedActive.name;
    setSaved((previous) => previous.map((item) => item.id === savedActive.id ? { ...item, name, mix: { ...mix, name }, updatedAt: new Date().toISOString() } : item));
    notify({ title: 'Mix updated', message: `"${name}" now has your latest changes.`, variant: 'success', id: 'mix-status' });
  }
  function rename(item: SavedMix) {
    const name = window.prompt('Rename this mix', item.name)?.trim().slice(0, 60);
    if (!name) return;
    setSaved((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, name, mix: { ...entry.mix, name }, updatedAt: new Date().toISOString() } : entry));
    if (activeId === item.id) setMix((m) => ({ ...m, name }));
  }
  function duplicate(item: SavedMix) {
    const now = new Date().toISOString();
    const name = `${item.name} copy`.slice(0, 60);
    setSaved((previous) => [{ ...item, id: newId(), name, favorite: false, createdAt: now, updatedAt: now, mix: { ...item.mix, name } }, ...previous].slice(0, 200));
  }
  function remove(item: SavedMix) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setSaved((previous) => previous.filter((entry) => entry.id !== item.id));
    if (activeId === item.id) setActiveId(null);
  }
  const favorite = (item: SavedMix) => setSaved((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, favorite: !entry.favorite } : entry));

  function downloadCurrent() {
    downloadFile(`study-with-sarang-${fileSafe(mix.name)}.json`, JSON.stringify(mixFile(mix), null, 2));
    notify({ title: 'Mix downloaded', message: 'A small JSON file you can import again, here or on another device.', variant: 'success', id: 'mix-status' });
  }
  async function copyLink() {
    const url = shareURL(mix);
    const ok = await copyText(url);
    notify(ok ? { title: 'Link copied', message: 'Anyone who opens it gets this mix. The link contains the mix itself, not your other data.', variant: 'success', id: 'mix-status' }
      : { title: 'Could not copy', message: 'Your browser blocked clipboard access. Download the mix as a JSON file instead.', variant: 'error', id: 'mix-status' });
  }
  function exportAll() {
    downloadFile(`study-with-sarang-mixes-${stamp()}.json`, JSON.stringify(mixesFile(saved), null, 2));
  }
  function fullBackup() {
    const body = {
      current: compactMix(mix), seed, mixes: JSON.parse(JSON.stringify(mixesFile(saved))).mixes,
      timerSettings: timer.settings, sessions: timer.sessions, listening, playlist: readVideoPlaylist().filter((item) => item.kind !== 'local'),
    };
    downloadFile(`study-with-sarang-backup-${stamp()}.json`, JSON.stringify(envelope('backup', body), null, 2));
    notify({ title: 'Backup downloaded', message: 'Mixes, timer settings, your time log and playlist, in one file.', variant: 'success', id: 'mix-status' });
  }

  function addMixes(items: SavedMix[]) {
    const now = new Date().toISOString();
    const fresh = items.map((item) => ({ ...item, id: newId(), createdAt: item.createdAt || now, updatedAt: now }));
    setSaved((previous) => [...fresh, ...previous].slice(0, 200));
    return fresh.length;
  }
  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!chosen) return;
    let text = '';
    try { text = await readFileText(chosen); } catch { notify({ title: 'Could not read the file', message: 'Try choosing it again.', variant: 'error', id: 'mix-status' }); return; }
    const result = parseImport(text);
    if (result.kind === 'error') { notify({ title: 'Import failed', message: result.message, variant: 'error', id: 'mix-status' }); return; }
    if (result.kind === 'sessions') {
      const added = timer.mergeSessions(result.sessions);
      notify({ title: added ? 'Time log merged' : 'Nothing new', message: added ? `${added} session${added === 1 ? '' : 's'} added to your time log.` : 'Every session in that file is already in your log.', variant: added ? 'success' : 'default', id: 'mix-status' });
      return;
    }
    if (result.kind === 'mix') {
      loadMix(result.mix, null);
      notify({ title: 'Mix loaded', message: `"${result.mix.name}" is ready. Use Save as new mix to keep it in your browser.`, variant: 'success', id: 'mix-status' });
    } else if (result.kind === 'mixes') {
      const count = addMixes(result.mixes);
      notify({ title: count ? 'Mixes imported' : 'Nothing to import', message: count ? `${count} mix${count === 1 ? '' : 'es'} added to Your mixes.` : 'That file had no usable mixes.', variant: count ? 'success' : 'error', id: 'mix-status' });
    } else {
      const added = addMixes(result.mixes);
      const raw = result.raw;
      const hasMore = Array.isArray(raw.sessions) || raw.timerSettings || Array.isArray(raw.playlist) || (raw.listening && typeof raw.listening === 'object');
      let extra = '';
      if (hasMore && window.confirm('This backup also holds timer settings, your time log and a playlist. Merge them in? Your timer settings and playlist will be replaced. Time-log entries are merged without duplicates.')) {
        const logged = Array.isArray(raw.sessions) ? timer.mergeSessions(raw.sessions) : 0;
        if (raw.timerSettings) timer.replaceSettings(raw.timerSettings);
        if (raw.listening && typeof raw.listening === 'object') {
          const incoming = sanitizeListening(raw.listening), current = readListening();
          for (const [day, secs] of Object.entries(incoming)) current[day] = Math.max(current[day] ?? 0, secs);
          writeListening(current);
        }
        const list = sanitizePlaylist(raw.playlist);
        if (list) { try { localStorage.setItem(PLAYLIST_KEY, JSON.stringify(list)); } catch { /* Not persisted. */ } window.dispatchEvent(new CustomEvent(PLAYLIST_EVENT, { detail: list })); }
        extra = ` ${logged} new time-log ${logged === 1 ? 'entry' : 'entries'} merged. Reload to refresh listening totals.`;
      }
      notify({ title: 'Backup imported', message: `${added} mix${added === 1 ? '' : 'es'} added.${extra}`, variant: 'success', id: 'mix-status', duration: 7000 });
    }
  }

  return <section id="mixes" aria-labelledby="mixes-heading" className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="section-label mb-3">{sectionNo('04')}Mixes</p><h2 id="mixes-heading" className="text-[26px] font-semibold leading-tight tracking-tight">Save, export and share.</h2>
        <p className="mt-2 max-w-[560px] text-[12px] leading-relaxed text-muted">A mix is your base, layers and fine tuning together. Keep as many as you like in this browser, download them as JSON, or share one as a link.</p></div>
    </div>

    <div className="mt-6 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <div className="rounded-xl border border-line bg-canvas p-4 sm:p-5">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">Current mix</p>
        <label htmlFor="mix-name" className="sr-only">Mix name</label>
        <input id="mix-name" type="text" maxLength={60} value={mix.name} onChange={(event) => setMix((m) => ({ ...m, name: event.target.value }))} className="field mt-2 !text-[14px] font-semibold" />
        <p className="mt-2 text-[11px] text-muted" role="status">
          {sourceName ? <>{modified || renamed ? 'Changed from' : 'Matches'} <strong className="text-ink">{sourceName}</strong>{savedActive ? ' (saved)' : ' (built in)'}.</> : 'Not saved yet.'} {mix.base} · {activeLayers(mix).length} layers.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={saveNew} className="studio-button" aria-label="Save as new mix"><Save size={13} /> Save as new</button>
          <button type="button" onClick={updateSaved} disabled={!savedActive || (!modified && !renamed)} className="studio-button" data-tip={savedActive ? 'Overwrite the loaded saved mix' : 'Load one of your saved mixes first'}><RefreshCw size={13} /> Update saved</button>
          <button type="button" onClick={downloadCurrent} className="studio-button"><Download size={13} /> Download .json</button>
          <button type="button" onClick={() => void copyLink()} className="studio-button"><Link2 size={13} /> Copy share link</button>
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">Files</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input ref={file} type="file" accept="application/json,.json" onChange={(event) => void onImport(event)} className="hidden" aria-label="Import a mix or backup file" />
            <button type="button" onClick={() => file.current?.click()} className="studio-button"><FileUp size={13} /> Import .json</button>
            <button type="button" onClick={exportAll} disabled={!saved.length} className="studio-button"><FileDown size={13} /> Export my mixes</button>
            <button type="button" onClick={fullBackup} className="studio-button col-span-2"><Archive size={13} /> Full backup (mixes, timer, log, playlist)</button>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted">Import accepts a single mix, a set of mixes, a session log or a full backup from this app. Files are read in your browser and never uploaded.</p>
        </div>
      </div>

      <div>
        <h3 className="text-[14px] font-semibold tracking-tight">Your mixes <span className="ml-1 font-mono text-[10px] font-normal text-muted">{saved.length} / 200</span></h3>
        {sorted.length ? <div className="mt-3 grid gap-2.5 sm:grid-cols-2">{sorted.map((item) => <MixCard key={item.id} title={item.name} mix={item.mix} active={activeId === item.id} onLoad={() => loadMix(item.mix, item.id)} onPlay={() => loadMix(item.mix, item.id, { play: true })}>
          <button type="button" onClick={() => favorite(item)} aria-pressed={item.favorite} aria-label={item.favorite ? `Unpin ${item.name}` : `Pin ${item.name}`} data-tip={item.favorite ? 'Unpin' : 'Pin to top'} className="flex h-8 w-8 items-center justify-center rounded-full border border-line hover:border-ink"><Star size={13} fill={item.favorite ? 'currentColor' : 'none'} /></button>
          <button type="button" onClick={() => rename(item)} aria-label={`Rename ${item.name}`} data-tip="Rename" className="flex h-8 w-8 items-center justify-center rounded-full border border-line hover:border-ink"><Pencil size={12} /></button>
          <button type="button" onClick={() => duplicate(item)} aria-label={`Duplicate ${item.name}`} data-tip="Duplicate" className="flex h-8 w-8 items-center justify-center rounded-full border border-line hover:border-ink"><Duplicate size={12} /></button>
          <button type="button" onClick={() => downloadFile(`study-with-sarang-${fileSafe(item.name)}.json`, JSON.stringify(mixFile(item.mix), null, 2))} aria-label={`Download ${item.name}`} data-tip="Download" className="flex h-8 w-8 items-center justify-center rounded-full border border-line hover:border-ink"><Download size={12} /></button>
          <button type="button" onClick={() => remove(item)} aria-label={`Delete ${item.name}`} data-tip="Delete" className="flex h-8 w-8 items-center justify-center rounded-full border border-line hover:border-ink"><Trash2 size={12} /></button>
        </MixCard>)}</div>
          : <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-[12px] leading-relaxed text-muted">Nothing saved yet. Build something you like, then press <strong className="text-ink">Save as new</strong>.</p>}
      </div>
    </div>

    <h3 className="mt-9 text-[14px] font-semibold tracking-tight">Curated mixes <span className="ml-1 font-mono text-[10px] font-normal text-muted">built in</span></h3>
    <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{builtInMixes.map((item) => <MixCard key={item.id} title={item.mix.name} blurb={item.blurb} mix={item.mix} active={activeId === item.id} onLoad={() => loadMix(item.mix, item.id)} onPlay={() => loadMix(item.mix, item.id, { play: true })}>
      <span className="sr-only">{baseRecipe[item.mix.base].blurb}</span></MixCard>)}</div>
    <p className="mt-4 text-[11px] text-muted">Press 1 to 9 on your keyboard to load the first nine curated mixes. <Copy size={11} className="mr-0.5 inline" /> A share link carries only the mix.</p>
  </section>;
}
