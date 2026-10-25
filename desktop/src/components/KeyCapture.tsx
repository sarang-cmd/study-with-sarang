import { Keyboard, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { eventToAccelerator, prettyAccelerator } from '../lib/desktopConfig';

/** Click, press the new keys, done. Esc cancels, Backspace clears. Captures before anything else sees the keys. */
export function KeyCapture({ value, onChange, mac, label }: { value: string; onChange: (accelerator: string) => void; mac: boolean; label: string }) {
  const [listening, setListening] = useState(false);
  useEffect(() => {
    if (!listening) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      if (event.code === 'Escape') { setListening(false); return; }
      if ((event.code === 'Backspace' || event.code === 'Delete') && !event.ctrlKey && !event.altKey && !event.metaKey) { onChange(''); setListening(false); return; }
      const accelerator = eventToAccelerator(event, mac);
      if (accelerator) { onChange(accelerator); setListening(false); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, mac, onChange]);
  return <span className="inline-flex items-center gap-1">
    <button type="button" onClick={() => setListening((value) => !value)} onBlur={() => setListening(false)}
      aria-label={`${label} shortcut: ${value ? prettyAccelerator(value, mac) : 'not set'}. Press to change.`}
      className={`flex min-h-8 min-w-[170px] items-center justify-center gap-1.5 rounded-lg border px-2.5 font-mono text-[10px] font-semibold ${listening ? 'border-ink bg-ink text-canvas' : 'border-line bg-canvas hover:border-ink'}`}>
      <Keyboard size={12} aria-hidden="true" />{listening ? 'Press keys, Esc to cancel' : prettyAccelerator(value, mac)}
    </button>
    {value && <button type="button" onClick={() => onChange('')} aria-label={`Clear ${label} shortcut`} data-tip="Clear" className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink"><X size={13} /></button>}
  </span>;
}
