import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react';

export async function copyText(text: string, done: () => void) {
  try { await navigator.clipboard.writeText(text); done(); } catch { /* Clipboard may be blocked; nothing to do. */ }
}

export function Toggle({ label, hint, checked, onChange, disabled = false }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <label className={`flex items-start justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2.5 ${disabled ? 'opacity-55' : 'cursor-pointer'}`}>
    <span className="min-w-0"><span className="block text-[11px] font-semibold">{label}</span>{hint && <span className="mt-0.5 block text-[10px] leading-snug text-muted">{hint}</span>}</span>
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-ink" />
  </label>;
}

export function Card({ title, hint, children, className = '' }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-canvas p-4 sm:p-5 ${className}`}>
    <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
    {hint && <p className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</p>}
    <div className="mt-4">{children}</div>
  </div>;
}

/** A number box you can type into freely: it saves as soon as the number is in range, and tidies itself when you leave. */
export function Num({ value, min, max, onChange, ...rest }: { value: number; min: number; max: number; onChange: (n: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max'>) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft((d) => (Number(d) === value ? d : String(value))); }, [value]);
  return <input {...rest} type="number" min={min} max={max} className="field !min-h-9 text-[12px]" value={draft}
    onChange={(e) => { setDraft(e.target.value); const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(Math.round(n)); }}
    onBlur={() => { const n = Math.max(min, Math.min(max, Math.round(Number(draft) || value))); setDraft(String(n)); onChange(n); }} />;
}

