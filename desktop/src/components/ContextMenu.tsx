import { ChevronRight, Check } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type MenuItem =
  | { type?: 'item'; id: string; label: string; hint?: string; icon?: ReactNode; disabled?: boolean; checked?: boolean; onSelect?: () => void; items?: MenuItem[] }
  | { type: 'separator'; id?: string }
  | { type: 'label'; id?: string; label: string };

export interface MenuContext {
  x: number; y: number; target: HTMLElement | null; selection: string; link: HTMLAnchorElement | null;
  slider: HTMLElement | null; inside: (selector: string) => boolean;
}

const EDITABLE = 'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="file"]), textarea, [contenteditable="true"]';
const actionable = (item: MenuItem): item is Extract<MenuItem, { id: string }> & { label: string } => item.type !== 'separator' && item.type !== 'label';

/** The app's right-click menu. Text fields keep the system menu so cut, copy, paste and spelling stay native. */
export function ContextMenu({ build }: { build: (context: MenuContext) => MenuItem[] }) {
  const [open, setOpen] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const buildRef = useRef(build); buildRef.current = build;

  useEffect(() => {
    const onContext = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest(EDITABLE)) { setOpen(null); return; }
      if (target?.closest('[data-native-menu]')) return;
      event.preventDefault();
      const selection = window.getSelection()?.toString().trim() ?? '';
      const context: MenuContext = {
        x: event.clientX, y: event.clientY, target, selection,
        link: target?.closest('a[href]') as HTMLAnchorElement | null,
        slider: target?.closest('[role="slider"]') as HTMLElement | null,
        inside: (selector) => Boolean(target?.closest(selector)),
      };
      const items = buildRef.current(context);
      setOpen(items.length ? { x: event.clientX, y: event.clientY, items } : null);
    };
    const away = (event: Event) => { if (!(event.target instanceof Element && event.target.closest('[data-context-menu]'))) setOpen(null); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null); };
    document.addEventListener('contextmenu', onContext);
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', away, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('contextmenu', onContext);
      window.removeEventListener('pointerdown', away, true); window.removeEventListener('blur', close); window.removeEventListener('resize', close);
      window.removeEventListener('scroll', away, true); window.removeEventListener('keydown', onKey, true);
    };
  }, [close]);

  if (!open) return null;
  return createPortal(<MenuPanel key={`${open.x}:${open.y}`} x={open.x} y={open.y} items={open.items} onClose={close} root />, document.body);
}

