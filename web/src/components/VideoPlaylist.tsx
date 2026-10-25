import { ArrowDown, ArrowUp, ExternalLink, FastForward, Film, Link2, Maximize2, Pause, Play, Plus, SkipBack, SkipForward, Trash2, Upload, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { PLAYER_STATE_KEY, PLAYLIST_EVENT, PLAYLIST_KEY, SOURCE_PLAYLIST, defaultVideoPlaylist, parseVideoLink, readVideoPlaylist } from '../lib/videoPlaylist';
import type { VideoItem } from '../lib/videoPlaylist';
import { notify } from './ui/toast';
import { sectionNo } from '../lib/prefs';

function readPlayerControls(): { index: number; muted: boolean; looping: boolean } {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PLAYER_STATE_KEY) ?? 'null');
    if (raw && typeof raw === 'object' && 'index' in raw && Number.isInteger(raw.index) && Number(raw.index) >= 0 && Number(raw.index) < 30) {
      return { index: Number(raw.index), muted: 'muted' in raw && raw.muted === true, looping: !('looping' in raw) || raw.looping !== false };
    }
  } catch { /* Use safe initial controls. */ }
  return { index: 0, muted: false, looping: true };
}

export function VideoPlaylist() {
  const [playlist, setPlaylist] = useState<VideoItem[]>(readVideoPlaylist);
  const controls = useRef(readPlayerControls());
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [videoError, setVideoErrorState] = useState('');
  function setVideoError(value: string) {
    setVideoErrorState(value);
    if (value) notify({ title: 'Video needs attention', message: value, variant: 'error', id: 'video-status' });
  }
  const [index, setIndex] = useState(() => Math.min(controls.current.index, Math.max(0, readVideoPlaylist().length - 1)));
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [playerError, setPlayerError] = useState<number | null>(null);
  const [muted, setMuted] = useState(controls.current.muted);
  const [looping, setLooping] = useState(controls.current.looping);
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(false);
  const endedHandled = useRef('');
  const localURLs = useRef<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const videoElement = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    try { localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlist.filter((item) => item.kind !== 'local'))); }
    catch { /* Playlist still works this visit. */ }
  }, [playlist]);
  useEffect(() => {
    const replaced = (event: Event) => { const list = (event as CustomEvent<VideoItem[]>).detail; if (Array.isArray(list)) { setPlaylist(list); setIndex(0); setVideoPlaying(false); } };
    window.addEventListener(PLAYLIST_EVENT, replaced);
    return () => window.removeEventListener(PLAYLIST_EVENT, replaced);
  }, []);
  // Load the YouTube embed only once this section is near the viewport.
  useEffect(() => {
    const element = stage.current;
    if (!element || typeof IntersectionObserver === 'undefined') { setNearby(true); return; }
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { setNearby(true); observer.disconnect(); } }, { rootMargin: '400px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => { for (const item of localURLs.current) URL.revokeObjectURL(item); }, []);
  const active = playlist[index];
  useEffect(() => {
    if (!active || active.kind === 'youtube' || !videoElement.current) return;
    if (videoPlaying) void videoElement.current.play().catch(() => setVideoError('Autoplay was blocked. Use the video controls to start it.'));
    else videoElement.current.pause();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.kind, videoPlaying]);
  useEffect(() => {
    try { localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({ index, muted, looping })); }
    catch { /* Controls still work for this visit. */ }
  }, [index, muted, looping]);
  useEffect(() => { setPlayerError(null); }, [active?.id]);
  const openedFromFile = typeof location !== 'undefined' && location.protocol === 'file:';
  const iframeURL = useMemo(() => {
    if (!active || active.kind !== 'youtube') return null;
    const params = new URLSearchParams({ enablejsapi: '1', origin: location.origin, autoplay: '0', controls: '1', playsinline: '1', rel: '0' });
    // Playback, mute and loop state are NOT part of this URL. Only selecting a
    // different video changes the iframe's src, preventing play/pause refreshes.
    return `https://www.youtube-nocookie.com/embed/${active.videoId}?${params}`;
  }, [active]);
  function command(func: string, args: unknown[] = []) {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube-nocookie.com');
  }
  useEffect(() => {
    const onPlayerMessage = (event: MessageEvent) => {
      if (!['https://www.youtube-nocookie.com', 'https://www.youtube.com'].includes(event.origin) || event.source !== frame.current?.contentWindow) return;
      let data: { event?: string; info?: number };
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
      if (!data || typeof data !== 'object') return;
      if (data.event === 'onError') setPlayerError(Number(data.info) || 1);
      if (data.event === 'onReady') {
        command(muted ? 'mute' : 'unMute');
        if (videoPlaying) command('playVideo');
      }
      if (data.event === 'onStateChange') {
        if (data.info === 1) { setVideoPlaying(true); endedHandled.current = ''; }
        if (data.info === 2) setVideoPlaying(false);
        if (data.info === 0 && active && endedHandled.current !== active.id) {
          endedHandled.current = active.id;
          onEnded();
        }
      }
    };
    window.addEventListener('message', onPlayerMessage);
    return () => window.removeEventListener('message', onPlayerMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, index, looping, playlist, muted, videoPlaying]);
  function toggleVideo() {
    if (!active) return;
    if (active.kind === 'youtube') {
      if (videoPlaying) command('pauseVideo');
      else { command(muted ? 'mute' : 'unMute'); command('playVideo'); }
    } else if (videoElement.current) {
      if (videoPlaying) videoElement.current.pause();
      else void videoElement.current.play().catch(() => setVideoError('Playback was blocked. Use the native player controls to start the video.'));
    }
    setVideoPlaying((value) => !value);
  }
  function toggleMute() {
    if (active?.kind === 'youtube') command(muted ? 'unMute' : 'mute');
    setMuted((value) => !value);
  }
  function addURL(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseVideoLink(url);
    if (!parsed) { setVideoError('Use an HTTPS YouTube link or a direct .mp4, .webm or .ogg URL. Other embeds cannot be validated here.'); return; }
    if (playlist.length >= 30) { setVideoError('This playlist holds up to 30 videos. Remove one before adding more.'); return; }
    const item = { ...parsed, id: crypto.randomUUID(), title: title.trim().slice(0, 80) || (parsed.kind === 'youtube' ? `Video ${parsed.videoId}` : 'Direct video') };
    setPlaylist((previous) => [...previous, item]); setUrl(''); setTitle(''); setVideoError('');
    notify({ title: 'Video added', message: 'The link is in your browser playlist.', variant: 'success', id: 'video-status' });
  }
  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!files.length) return;
    const available = Math.max(0, 30 - playlist.length);
    const accepted = files.filter((file) => file.type.startsWith('video/')).slice(0, available);
    if (accepted.length < files.length) setVideoError('Only supported video files were added, up to the 30-item limit.');
    else setVideoError('');
    const entries: VideoItem[] = accepted.map((file) => {
      const objectURL = URL.createObjectURL(file);
      localURLs.current.add(objectURL);
      return { id: crypto.randomUUID(), title: file.name, url: objectURL, kind: 'local' };
    });
    setPlaylist((previous) => [...previous, ...entries]);
    if (entries.length) notify({ title: 'Local videos added', message: `${entries.length} file${entries.length === 1 ? '' : 's'} available until you close this visit.`, variant: 'success', id: 'video-status' });
  }
  function remove(at: number) {
    const entry = playlist[at];
    if (entry?.kind === 'local') { URL.revokeObjectURL(entry.url); localURLs.current.delete(entry.url); }
    setPlaylist((previous) => previous.filter((_, pos) => pos !== at));
    if (at < index) setIndex((value) => value - 1);
    else if (at === index) { setIndex((value) => Math.min(value, Math.max(0, playlist.length - 2))); setVideoPlaying(false); }
    notify({ title: 'Video removed', message: 'The playlist has been updated.', variant: 'success', id: 'video-status' });
  }
  function move(at: number, direction: number) {
    const target = at + direction;
    if (target < 0 || target >= playlist.length) return;
    setPlaylist((previous) => {
      const list = previous.slice(); [list[at], list[target]] = [list[target], list[at]];
      return list;
    });
    if (index === at) setIndex(target);
    else if (index === target) setIndex(at);
  }
  function advance(by: number) {
    if (!playlist.length) return;
    let target = index + by;
    if (target >= playlist.length) target = looping ? 0 : playlist.length - 1;
    if (target < 0) target = looping ? playlist.length - 1 : 0;
    if (target === index && by > 0 && !looping) { setVideoPlaying(false); return; }
    setIndex(target); setVideoPlaying(true);
  }
  function onEnded() {
    if (index === playlist.length - 1 && !looping) setVideoPlaying(false);
    else advance(1);
  }
  function fullscreenVideo() {
    const element = stage.current;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void element.requestFullscreen?.().catch(() => setVideoError('Your browser would not enter full screen for the video. Use the player controls instead.'));
  }

  return <section id="video" aria-labelledby="video-heading" className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7">
    <div className="flex items-start justify-between gap-4"><div><p className="section-label mb-3">{sectionNo('07')}Video playlist</p><h2 id="video-heading" className="text-[26px] font-semibold leading-tight tracking-tight">Bring your own motion.</h2><p className="mt-2 max-w-[560px] text-[12px] leading-relaxed text-muted">The 10 study-with-me videos are queued by default. Playback requires YouTube access and a user gesture for sound. Pair a quiet video with muted sound, or mute it and let your mix carry the room.</p></div><Film size={23} className="shrink-0 text-muted" /></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
      <div>
        <div ref={stage} className="overflow-hidden rounded-xl border border-line bg-ink/95"><div className="aspect-video">
          {!active ? <div className="flex h-full flex-col items-center justify-center px-5 text-center text-canvas"><Film size={27} className="mb-3 opacity-70" /><p className="text-[13px] font-semibold">Your playlist starts here.</p><p className="mt-1 text-[11px] text-canvas/70">The queue is empty. Restore your default list or add a link below.</p></div>
            : active.kind === 'youtube' && !nearby ? <div className="flex h-full items-center justify-center text-[11px] text-canvas/70">Loading player...</div>
            : active.kind === 'youtube' && iframeURL ? <iframe ref={frame} key={active.id} src={iframeURL} onLoad={() => { frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), 'https://www.youtube-nocookie.com'); if (muted) command('mute'); }} title={active.title} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen className="h-full w-full border-0" />
            : <video ref={videoElement} key={active.id} src={active.url} controls playsInline autoPlay={videoPlaying} muted={muted} onEnded={onEnded} onPlay={() => setVideoPlaying(true)} onPause={() => setVideoPlaying(false)} className="h-full w-full object-contain" aria-label={active.title} />}
        </div></div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={!active} onClick={toggleVideo} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[11px] font-semibold text-canvas disabled:opacity-45">{videoPlaying ? <Pause size={13} /> : <Play size={13} />} {videoPlaying ? 'Pause playlist' : 'Play playlist'}</button>
          <button type="button" disabled={!active} onClick={() => advance(-1)} aria-label="Previous video" className="flex h-9 w-9 items-center justify-center rounded-full border border-line disabled:opacity-40"><SkipBack size={15} /></button>
          <button type="button" disabled={!active} onClick={() => advance(1)} aria-label="Next video" className="flex h-9 w-9 items-center justify-center rounded-full border border-line disabled:opacity-40"><SkipForward size={15} /></button>
          <button type="button" disabled={!active} onClick={toggleMute} aria-label={muted ? 'Unmute video' : 'Mute video'} className="flex h-9 w-9 items-center justify-center rounded-full border border-line disabled:opacity-40">{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
          <button type="button" disabled={!active} onClick={fullscreenVideo} aria-label="Video full screen" data-tip="Video full screen" className="flex h-9 w-9 items-center justify-center rounded-full border border-line disabled:opacity-40"><Maximize2 size={14} /></button>
          <label className="ml-auto inline-flex items-center gap-2 text-[11px] font-semibold"><input type="checkbox" checked={looping} onChange={(event) => setLooping(event.target.checked)} className="accent-ink" /> Loop</label>
        </div>
        {active && <p className="mt-2 truncate text-[11px] text-muted">{index + 1} / {playlist.length} · {active.title}</p>}
        {active?.kind === 'youtube' && (openedFromFile || playerError !== null) && <p role="status" className="mt-2 rounded-lg border border-line px-3 py-2 text-[11px] leading-relaxed text-muted">
          {openedFromFile
            ? 'YouTube will not play inside a page opened from a file (error 153). Serve this folder with a local web server, install the desktop app, or '
            : `YouTube would not play this video here (error ${playerError}). The owner may have disabled embedding. `}
          <a href={active.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline">watch it on YouTube</a>.
        </p>}
        <div className="mt-7 border-t border-line pt-5"><h3 className="text-[13px] font-semibold">Add a video</h3><form onSubmit={addURL} className="mt-3 space-y-2.5">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3"><Link2 size={15} className="shrink-0 text-muted" /><input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} aria-label="YouTube or direct video URL" placeholder="YouTube or direct .mp4 link" className="h-10 w-full min-w-0 bg-transparent text-[11px] text-ink outline-none placeholder:text-faint" /></label>
          <input type="text" maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Video title (optional)" placeholder="Give it a name (optional)" className="h-10 w-full rounded-lg border border-line bg-canvas px-3 text-[11px] text-ink placeholder:text-faint" />
          <div className="flex flex-wrap gap-2"><button type="submit" className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[11px] font-semibold text-canvas"><Plus size={14} /> Add link</button>
            <input ref={fileInput} type="file" accept="video/*" multiple onChange={addFiles} className="hidden" aria-label="Add local video files" />
            <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-canvas px-3.5 text-[11px] font-semibold hover:border-ink"><Upload size={14} /> Add local videos</button></div></form>
          {videoError && <p role="alert" className="mt-2 text-[11px]">{videoError}</p>}</div>
      </div>
      <div>
        <div className="flex items-center justify-between"><h3 className="text-[13px] font-semibold">Your queue</h3><span className="font-mono text-[10px] text-muted">{playlist.length} / 30</span></div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]"><a href={SOURCE_PLAYLIST} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline">Source playlist <ExternalLink size={12} /></a>
          <button type="button" onClick={() => { if (window.confirm('Replace your current queue with the 10 default videos? Your custom links in this browser will be removed.')) { setPlaylist(defaultVideoPlaylist()); setIndex(0); setVideoPlaying(false); notify({ title: 'Default queue restored', message: 'Custom links were removed from the browser playlist.', variant: 'success', id: 'video-status' }); } }} className="font-semibold underline">Restore defaults</button></div>
        {playlist.length ? <ol className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">{playlist.map((item, pos) => <li key={item.id} className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-2 ${pos === index ? 'border-ink bg-canvas' : 'border-line'}`}>
          <button type="button" onClick={() => { setIndex(pos); setVideoPlaying(true); }} className="flex h-8 w-7 shrink-0 items-center justify-center font-mono text-[10px] font-semibold" aria-label={`Play ${item.title}`}>{pos === index ? <Play size={12} /> : String(pos + 1).padStart(2, '0')}</button>
          <input value={item.title} onChange={(event) => setPlaylist((previous) => previous.map((entry, n) => n === pos ? { ...entry, title: event.target.value.slice(0, 80) } : entry))} aria-label={`Name for video ${pos + 1}`} className="min-w-0 flex-1 bg-transparent text-[11px] font-medium text-ink outline-none" />
          <button type="button" disabled={pos === 0} onClick={() => move(pos, -1)} aria-label={`Move ${item.title} up`} className="text-muted disabled:opacity-30"><ArrowUp size={13} /></button>
          <button type="button" disabled={pos === playlist.length - 1} onClick={() => move(pos, 1)} aria-label={`Move ${item.title} down`} className="text-muted disabled:opacity-30"><ArrowDown size={13} /></button>
          <button type="button" onClick={() => remove(pos)} aria-label={`Remove ${item.title}`} className="text-muted hover:text-ink"><Trash2 size={13} /></button>
        </li>)}</ol> : <p className="mt-3 rounded-lg border border-dashed border-line p-5 text-center text-[11px] text-muted">The queue is empty.</p>}
      </div>
    </div>
    <p className="mt-6 border-t border-line pt-4 text-[11px] leading-[1.7] text-muted"><FastForward size={13} className="mr-1 inline" /> Direct files auto-advance or loop. The embedded YouTube player receives play, pause and mute commands without changing its URL; selecting another video starts a new embed. YouTube may block automatic or unmuted playback even after a click, and individual videos may prohibit embedding. Use the native player controls if a command fails. Local files are never uploaded.</p>
  </section>;
}
