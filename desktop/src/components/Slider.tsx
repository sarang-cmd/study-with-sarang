import { RotateCcw } from 'lucide-react';
import { useId } from 'react';
import { RangeInput } from './RangeInput';

interface SliderProps {
  label: string; value: number; onChange: (value: number) => void;
  min?: number; max?: number; step?: number; defaultValue?: number;
  format?: (value: number) => string; hint?: string; compact?: boolean; inverted?: boolean; disabled?: boolean;
}

/** A labelled range with an optional one-click reset to its default. */
export function Slider({ label, value, onChange, min = 0, max = 100, step = 1, defaultValue, format, hint, compact = false, inverted = false, disabled = false }: SliderProps) {
  const id = useId();
  const shown = format ? format(value) : `${value}`;
  const changed = defaultValue !== undefined && value !== defaultValue;
  return <div className={compact ? '' : 'rounded-xl border border-line bg-canvas p-3.5'} data-tip={hint}>
    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
      <span id={`${id}-label`} className="min-w-0 truncate">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className={`font-mono text-[10px] ${inverted ? 'opacity-70' : 'text-muted'}`}>{shown}</span>
        {changed && !disabled && <button type="button" onClick={() => onChange(defaultValue!)} aria-label={`Reset ${label}`} data-tip="Reset" className="flex h-5 w-5 items-center justify-center rounded-full opacity-60 hover:opacity-100"><RotateCcw size={11} /></button>}
      </span>
    </div>
    <RangeInput id={id} label={label} min={min} max={max} step={step} value={value} defaultValue={defaultValue} inverted={inverted} disabled={disabled} valueText={shown} onChange={onChange} className="mt-1.5" />
  </div>;
}
