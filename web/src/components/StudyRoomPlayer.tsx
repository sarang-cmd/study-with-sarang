import { useEffect, useMemo, useRef, useState } from 'react';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { getRoomFile } from '../lib/roomFiles';
import { desiredPlayback, pickNext, registerController, setLive, setRoom, useScenes, type RoomSettings, type Scene } from '../lib/studyRoom';

const YT = 'https://www.youtube-nocookie.com';

/**
 * Plays the chosen scene behind the Zen view. It reports play state to the study room store (so the media keys can reach it),
 * follows the timer when asked to, and can pause the soundscape while the video plays.
 */
export function StudyRoomPlayer({ scene, room }: { scene: Scene; room: RoomSettings }) {
  const scenes = useScenes(); const timer = useTimer(); const sound = useSound();
  const [want, setWant] = useState(room.autoPlay); const [playing, setPlaying] = useState(false); const [kick, setKick] = useState(0);
  const [src, setSrc] = useState(''); const [error, setError] = useState('');
  const video = useRef<HTMLVideoElement>(null); const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ scene, scenes, room, want, sound, playing }); latest.current = { scene, scenes, room, want, sound, playing };

  // Files come out of IndexedDB as a blob, which gets a temporary address.
  useEffect(() => {
    setError(''); setPlaying(false);
    if (scene.kind === 'url') { setSrc(scene.url); return; }
    if (scene.kind !== 'file') { setSrc(''); return; }
    let url = ''; let dead = false; setSrc('');
    getRoomFile(scene.id).then((blob) => { if (dead) return; if (!blob) { setError('This file is no longer stored on this device. Add it again in the Library.'); return; } url = URL.createObjectURL(blob); setSrc(url); }, (e: unknown) => { if (!dead) setError(e instanceof Error ? e.message : 'The file could not be read.'); });
    return () => { dead = true; if (url) URL.revokeObjectURL(url); };
  }, [scene.id, scene.kind, scene.url]);

  const command = (func: string, args: unknown[] = []) => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), YT);
  const finished = () => {
    const { scene: s, scenes: list, room: r } = latest.current;
    const next = pickNext(list, s.id, r.next);
    if (!next) { setWant(false); setPlaying(false); return; }
    if (next.id === s.id) { if (s.kind === 'youtube') { command('seekTo', [0, true]); command('playVideo'); } else if (video.current) { video.current.currentTime = 0; void video.current.play().catch(() => undefined); } return; }
    setRoom({ sceneId: next.id });
  };
  const step = (by: 1 | -1) => {
    const { scene: s, scenes: list } = latest.current; if (list.length < 2) return;
    const at = list.findIndex((x) => x.id === s.id); setRoom({ sceneId: list[(at + by + list.length) % list.length].id });
  };

  // What the person (or the timer) wants, applied to whichever kind of player is on screen.
  useEffect(() => {
    if (scene.kind === 'youtube') command(want ? 'playVideo' : 'pauseVideo');
    else if (video.current && src) { if (want) void video.current.play().catch(() => { setWant(false); }); else video.current.pause(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, src, scene.id, kick]);
  useEffect(() => { if (video.current) video.current.volume = room.volume / 100; if (scene.kind === 'youtube') command('setVolume', [room.volume]); }, [room.volume, scene.kind, src]);
  const follow = desiredPlayback(room.follow, { running: timer.running, phase: timer.phase });
  useEffect(() => { if (follow !== null) setWant(follow); }, [follow]);

  // The controller the media keys and the Zen buttons use.
  useEffect(() => {
    registerController({ toggle: () => { setWant(!latest.current.playing); setKick((k) => k + 1); }, next: () => step(1), prev: () => step(-1) });
    return () => registerController(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setLive({ active: true, playing, title: scene.title }); }, [playing, scene.title]);
  useEffect(() => () => setLive({ active: false, playing: false, title: '' }), []);

  // Replace mode: the soundscape stays quiet while the video plays, and comes back afterwards.
  const resume = useRef(false);
  useEffect(() => {
    const { sound: s, room: r } = latest.current;
    if (r.sound !== 'replace') { if (resume.current) { resume.current = false; void s.play(); } return; }
    if (playing) { if (s.playing) { resume.current = true; s.pause(); } } else if (resume.current) { resume.current = false; void s.play(); }
  }, [playing, room.sound]);
  useEffect(() => () => { if (resume.current) { resume.current = false; void latest.current.sound.play(); } }, []);

  // YouTube reports through postMessage.
  useEffect(() => {
    if (scene.kind !== 'youtube') return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== YT || event.source !== frame.current?.contentWindow) return;
      let data: { event?: string; info?: unknown };
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
      if (!data || typeof data !== 'object') return;
      if (data.event === 'onReady') { command('setVolume', [latest.current.room.volume]); if (latest.current.want) command('playVideo'); }
      else if (data.event === 'onError') setError(`YouTube would not play this video here (error ${String(data.info)}). The owner may have disabled embedding.`);
      else if (data.event === 'onStateChange') { if (data.info === 1) setPlaying(true); else if (data.info === 2) setPlaying(false); else if (data.info === 0) { setPlaying(false); finished(); } }
    };
    window.addEventListener('message', onMessage); return () => window.removeEventListener('message', onMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, scene.kind]);

  const iframeSrc = useMemo(() => scene.kind !== 'youtube' || !scene.videoId ? '' : `${YT}/embed/${scene.videoId}?${new URLSearchParams({ enablejsapi: '1', origin: location.origin, autoplay: '0', controls: '0', disablekb: '1', modestbranding: '1', rel: '0', playsinline: '1', iv_load_policy: '3' })}`, [scene.kind, scene.videoId]);
  const cover = room.fit === 'cover';
  const filter = room.blur ? `blur(${room.blur}px)` : undefined;
  return <div className="absolute inset-0 z-0 overflow-hidden bg-black" data-testid="room-stage" data-scene={scene.id} data-playing={playing} aria-hidden="true">
    <div className="absolute inset-0" style={{ filter, transform: room.blur ? 'scale(1.08)' : undefined }}>
      {scene.kind === 'youtube'
        ? iframeSrc && <iframe ref={frame} key={scene.id} src={iframeSrc} title="Study room video" tabIndex={-1} allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), YT)}
          className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-0 ${cover ? 'h-[max(100%,56.25vw)] w-[max(100%,177.78vh)]' : 'aspect-video w-[min(100%,177.78vh)]'}`} />
        : src && <video ref={video} key={`${scene.id}-${src}`} src={src} playsInline loop={room.next === 'loop-one'} onEnded={finished} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onLoadedData={() => { if (video.current) { video.current.volume = room.volume / 100; if (latest.current.want) void video.current.play().catch(() => setWant(false)); } }}
          onError={() => setError('This video could not be played. Try an .mp4 or .webm file.')} className={`absolute inset-0 h-full w-full ${cover ? 'object-cover' : 'object-contain'}`} />}
    </div>
    <div className="absolute inset-0 bg-black" style={{ opacity: room.dim / 100 }} />
    {error && <p role="alert" className="absolute inset-x-0 top-1/2 mx-auto w-[min(420px,90%)] -translate-y-1/2 rounded-xl border border-white/20 bg-black/70 p-4 text-center text-[12px] leading-relaxed text-white">{error}</p>}
  </div>;
}
