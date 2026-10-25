import { EyeOff, Maximize2, Pause, Play, SkipForward, Timer } from 'lucide-react';
import { useDesktop } from '../context/DesktopContext';
import { useSound } from '../context/SoundContext';
import { useTimer } from '../context/TimerContext';
import { clock } from '../lib/tracking';
import { RangeInput } from './RangeInput';
import { Visualizer } from './Visualizer';
import { WindowButtons } from './TitleBar';

/** The collapsed window: play, next, volume and the timer, 460 by 104. */
export function CompactBar() {
  const sound = useSound();
  const timer = useTimer();
  const { info, run } = useDesktop();
  const inset = info?.titlebar === 'inset';
  const custom = info?.titlebar === 'custom';
  const round = 'no-drag flex shrink-0 items-center justify-center rounded-full border border-line transition-colors hover:bg-raised';
  const small = 'no-drag flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-raised hover:text-ink';
  return <div className="flex h-screen flex-col overflow-hidden bg-canvas" role="region" aria-label="Mini bar">
    <div className="drag flex items-center gap-2 border-b border-line/60"
      style={{ height: 'var(--titlebar, 36px)', paddingLeft: inset ? 84 : 12, paddingRight: custom ? 0 : inset ? 10 : 'calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 6px)' }}>
      <span aria-hidden="true" className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-ink"><span className="h-[4px] w-[4px] rounded-full bg-canvas" /></span>
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-tight">{sound.mix.name}{sound.playing ? '' : <span className="font-normal text-muted"> · paused</span>}</span>
      <button type="button" className={small} onClick={() => run('window.hide')} aria-label="Hide to tray" data-tip="Hide to tray"><EyeOff size={14} /></button>
      <button type="button" className={small} onClick={() => run('window.expand')} aria-label="Expand to full window" data-tip="Expand"><Maximize2 size={14} /></button>
      {custom && <WindowButtons maximized={false} run={run} compact />}
    </div>
    <div className="flex flex-1 items-center gap-2.5 px-3">
      <button type="button" onClick={sound.toggle} aria-label={sound.playing ? 'Pause sound' : 'Play sound'} className="no-drag flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-canvas transition-opacity hover:opacity-80">
        {sound.playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <button type="button" onClick={sound.next} aria-label="Next variation" data-tip="Another variation" className={`${round} h-8 w-8`}><SkipForward size={14} /></button>
      <div className="no-drag flex min-w-0 flex-1 items-center gap-2">
        <div className="hidden h-7 w-16 shrink-0 overflow-hidden min-[400px]:block" aria-hidden="true"><Visualizer height={28} bars={14} /></div>
        <RangeInput min={0} max={100} value={sound.mix.volume} defaultValue={50} valueText={`${sound.mix.volume}%`} onChange={sound.setVolume} label="Volume" className="min-w-0 flex-1" />
        <span className="w-8 shrink-0 text-right font-mono text-[10px] text-muted">{sound.mix.volume}%</span>
      </div>
      <button type="button" onClick={timer.toggle} aria-label={timer.running ? 'Pause timer' : 'Start timer'} className="no-drag flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-2.5 text-[11px] font-semibold tabular-nums hover:bg-raised">
        {timer.running ? <Pause size={12} /> : <Timer size={12} />}<span className="font-mono">{clock(timer.seconds)}</span>
      </button>
    </div>
    {timer.progress > 0 && <div aria-hidden="true" className="h-[2px] w-full bg-line"><div className="h-full bg-ink transition-[width] duration-1000 ease-linear" style={{ width: `${Math.round(timer.progress * 100)}%` }} /></div>}
  </div>;
}
