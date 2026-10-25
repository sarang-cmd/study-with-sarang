import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { defaultPuck, idlePuckState, sanitizePuck, sanitizePuckState, type PuckAction, type PuckSettings, type PuckState } from '../lib/puck';
import { PuckView } from './PuckView';

declare global {
  interface Window { puck?: { onState(cb: (p: { state: unknown; settings: unknown; dark: boolean }) => void): () => void; action(name: string): void; drag(phase: string, x: number, y: number): void; resize(w: number, h: number): void } }
}

/** The page inside the floating desktop puck window. It only draws what the main window sends and reports button presses and drags. */
export default function PuckWindow() {
  const [state, setState] = useState<PuckState>(idlePuckState);
  const [settings, setSettings] = useState<PuckSettings>(defaultPuck);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  useEffect(() => {
    document.documentElement.classList.add('puck');
    document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'; document.body.style.minWidth = '0';
    return window.puck?.onState((p) => {
      setState(sanitizePuckState(p.state)); setSettings(sanitizePuck(p.settings));
      document.documentElement.classList.toggle('dark', p.dark === true);
    });
  }, []);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const report = () => { const r = el.getBoundingClientRect(); window.puck?.resize(Math.ceil(r.width), Math.ceil(r.height)); };
    report();
    const ro = new ResizeObserver(report); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const grip = {
    onDown: (e: PointerEvent<HTMLElement>) => { dragging.current = true; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* Not needed to keep dragging. */ } window.puck?.drag('start', e.screenX, e.screenY); },
    onMove: (e: PointerEvent<HTMLElement>) => { if (dragging.current) window.puck?.drag('move', e.screenX, e.screenY); },
    onUp: (e: PointerEvent<HTMLElement>) => { if (!dragging.current) return; dragging.current = false; window.puck?.drag('end', e.screenX, e.screenY); },
  };
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
      <div ref={box} style={{ padding: 12 }} className="w-max">
        <PuckView state={state} settings={settings} desktop onAction={(a: PuckAction) => window.puck?.action(a)} onLabel={() => window.puck?.action(settings.labelClick === 'app' ? 'app' : 'zen')} grip={grip} />
      </div>
    </div>
  );
}
