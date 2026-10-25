import { AppWindow, Check, FastForward, GripVertical, Maximize2, Minus, Pause, Play, Plus, RotateCcw, SkipForward, Volume2, VolumeX, Wind } from 'lucide-react';
import type { PointerEvent, ReactNode } from 'react';
import { mainAction, puckLabels, SIZES, visibleActions, type PuckAction, type PuckSettings, type PuckState } from '../lib/puck';

function actionFace(action: PuckAction, state: PuckState, size: number): { icon: ReactNode; label: string; tip: string } {
  switch (action) {
    case 'timer': return { icon: state.timerRunning ? <Pause size={size} /> : <Play size={size} />, label: state.timerRunning ? 'Pause timer' : 'Start timer', tip: state.timerRunning ? 'Pause timer' : 'Start timer' };
    case 'skip': return { icon: <SkipForward size={size} />, label: 'Skip to the next block', tip: 'Skip block' };
    case 'sound': return { icon: state.soundPlaying ? <Volume2 size={size} /> : <VolumeX size={size} />, label: state.soundPlaying ? 'Pause sound' : 'Play sound', tip: state.soundPlaying ? 'Pause sound' : 'Play sound' };
    case 'next': return { icon: <FastForward size={size} />, label: 'Next sound variation', tip: 'Another variation' };
    case 'drift': return { icon: <Wind size={size} />, label: 'Mark a distraction', tip: 'I drifted' };
    case 'reset': return { icon: <RotateCcw size={size} />, label: 'Reset timer', tip: 'Reset' };
    case 'finish': return { icon: <Check size={size} />, label: 'Finish and log', tip: 'Finish and log' };
    case 'volup': return { icon: <Plus size={size} />, label: 'Volume up', tip: 'Louder' };
    case 'voldown': return { icon: <Minus size={size} />, label: 'Volume down', tip: 'Quieter' };
    case 'zen': return { icon: <Maximize2 size={size} />, label: 'Open zen view', tip: 'Zen view' };
    default: return { icon: <AppWindow size={size} />, label: 'Open the app window', tip: 'Open the app' };
  }
}

export interface PuckViewProps {
  state: PuckState; settings: PuckSettings; desktop: boolean;
  onAction: (action: PuckAction) => void; onLabel?: () => void;
  /** Drag handlers for the grip (desktop floating window only). */
  grip?: { onDown: (e: PointerEvent<HTMLElement>) => void; onMove: (e: PointerEvent<HTMLElement>) => void; onUp: (e: PointerEvent<HTMLElement>) => void };
  className?: string;
}

/** The puck itself. One look for the page, the floating desktop window and the pop-out window. */
export function PuckView({ state, settings, desktop, onAction, onLabel, grip, className = '' }: PuckViewProps) {
  const dim = SIZES[settings.size];
  const main = mainAction(settings);
  const face = actionFace(main, state, dim.icon + 2);
  const labels = puckLabels(settings, state);
  const small = visibleActions(settings, state, desktop);
  const ringR = dim.button / 2 + 3; const ringSize = (dim.button + 6);
  const circ = 2 * Math.PI * ringR;
  const ring = settings.info.includes('ring');
  const btn = { width: dim.button, height: dim.button } as const;
  return (
    <div data-testid="puck" data-main={main} data-running={state.timerRunning ? 'true' : 'false'} role="region" aria-label="Mini player" style={{ opacity: settings.opacity / 100, padding: dim.pad, gap: dim.pad - 2, fontSize: dim.text }}
      className={`flex w-max select-none items-center rounded-full border border-line bg-canvas font-semibold text-ink shadow-float ${className}`}>
      {grip && settings.grip && (
        <span data-testid="puck-grip" title="Drag to move" onPointerDown={grip.onDown} onPointerMove={grip.onMove} onPointerUp={grip.onUp} onPointerCancel={grip.onUp}
          className="flex shrink-0 cursor-grab touch-none items-center text-muted active:cursor-grabbing" style={{ height: dim.button, marginLeft: -2 }}><GripVertical size={dim.icon + 2} aria-hidden="true" /></span>
      )}
      <button type="button" data-testid="puck-main" onClick={() => onAction(main)} aria-label={face.label} data-tip={face.tip}
        className="relative flex shrink-0 items-center justify-center rounded-full bg-ink text-canvas transition-transform active:scale-95" style={btn}>
        {face.icon}
        {ring && <svg aria-hidden="true" width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`} className="pointer-events-none absolute -rotate-90" style={{ left: -3, top: -3 }}>
          <circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" className="text-ink" />
          <circle data-testid="puck-ring" cx={ringSize / 2} cy={ringSize / 2} r={ringR} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity={state.progress > 0.003 ? 1 : 0} strokeDasharray={circ} strokeDashoffset={circ * (1 - state.progress)} className="text-ink" style={{ transition: 'stroke-dashoffset 600ms linear' }} />
        </svg>}
      </button>
      {labels.length > 0 && (
        <button type="button" data-testid="puck-label" onClick={settings.labelClick === 'none' ? undefined : onLabel} tabIndex={settings.labelClick === 'none' ? -1 : 0}
          className={`flex min-w-0 flex-col items-start text-left leading-tight ${settings.labelClick === 'none' ? 'cursor-default' : 'hover:opacity-80'}`}>
          {labels.map((l, i) => <span key={l.key} data-info={l.key} className={`max-w-[190px] truncate ${l.key === 'clock' ? 'font-mono tabular-nums' : ''} ${i === 0 && l.key !== 'clock' ? '' : 'text-muted'} ${l.key === 'clock' ? 'text-ink' : ''}`}>{l.text}</span>)}
        </button>
      )}
      {small.map((a) => {
        const f = actionFace(a, state, dim.icon);
        return <button key={a} type="button" data-testid={`puck-${a}`} onClick={() => onAction(a)} aria-label={f.label} data-tip={f.tip} className="flex shrink-0 items-center justify-center rounded-full border border-line transition-colors hover:bg-surface active:scale-95" style={btn}>{f.icon}</button>;
      })}
    </div>
  );
}