function MenuPanel({ x, y, items, onClose, root = false, parentRect, onLeft }: {
  x: number; y: number; items: MenuItem[]; onClose: () => void; root?: boolean; parentRect?: DOMRect; onLeft?: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y, ready: false });
  const [active, setActive] = useState(-1);
  const [sub, setSub] = useState<string | null>(null);
  const enabled = items.map((item, index) => (actionable(item) && !item.disabled ? index : -1)).filter((index) => index >= 0);

  useLayoutEffect(() => {
    const box = panel.current?.getBoundingClientRect();
    if (!box) return;
    const margin = 8;
    let left = x, top = y;
    if (parentRect) { left = parentRect.right - 4; if (left + box.width > innerWidth - margin) left = parentRect.left - box.width + 4; top = parentRect.top - 6; }
    else if (left + box.width > innerWidth - margin) left = x - box.width;
    if (top + box.height > innerHeight - margin) top = Math.max(margin, innerHeight - box.height - margin);
    setPos({ left: Math.max(margin, left), top: Math.max(margin, top), ready: true });
  }, [x, y, parentRect]);
  // Hidden panels cannot take focus, so wait until the position is known.
  useEffect(() => { if (root && pos.ready) panel.current?.focus({ preventScroll: true }); }, [root, pos.ready]);

  const move = (delta: number) => {
    if (!enabled.length) return;
    const at = enabled.indexOf(active);
    setActive(enabled[(at + delta + enabled.length) % enabled.length]);
  };
  const choose = (item: MenuItem) => {
    if (!actionable(item) || item.disabled) return;
    if (item.items) { setSub(item.id); return; }
    onClose(); item.onSelect?.();
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    const item = items[active];
    if (event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); move(-1); }
    else if (event.key === 'Home') { event.preventDefault(); setActive(enabled[0] ?? -1); }
    else if (event.key === 'End') { event.preventDefault(); setActive(enabled[enabled.length - 1] ?? -1); }
    else if (event.key === 'ArrowRight' && item && actionable(item) && item.items) { event.preventDefault(); event.stopPropagation(); setSub(item.id); }
    else if (event.key === 'ArrowLeft' && onLeft) { event.preventDefault(); event.stopPropagation(); onLeft?.(); }
    else if (event.key === 'Enter' || event.key === ' ') { if (item) { event.preventDefault(); event.stopPropagation(); choose(item); } }
    else if (event.key === 'Tab') { event.preventDefault(); onClose(); }
    else if (event.key.length === 1 && /\S/.test(event.key)) {
      const letter = event.key.toLowerCase();
      const from = enabled.indexOf(active) + 1;
      const order = [...enabled.slice(from), ...enabled.slice(0, from)];
      const hit = order.find((index) => (items[index] as { label: string }).label.toLowerCase().startsWith(letter));
      event.stopPropagation();
      if (hit !== undefined) setActive(hit);
    }
  };

  return <div
    ref={panel} role="menu" tabIndex={-1} data-context-menu="" onKeyDown={onKeyDown} onContextMenu={(event) => event.preventDefault()}
    style={{ outline: 'none', left: pos.left, top: pos.top, visibility: pos.ready ? 'visible' : 'hidden', maxHeight: 'calc(100vh - 16px)' }}
    className="ctx-menu fixed z-[300] min-w-[212px] max-w-[300px] overflow-y-auto rounded-xl border border-line bg-canvas p-1.5 text-ink shadow-float outline-none">
    {items.map((item, index) => {
      if (item.type === 'separator') return <div key={item.id ?? `s${index}`} role="separator" className="my-1 h-px bg-line" />;
      if (item.type === 'label') return <p key={item.id ?? `l${index}`} className="px-2.5 pb-0.5 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-faint">{item.label}</p>;
      const isActive = index === active;
      const hasSub = Boolean(item.items);
      return <div key={item.id} className="relative">
        <button
          type="button" role={item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'} aria-checked={item.checked} aria-haspopup={hasSub || undefined} aria-expanded={hasSub ? sub === item.id : undefined} disabled={item.disabled} tabIndex={-1}
          onPointerEnter={() => { if (item.disabled) return; setActive(index); setSub(hasSub ? item.id : null); }}
          onClick={() => choose(item)}
          className={`flex min-h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[11.5px] font-medium ${item.disabled ? 'opacity-40' : isActive || sub === item.id ? 'bg-raised' : ''}`}>
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted" aria-hidden="true">{item.checked ? <Check size={13} /> : item.icon}</span>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.hint && <span className="shrink-0 font-mono text-[10px] text-muted">{item.hint}</span>}
          {hasSub && <ChevronRight size={13} className="shrink-0 text-muted" aria-hidden="true" />}
        </button>
        {hasSub && sub === item.id && <SubMenu items={item.items!} onClose={onClose} onBack={() => { setSub(null); panel.current?.focus({ preventScroll: true }); }} />}
      </div>;
    })}
  </div>;
}

function SubMenu({ items, onClose, onBack }: { items: MenuItem[]; onClose: () => void; onBack: () => void }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => { const parent = anchor.current?.parentElement?.getBoundingClientRect(); if (parent) setRect(parent); }, []);
  return <span ref={anchor} className="contents">{rect && <SubPanel rect={rect} items={items} onClose={onClose} onBack={onBack} />}</span>;
}
function SubPanel({ rect, items, onClose, onBack }: { rect: DOMRect; items: MenuItem[]; onClose: () => void; onBack: () => void }) {
  // The flyout is rendered in a portal so the parent's scroll area cannot clip it.
  return createPortal(<MenuPanel x={rect.right} y={rect.top} parentRect={rect} items={items} onClose={onClose} onLeft={onBack} root />, document.body);
}
