import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

const rows: [string, string][] = [
  ['Space', 'Play or pause sound'], ['T', 'Start or pause the timer'], ['Z', 'Open or close zen view'], ['F', 'Full screen on or off'],
  ['N', 'Next sound variation'], ['D', 'Log a distraction'], ['[  and  ]', 'Volume down and up'], ['1 to 9', 'Load a curated mix'], ['?', 'Show this list'], ['Ctrl K', 'Command palette'], ['Ctrl ,', 'Settings'], ['Pause / Break', 'Play or pause sound'], ['Play/Pause, Next', 'Media keys: sound and variation'], ['In zen: S, R, ,', 'Skip, reset, zen settings'], ['Esc', 'Close zen view or this window'],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="shortcut-heading" className="w-full max-w-[420px] rounded-2xl border border-line bg-canvas p-6 shadow-float arrive">
      <div className="flex items-start justify-between gap-3"><div><p className="section-label mb-2">Keyboard</p><h2 id="shortcut-heading" className="text-[22px] font-semibold tracking-tight">Shortcuts</h2></div>
        <button ref={close} type="button" onClick={onClose} aria-label="Close shortcuts" className="flex h-9 w-9 items-center justify-center rounded-full border border-line hover:border-ink"><X size={15} /></button></div>
      <dl className="mt-5 divide-y divide-line">{rows.map(([key, text]) => <div key={key} className="flex items-center justify-between gap-4 py-2.5 text-[12px]"><dt className="text-muted">{text}</dt><dd><kbd className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-[11px] font-semibold">{key}</kbd></dd></div>)}</dl>
      <p className="mt-4 text-[11px] text-muted">Shortcuts pause while you type in a text box.</p>
    </div>
  </div>;
}
