import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface PaletteAction { id: string; group: string; label: string; hint?: string; keywords?: string; run: () => void }

/** Ctrl+K: type to find any action in the studio. Everything here is also available from a button, key or setting. */
export function CommandPalette({ actions, onClose }: { actions: PaletteAction[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => { input.current?.focus(); const previous = document.activeElement as HTMLElement | null; return () => previous?.focus?.(); }, []);
  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return actions;
    return actions.filter((action) => { const hay = `${action.group} ${action.label} ${action.keywords ?? ''}`.toLowerCase(); return words.every((word) => hay.includes(word)); });
  }, [actions, query]);
  useEffect(() => { setIndex(0); }, [query]);
  useEffect(() => { list.current?.children[index]?.scrollIntoView({ block: 'nearest' }); }, [index]);
  const choose = (action: PaletteAction | undefined) => { if (!action) return; onClose(); window.setTimeout(action.run, 0); };
  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setIndex((value) => Math.min(results.length - 1, value + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setIndex((value) => Math.max(0, value - 1)); }
    else if (event.key === 'Enter') { event.preventDefault(); choose(results[index]); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
  };
  return <div className="fixed inset-0 z-[126] flex items-start justify-center bg-ink/40 p-4 backdrop-blur-sm" style={{ paddingTop: 'calc(var(--titlebar, 0px) + 12vh)' }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label="Command palette" data-testid="palette" onKeyDown={onKey} className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-canvas shadow-float arrive">
      <div className="flex items-center gap-3 border-b border-line px-4"><Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
        <input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a command, mix or page" aria-label="Search commands" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={results[index] ? `pal-${results[index].id}` : undefined}
          className="h-12 w-full border-0 bg-transparent text-[14px] focus:outline-none" /></div>
      <ul id="palette-list" ref={list} role="listbox" className="max-h-[min(380px,50vh)] overflow-y-auto p-1.5">
        {results.length === 0 && <li className="px-3 py-6 text-center text-[12px] text-muted">Nothing matches.</li>}
        {results.map((action, i) => <li key={action.id} id={`pal-${action.id}`} role="option" aria-selected={i === index} onMouseMove={() => setIndex(i)} onClick={() => choose(action)}
          className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-[12px] ${i === index ? 'bg-ink text-canvas' : ''}`}>
          <span className="min-w-0 truncate"><span className={`mr-2 font-mono text-[10px] uppercase tracking-wider ${i === index ? 'opacity-70' : 'text-muted'}`}>{action.group}</span>{action.label}</span>
          {action.hint && <span className={`shrink-0 font-mono text-[10px] ${i === index ? 'opacity-70' : 'text-muted'}`}>{action.hint}</span>}
        </li>)}
      </ul>
    </div>
  </div>;
}
