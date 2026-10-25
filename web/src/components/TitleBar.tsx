import { EyeOff, LayoutGrid, PictureInPicture2, Pin, PinOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SNAP_LABELS, SNAP_ORDER, SnapGlyph } from './desktop/MonitorsCard';
import { useDesktop } from '../context/DesktopContext';
import { useFullscreen } from '../hooks/useFullscreen';

/** Thin line icons for the window buttons, drawn to match the rest of the app (the system's glyphs are drawn by Windows and cannot be styled). */
const Glyph = ({ kind }: { kind: 'min' | 'max' | 'restore' | 'close' }) => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'min' && <path d="M1.5 5.5h8" />}
    {kind === 'max' && <rect x="1.6" y="1.6" width="7.8" height="7.8" rx="1.6" />}
    {kind === 'restore' && <><rect x="1.4" y="3.2" width="6.4" height="6.4" rx="1.4" /><path d="M3.4 3.2V2.6a1.4 1.4 0 0 1 1.4-1.4h3.6a1.4 1.4 0 0 1 1.4 1.4v3.6a1.4 1.4 0 0 1-1.4 1.4h-.6" /></>}
    {kind === 'close' && <path d="M2 2l7 7M9 2L2 9" />}
  </svg>
);

const wbtn = 'flex h-full w-[46px] items-center justify-center text-muted transition-colors hover:bg-raised hover:text-ink focus-visible:bg-raised';
/** Minimize, maximize or restore, and close, drawn by the app. The mini bar leaves out maximize. */
export function WindowButtons({ maximized, run, compact = false }: { maximized: boolean; run: (command: string) => void; compact?: boolean }) {
  return <div className="no-drag ml-1 flex h-full items-stretch" role="group" aria-label="Window controls">
    <button type="button" className={wbtn} onClick={() => run('window.minimize')} aria-label="Minimize"><Glyph kind="min" /></button>
    {!compact && <button type="button" className={wbtn} onClick={() => run('window.maximize')} aria-label={maximized ? 'Restore' : 'Maximize'}><Glyph kind={maximized ? 'restore' : 'max'} /></button>}
    <button type="button" className={`${wbtn} hover:!bg-[#c42b1c] hover:!text-white`} onClick={() => run('window.close')} aria-label="Close"><Glyph kind="close" /></button>
  </div>;
}

/** A small menu of window layouts, drawn by the app so it works with the app's own buttons too. */
function SnapMenu({ run, className }: { run: (command: string) => void; className: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return <span ref={box} className="no-drag relative flex">
    <button type="button" className={className} onClick={() => setOpen((v) => !v)} aria-label="Snap layouts" aria-expanded={open} data-testid="snap-menu-button" data-tip="Snap layouts"><LayoutGrid size={14} /></button>
    {open && <div role="menu" aria-label="Snap layouts" data-testid="snap-menu" className="absolute right-0 top-full z-[90] mt-1 grid w-[236px] grid-cols-4 gap-1 rounded-xl border border-line bg-canvas p-2 shadow-float">
      {SNAP_ORDER.map((l) => <button key={l} type="button" role="menuitem" data-snap={l} aria-label={SNAP_LABELS[l]} data-tip={SNAP_LABELS[l]} onClick={() => { run(`window.snap:${l}`); setOpen(false); }} className="flex h-10 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-ink"><SnapGlyph layout={l} /></button>)}
    </div>}
  </span>;
}

/** The drag strip at the top of the window. On Windows it draws its own minimize, maximize and close buttons, or leaves room for the system ones. */
export function TitleBar() {
  const { available, info, state, run } = useDesktop();
  const fullscreen = useFullscreen();
  if (!available || !info || info.titlebar === 'none' || fullscreen.active || state?.compact) return null;
  const inset = info.titlebar === 'inset';
  const custom = info.titlebar === 'custom';
  const button = 'no-drag flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-raised hover:text-ink';
  const pinLabel = state?.pinned ? 'Unpin from top' : 'Keep on top';
  return <div
    className="drag fixed inset-x-0 top-0 z-[80] flex items-center gap-2 border-b border-line/60 bg-canvas no-print"
    style={{ height: 'var(--titlebar)', paddingLeft: inset ? 84 : 12, paddingRight: custom ? 0 : inset ? 12 : 'calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 6px)' }}>
    <span aria-hidden="true" className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-ink"><span className="h-[4px] w-[4px] rounded-full bg-canvas" /></span>
    <span className="truncate text-[11px] font-semibold tracking-tight">Study with <span className="text-muted">Sarang</span></span>
    <span className="flex-1" />
    <button type="button" className={button} onClick={() => run('window.pin')} aria-pressed={state?.pinned} aria-label={pinLabel} data-tip={pinLabel}>{state?.pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
    <SnapMenu run={run} className={button} />
    <button type="button" className={button} onClick={() => run('window.compact')} aria-label="Collapse to mini bar" data-tip="Collapse to mini bar"><PictureInPicture2 size={14} /></button>
    <button type="button" className={button} onClick={() => run('window.hide')} aria-label="Hide to tray" data-tip="Hide to tray (sound keeps playing)"><EyeOff size={14} /></button>
    {custom && <WindowButtons maximized={Boolean(state?.maximized)} run={run} />}
  </div>;
}
