import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { isDesktop } from '../lib/desktop';
import type { PuckAction, PuckSettings, PuckState } from '../lib/puck';
import { PuckView } from './PuckView';

/**
 * In a browser the puck can float above every other window using the browser's "picture in picture" window (Chrome and Edge 116 or newer).
 * It stays only while this tab is open. The desktop app has its own floating window instead.
 */
interface PipApi { requestWindow(options?: { width?: number; height?: number }): Promise<Window> }
const pipApi = (): PipApi | null => (typeof window !== 'undefined' ? ((window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture ?? null) : null);
export const popoutSupported = () => !isDesktop && !!pipApi();

let pip: Window | null = null;
const listeners = new Set<() => void>(); const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const getPip = () => pip;

export async function openPopout(): Promise<boolean> {
  const api = pipApi();
  if (!api || pip) return !!pip;
  try {
    const w = await api.requestWindow({ width: 420, height: 76 });
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.href) { const link = w.document.createElement('link'); link.rel = 'stylesheet'; link.href = sheet.href; w.document.head.appendChild(link); }
        else { const style = w.document.createElement('style'); style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n'); w.document.head.appendChild(style); }
      } catch { /* A sheet that cannot be read is skipped. */ }
    }
    w.document.documentElement.className = document.documentElement.className;
    w.document.body.style.cssText = 'margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:rgb(var(--canvas, 255 255 255))';
    w.document.body.className = 'bg-canvas text-ink font-sans antialiased';
    w.addEventListener('pagehide', () => { pip = null; emit(); });
    pip = w; emit();
    return true;
  } catch { return false; }
}
export function closePopout() { try { pip?.close(); } catch { /* Gone. */ } pip = null; emit(); }
export function usePopout() { const w = useSyncExternalStore(subscribe, getPip, getPip); return { open: !!w, win: w }; }

export function PuckPopout({ state, settings, onAction, onLabel }: { state: PuckState; settings: PuckSettings; onAction: (a: PuckAction) => void; onLabel: () => void }) {
  const { win } = usePopout();
  if (!win) return null;
  return createPortal(<PuckView state={state} settings={{ ...settings, opacity: 100 }} desktop={false} onAction={onAction} onLabel={onLabel} />, win.document.body);
}
