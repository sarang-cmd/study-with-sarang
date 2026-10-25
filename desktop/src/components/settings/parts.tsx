import type { ReactNode } from 'react';

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; icon?: ReactNode }[]; onChange: (value: T) => void; label: string }) {
  return <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-raised p-1">
    {options.map((option) => <button key={option.id} type="button" role="radio" aria-checked={value === option.id} onClick={() => onChange(option.id)}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-semibold transition-colors ${value === option.id ? 'bg-ink text-canvas' : 'text-muted hover:text-ink'}`}>{option.icon}{option.label}</button>)}
  </div>;
}
export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-xl border border-line bg-canvas px-3.5 py-3">
    <span className="min-w-0 max-w-[330px]"><span className="block text-[11px] font-semibold">{label}</span>{hint && <span className="mt-0.5 block text-[10px] leading-snug text-muted">{hint}</span>}</span>{children}
  </div>;
}
