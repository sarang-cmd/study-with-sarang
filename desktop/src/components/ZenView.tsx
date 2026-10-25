import { RangeInput } from './RangeInput';
import { BreakCoach } from './BreakCoach';
import { Clapperboard, FastForward, Flag, Maximize, Minimize, Pause, Play, RefreshCw, RotateCcw, SkipForward, SlidersHorizontal, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { useFullscreen } from '../hooks/useFullscreen';
import { useFeatures } from '../hooks/useFeatures';
import { useSettings } from '../context/SettingsContext';
import { currentScene, roomController, setRoom, useLive, useRoom, useScenes } from '../lib/studyRoom';
import { StudyRoomPlayer } from './StudyRoomPlayer';
import { feedback } from '../lib/feedback';
import { builtInMixes, readSavedMixes } from '../lib/mix';
import { setPrefs, usePrefs } from '../lib/prefs';
import { clock, dayStats, formatDuration } from '../lib/tracking';
import { phaseLabel } from './TimerSection';
import { Toggle, TimerSettingsForm } from './TimerSettingsForm';
import { Visualizer } from './Visualizer';

/** The mix picker used in the Zen drawer. Loading a mix keeps playing if sound was already on. */
function MixPicker() {
  const sound = useSound();
  const saved = useMemo(() => readSavedMixes(), []);
  const all = useMemo(() => [...builtInMixes.map((item) => ({ id: item.id, name: item.mix.name, mix: item.mix })), ...saved.map((item) => ({ id: item.id, name: item.name, mix: item.mix }))], [saved]);
  return <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2.5"><span className="text-[11px] font-semibold">Sound mix</span>
    <select value={sound.activeId ?? ''} onChange={(event) => { const item = all.find((entry) => entry.id === event.target.value); if (item) { sound.loadMix(item.mix, item.id, { play: sound.playing }); feedback(`Loaded ${item.name}`, { sound: 'start', id: 'sound' }); } }}
      className="field !min-h-8 !w-auto max-w-[200px] !py-1 text-[11px]" aria-label="Sound mix">
      {!sound.activeId && <option value="">{sound.mix.name} (current)</option>}
      {all.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>;
}

/** The settings drawer: everything that changes how the timer, sound and this view behave, without leaving Zen. */
function ZenDrawer({ onClose }: { onClose: () => void }) {
  const [prefs] = usePrefs();
  const sound = useSound();
  const f = useFeatures(); const room = useRoom(); const scenes = useScenes();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return <aside ref={ref} tabIndex={-1} role="dialog" aria-label="Zen settings" data-testid="zen-drawer" className="absolute inset-y-0 right-0 z-10 flex w-[min(400px,100vw)] flex-col border-l border-line bg-surface shadow-float outline-none arrive">
    <div className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="text-[15px] font-semibold tracking-tight">Zen settings</h2>
      <button type="button" onClick={onClose} aria-label="Close settings" className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-ink"><X size={16} /></button></div>
    <div className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-5 py-5">
      <section aria-label="Sound"><h3 className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">Sound</h3>
        <div className="grid gap-2.5"><MixPicker />
          <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3.5 py-3"><span className="shrink-0 text-[11px] font-semibold">Volume</span>
            <RangeInput min={0} max={100} value={sound.mix.volume} defaultValue={50} valueText={`${sound.mix.volume}%`} onChange={sound.setVolume} label="Zen volume" className="min-w-0 flex-1" /><span className="w-9 shrink-0 text-right font-mono text-[10px] text-muted">{sound.mix.volume}%</span></div></div></section>
      {f.studyRoom && <section aria-label="Study room"><h3 className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">Study room</h3>
        <div className="grid gap-2.5">
          <Toggle label="Video behind the clock" hint={scenes.length ? 'Your own study video. More options in Settings.' : 'Add a video on the Library page first.'} checked={room.on} onChange={(on) => setRoom({ on })} />
          {scenes.length > 0 && <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2.5"><span className="text-[11px] font-semibold">Scene</span>
            <select value={currentScene(scenes, room)?.id ?? ''} onChange={(e) => setRoom({ sceneId: e.target.value })} className="field !min-h-8 !w-auto max-w-[200px] !py-1 text-[11px]" aria-label="Scene">{scenes.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2.5"><span className="text-[11px] font-semibold">Sound</span>
            <span className="inline-flex rounded-full border border-line bg-raised p-0.5" role="radiogroup" aria-label="Sound with the video">{(['replace', 'mix'] as const).map((id) => <button key={id} type="button" role="radio" aria-checked={room.sound === id} onClick={() => setRoom({ sound: id })} className={`rounded-full px-3 py-1 text-[10px] font-semibold ${room.sound === id ? 'bg-ink text-canvas' : 'text-muted hover:text-ink'}`}>{id === 'replace' ? 'Replace' : 'Together'}</button>)}</span></div>
          <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3.5 py-3"><span className="shrink-0 text-[11px] font-semibold">Darken</span>
            <RangeInput min={0} max={80} step={5} value={room.dim} defaultValue={35} valueText={`${room.dim}%`} onChange={(dim) => setRoom({ dim })} label="Darken the video" className="min-w-0 flex-1" /><span className="w-9 shrink-0 text-right font-mono text-[10px] text-muted">{room.dim}%</span></div>
        </div></section>}
      <section aria-label="Show in Zen"><h3 className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">Show in Zen</h3>
        <div className="grid gap-2.5">
          <Toggle label="Today's goal" hint="A progress bar under the clock." checked={prefs.zenGoal} onChange={(zenGoal) => setPrefs({ zenGoal })} />
          <Toggle label="Block label" hint="The name of what you are working on." checked={prefs.zenTask} onChange={(zenTask) => setPrefs({ zenTask })} />
          <Toggle label="Sound visualizer" checked={prefs.zenVisualizer} onChange={(zenVisualizer) => setPrefs({ zenVisualizer })} />
          <Toggle label="Control buttons" hint="Turn off for a clock only. Keys still work: Space, T, N, S, R, D." checked={prefs.zenControls} onChange={(zenControls) => setPrefs({ zenControls })} />
        </div></section>
      <section aria-label="Feedback"><h3 className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">Feedback</h3>
        <div className="grid gap-2.5">
          <Toggle label="Messages" hint="A small toast for skip, next, reset and similar." checked={prefs.toasts} onChange={(toasts) => setPrefs({ toasts })} />
          <Toggle label="Interface sounds" hint="A soft tick with each of those." checked={prefs.uiSounds} onChange={(uiSounds) => setPrefs({ uiSounds })} />
        </div></section>
      <section aria-label="Timer"><h3 className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">Timer</h3><TimerSettingsForm narrow /></section>
    </div>
  </aside>;
}

/** A calm, full-screen view: the clock, the goal, the sound and the controls, each of which can be switched off. */
export function ZenView({ onClose }: { onClose: () => void }) {
  const sound = useSound();
  const timer = useTimer();
  const fullscreen = useFullscreen();
  const [prefs] = usePrefs();
  const f = useFeatures(); const room = useRoom(); const scenes = useScenes(); const live = useLive(); const { openSettings } = useSettings();
  const scene = currentScene(scenes, room); const roomOn = f.studyRoom && room.on && scene !== null;
  const [idle, setIdle] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const label = clock(timer.seconds);
  const today = dayStats(timer.sessions, sound.listening, 1)[0];
  const goalSeconds = timer.settings.dailyGoalMin * 60;
  const todayFocus = today.focusSeconds + (timer.hasSegment && timer.phase === 'focus' ? timer.activeSeconds : 0);
  const goalProgress = goalSeconds ? Math.min(1, todayFocus / goalSeconds) : 0;
  const idle2 = !timer.running && !timer.hasSegment;

  useEffect(() => {
    closeButton.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  useEffect(() => {
    let timeout = 0;
    const wake = () => { setIdle(false); window.clearTimeout(timeout); timeout = window.setTimeout(() => setIdle(true), 4500); };
    wake();
    window.addEventListener('pointermove', wake); window.addEventListener('keydown', wake); window.addEventListener('pointerdown', wake);
    return () => { window.clearTimeout(timeout); window.removeEventListener('pointermove', wake); window.removeEventListener('keydown', wake); window.removeEventListener('pointerdown', wake); };
  }, []);
  const latest = useRef({ timer, drawer, onClose });
  latest.current = { timer, drawer, onClose };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const { timer: t, drawer: open, onClose: close } = latest.current;
      if (event.key === 'Escape') { if (open) setDrawer(false); else if (!document.fullscreenElement) close(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if ((event.target instanceof HTMLElement ? event.target : null)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 's' || event.key === 'S') { if (t.mode === 'pomodoro') t.skip(); }
      else if (event.key === 'r' || event.key === 'R') t.reset();
      else if (event.key === ',') setDrawer((value) => !value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hide = idle && !drawer && (timer.running || sound.playing);
  const fade = `transition-opacity duration-700 ${hide ? 'opacity-0' : 'opacity-100'}`;
  const round = 'flex h-12 w-12 items-center justify-center rounded-full border border-line hover:border-ink disabled:opacity-35';
  return <div role="dialog" aria-modal="true" aria-label="Zen view" className={`fixed inset-0 z-[120] flex flex-col bg-canvas text-ink arrive ${roomOn ? 'room-on' : ''} ${hide ? 'cursor-none' : ''}`} data-room={roomOn ? 'on' : 'off'}>
    {roomOn && scene && <StudyRoomPlayer scene={scene} room={room} />}
    <div className={`relative z-[1] flex items-center justify-between gap-3 px-5 py-4 sm:px-8 ${fade}`}>
      <p className={`min-w-0 truncate font-mono text-[11px] font-semibold uppercase tracking-[0.17em] text-muted ${roomOn ? 'room-shadow' : ''}`} data-testid="zen-title">{roomOn && scene ? `Study room${room.showTitle ? ` · ${scene.title}` : ''}` : `${sound.mix.name} · ${sound.mix.base}`}</p>
      <div className="flex items-center gap-2">
        {f.studyRoom && <button type="button" onClick={() => (scenes.length ? setRoom({ on: !room.on }) : openSettings('studyroom'))} aria-pressed={roomOn} aria-label="Study room" data-tip={scenes.length ? 'Study room video on or off' : 'Add a study room video'} data-testid="zen-room-toggle" className={`studio-button ${roomOn ? '!border-ink' : ''}`}><Clapperboard size={14} /><span className="hidden sm:inline">Study room</span></button>}
        <button type="button" onClick={() => setDrawer((value) => !value)} aria-pressed={drawer} aria-label="Zen settings" data-tip="Settings (,)" className="studio-button"><SlidersHorizontal size={14} /><span className="hidden sm:inline">Settings</span></button>
        {fullscreen.supported && <button type="button" onClick={() => void fullscreen.toggle()} aria-label={fullscreen.active ? 'Exit full screen' : 'Enter full screen'} className="studio-button">{fullscreen.active ? <Minimize size={14} /> : <Maximize size={14} />}<span className="hidden sm:inline">{fullscreen.active ? 'Exit full screen' : 'Full screen'}</span></button>}
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Close zen view" className="studio-button"><X size={14} /> <span>Close</span></button>
      </div>
    </div>

    <div className="relative z-[1] flex flex-1 flex-col items-center justify-center px-5 text-center">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">{phaseLabel(timer.phase, timer.mode)}{timer.mode === 'pomodoro' && timer.phase === 'focus' ? ` · block ${timer.cycle + 1} of ${timer.settings.cycles}` : ''}</p>
      <p role="timer" aria-label={`Time: ${label}`} className={`zen-clock mt-3 font-semibold leading-none ${roomOn ? `room-shadow ${room.clock === 'hidden' ? 'sr-only' : room.clock === 'small' ? 'text-[clamp(2.5rem,8vw,5.5rem)]' : 'text-[clamp(4.5rem,21vw,15rem)]'}` : 'text-[clamp(4.5rem,21vw,15rem)]'}`}>{label}</p>
      {prefs.zenTask && <input type="text" maxLength={60} value={timer.task} onChange={(event) => timer.setTask(event.target.value)} placeholder="Add a label for this block" aria-label="Block label"
        className="mt-4 w-full max-w-[560px] truncate border-0 bg-transparent text-center text-[15px] text-muted placeholder:text-faint focus:text-ink focus:outline-none" />}
      <div className="mt-5 w-full max-w-[460px] empty:hidden"><BreakCoach compact /></div>
      {prefs.zenGoal && <div className="mt-5 w-full max-w-[460px]" data-testid="zen-goal">
        <div className="flex items-center justify-between text-[11px] font-semibold"><span>Today&apos;s goal</span><span className="font-mono text-muted">{formatDuration(todayFocus, true)} / {goalSeconds ? formatDuration(goalSeconds, true) : 'no goal'}</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-label="Daily focus goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goalProgress * 100)}><div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${goalProgress * 100}%` }} /></div>
      </div>}
      {prefs.zenVisualizer && !roomOn && <div className="mt-9 w-full max-w-[720px]"><Visualizer height={110} bars={56} /></div>}
    </div>

    {prefs.zenControls ? <div className={`relative z-[1] flex flex-col items-center gap-5 px-5 pb-9 ${fade}`}>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={timer.toggle} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-7 text-[13px] font-semibold text-canvas hover:opacity-85">{timer.running ? <Pause size={16} /> : <Play size={16} />} {timer.running ? 'Pause timer' : timer.hasSegment ? 'Resume timer' : 'Start timer'}</button>
        {timer.mode === 'pomodoro'
          ? <button type="button" onClick={timer.skip} aria-label="Skip to the next block" data-tip="Skip to the next block (S)" className={round}><SkipForward size={16} /></button>
          : <button type="button" onClick={timer.finish} disabled={!timer.hasSegment} aria-label="Finish and log" data-tip="Stop and save this session" className={round}><Flag size={16} /></button>}
        <button type="button" onClick={timer.reset} disabled={idle2 && timer.phase === 'focus' && timer.cycle === 0} aria-label="Reset timer" data-tip="Reset (R)" className={round}><RotateCcw size={16} /></button>
        <span aria-hidden="true" className="mx-1 hidden h-7 w-px bg-line sm:block" />
        {roomOn
          ? <><button type="button" onClick={() => roomController()?.toggle()} aria-label={live.playing ? 'Pause video' : 'Play video'} data-tip={live.playing ? 'Pause video' : 'Play video'} data-testid="zen-room-play" className={round}>{live.playing ? <Pause size={18} /> : <Play size={18} />}</button>
            <button type="button" onClick={() => roomController()?.next()} disabled={scenes.length < 2} aria-label="Next scene" data-tip="Next scene" className={round}><FastForward size={16} /></button></>
          : <><button type="button" onClick={sound.toggle} aria-label={sound.playing ? 'Pause sound' : 'Play sound'} data-tip={sound.playing ? 'Pause sound' : 'Play sound'} className={round}>{sound.playing ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
            <button type="button" onClick={sound.next} aria-label="Next sound variation" data-tip="Next variation (N)" className={round}><RefreshCw size={16} /></button></>}
        <button type="button" onClick={timer.markDistraction} data-tip="I drifted (D)" className="studio-button min-h-12 px-5"><Flag size={14} /> I drifted{timer.distractions > 0 && <span className="font-mono">{timer.distractions}</span>}</button>
      </div>
      <label className="flex w-full max-w-[360px] items-center gap-3 text-[11px] font-semibold"><span className="shrink-0 text-muted">{roomOn ? 'Video volume' : 'Volume'}</span>
        <RangeInput min={0} max={100} value={roomOn ? room.volume : sound.mix.volume} defaultValue={roomOn ? 60 : 50} valueText={`${roomOn ? room.volume : sound.mix.volume}%`} onChange={roomOn ? (volume) => setRoom({ volume }) : sound.setVolume} label={roomOn ? 'Video volume' : 'Volume'} /><span className="w-9 shrink-0 text-right font-mono text-[10px] text-muted">{roomOn ? room.volume : sound.mix.volume}%</span></label>
      <p className="font-mono text-[10px] text-faint">Esc closes · Space {roomOn ? 'video' : 'sound'} · T timer · S skip · R reset · N next · , settings</p>
    </div> : <p className={`relative z-[1] pb-8 text-center font-mono text-[10px] text-faint ${fade}`}>Controls are off. Space sound · T timer · S skip · R reset · , settings</p>}
    {drawer && <ZenDrawer onClose={() => setDrawer(false)} />}
  </div>;
}
