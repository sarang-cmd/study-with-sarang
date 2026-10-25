import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export interface RangeInputProps {
  value: number; onChange: (value: number) => void;
  min?: number; max?: number; step?: number;
  /** Double-click, or the Reset item in the right-click menu, returns here. */
  defaultValue?: number;
  /** 'center' fills from the middle, for pan and tone. */
  origin?: 'start' | 'center';
  inverted?: boolean; disabled?: boolean;
  id?: string; label: string; valueText?: string; className?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The app's own slider: a pointer-driven track and thumb with full keyboard support, drawn with the
 * studio's grayscale tokens so it looks the same on every platform. Behaves like an input range.
 */
export function RangeInput({ value, onChange, min = 0, max = 100, step = 1, defaultValue, origin = 'start', inverted = false, disabled = false, id, label, valueText, className = '' }: RangeInputProps) {
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const span = max - min || 1;
  const percent = (clamp(value, min, max) - min) / span * 100;
  const fromPercent = origin === 'center' ? (0 - min) / span * 100 : 0;
  const left = Math.min(percent, fromPercent), width = Math.abs(percent - fromPercent);

  const snap = (raw: number) => {
    const decimals = (String(step).split('.')[1] ?? '').length;
    return clamp(Number((Math.round((raw - min) / step) * step + min).toFixed(decimals)), min, max);
  };
  const commit = (next: number) => { const snapped = snap(next); if (snapped !== value) onChange(snapped); };
  const fromPointer = (event: PointerEvent) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    commit(min + clamp((event.clientX - box.left) / box.width, 0, 1) * span);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    setDragging(true); fromPointer(event);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || event.ctrlKey || event.metaKey || event.altKey) return;
    const big = Math.max(step, span / 10);
    const moves: Record<string, number> = { ArrowRight: value + step, ArrowUp: value + step, ArrowLeft: value - step, ArrowDown: value - step, PageUp: value + big, PageDown: value - big, Home: min, End: max };
    if (!(event.key in moves)) return;
    event.preventDefault(); commit(moves[event.key]);
  };
  const tone = inverted
    ? { rail: 'bg-canvas/25', fill: 'bg-canvas', thumb: 'border-canvas bg-ink', bubble: 'bg-canvas text-ink' }
    : { rail: 'bg-line', fill: 'bg-ink', thumb: 'border-ink bg-canvas', bubble: 'bg-ink text-canvas' };

  return <div
    id={id} role="slider" tabIndex={disabled ? -1 : 0}
    aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText} aria-disabled={disabled || undefined} aria-orientation="horizontal"
    data-range="" data-default={defaultValue}
    onPointerDown={onPointerDown}
    onPointerMove={(event) => { if (dragging) fromPointer(event); }}
    onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}
    onLostPointerCapture={() => setDragging(false)}
    onKeyDown={onKeyDown}
    onDoubleClick={() => { if (!disabled && defaultValue !== undefined) commit(defaultValue); }}
    className={`group relative flex h-6 w-full touch-none select-none items-center rounded-full outline-none ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${className}`}>
    <div ref={track} className={`relative h-[5px] w-full rounded-full ${tone.rail}`}>
      <div className={`absolute inset-y-0 rounded-full ${tone.fill}`} style={{ left: `${left}%`, width: `${width}%` }} />
      {origin === 'center' && <span aria-hidden="true" className={`absolute -top-[3px] h-[11px] w-px ${inverted ? 'bg-canvas/50' : 'bg-faint'}`} style={{ left: `${fromPercent}%` }} />}
      <span aria-hidden="true"
        className={`absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm transition-[transform,box-shadow] duration-150 ${tone.thumb} ${dragging ? 'scale-110' : 'group-hover:scale-110'} group-focus-visible:ring-2 group-focus-visible:ring-ink/40 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-canvas`}
        style={{ left: `${percent}%` }}>
        <span className={`pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none opacity-0 transition-opacity ${tone.bubble} ${dragging ? 'opacity-100' : ''}`}>{valueText ?? value}</span>
      </span>
    </div>
  </div>;
}
